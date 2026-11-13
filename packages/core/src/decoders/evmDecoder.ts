import { ethers } from 'ethers';
import type { DecodedEvmTx, EvmActionType, EvmDecodedCall } from '../types.js';

const MAX_MULTICALL_DEPTH = 3;

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

function strip0x(hex: string): string {
  return hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
}

function normalizeHex(hex: string): string {
  const clean = strip0x(hex).trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error('ERR_INVALID_RAW_TX: Invalid hex encoding');
  }
  return `0x${clean}`;
}

function bytesFromHex(hex: string): Uint8Array {
  const clean = strip0x(normalizeHex(hex));
  return Uint8Array.from(Buffer.from(clean, 'hex'));
}

function hexFromBytes(bytes: Uint8Array): string {
  return `0x${Buffer.from(bytes).toString('hex')}`;
}

function rlpBytesToBigInt(item: unknown): bigint {
  if (typeof item !== 'string') {
    throw new Error('ERR_INVALID_RAW_TX: Expected RLP bytes');
  }
  const clean = strip0x(item);
  if (clean.length === 0) return 0n;
  return BigInt(`0x${clean}`);
}

function rlpBytesToAddress(item: unknown): string {
  if (typeof item !== 'string') {
    throw new Error('ERR_INVALID_RAW_TX: Expected address RLP bytes');
  }
  const clean = strip0x(item).toLowerCase();
  if (clean.length === 0) {
    return '0x0000000000000000000000000000000000000000';
  }
  if (clean.length !== 40) {
    throw new Error('ERR_INVALID_RAW_TX: Expected 20-byte recipient address');
  }
  return `0x${clean}`;
}

function decodeCalldataRecursive(
  target: string,
  dataHex: string,
  depth: number
): EvmDecodedCall {
  if (depth > MAX_MULTICALL_DEPTH) {
    throw new Error('ERR_NESTED_MULTICALL_VIOLATION: Max multicall nesting depth exceeded');
  }

  const normalized = normalizeHex(dataHex);
  const clean = strip0x(normalized);

  if (clean.length === 0) {
    return {
      depth,
      target,
      selector: '0x',
      action: 'NATIVE_TRANSFER',
      nestedCalls: [],
      rawDataHex: '0x'
    };
  }

  if (clean.length < 8) {
    throw new Error('ERR_INVALID_RAW_TX: Calldata shorter than 4-byte selector');
  }

  const selector = `0x${clean.slice(0, 8)}`;
  const argsHex = `0x${clean.slice(8)}`;

  if (selector === '0xa9059cbb') {
    const [recipient, amount] = abiCoder.decode(['address', 'uint256'], argsHex);
    return {
      depth,
      target,
      selector,
      action: 'ERC20_TRANSFER',
      recipient: String(recipient).toLowerCase(),
      tokenAmount: BigInt(amount).toString(),
      nestedCalls: [],
      rawDataHex: normalized
    };
  }

  if (selector === '0x095ea7b3' || selector === '0x39509351') {
    const [spender, amount] = abiCoder.decode(['address', 'uint256'], argsHex);
    return {
      depth,
      target,
      selector,
      action: 'ERC20_APPROVE',
      spenderOrOperator: String(spender).toLowerCase(),
      tokenAmount: BigInt(amount).toString(),
      nestedCalls: [],
      rawDataHex: normalized
    };
  }

  if (selector === '0xd505accf') {
    const [owner, spender, value] = abiCoder.decode(
      ['address', 'address', 'uint256', 'uint256', 'uint8', 'bytes32', 'bytes32'],
      argsHex
    );
    return {
      depth,
      target,
      selector,
      action: 'ERC20_PERMIT',
      fromAddress: String(owner).toLowerCase(),
      spenderOrOperator: String(spender).toLowerCase(),
      tokenAmount: BigInt(value).toString(),
      nestedCalls: [],
      rawDataHex: normalized
    };
  }

  if (selector === '0x23b872dd') {
    const [from, recipient, amount] = abiCoder.decode(['address', 'address', 'uint256'], argsHex);
    return {
      depth,
      target,
      selector,
      action: 'ERC20_TRANSFER_FROM',
      fromAddress: String(from).toLowerCase(),
      recipient: String(recipient).toLowerCase(),
      tokenAmount: BigInt(amount).toString(),
      nestedCalls: [],
      rawDataHex: normalized
    };
  }

  if (selector === '0xa22cb465') {
    const [operator, approved] = abiCoder.decode(['address', 'bool'], argsHex);
    return {
      depth,
      target,
      selector,
      action: 'NFT_SET_APPROVAL_FOR_ALL',
      spenderOrOperator: String(operator).toLowerCase(),
      approvedBool: Boolean(approved),
      nestedCalls: [],
      rawDataHex: normalized
    };
  }

  if (selector === '0xac9650d8' || selector === '0x5ae401dc') {
    const decodedArgs =
      selector === '0xac9650d8'
        ? (abiCoder.decode(['bytes[]'], argsHex)[0] as string[])
        : (abiCoder.decode(['uint256', 'bytes[]'], argsHex)[1] as string[]);

    const nestedCalls = Array.from(decodedArgs).map((innerHex) =>
      decodeCalldataRecursive(target, innerHex, depth + 1)
    );
    return {
      depth,
      target,
      selector,
      action: 'MULTICALL',
      nestedCalls,
      rawDataHex: normalized
    };
  }

  const action: EvmActionType = 'UNKNOWN_CONTRACT_CALL';
  return {
    depth,
    target,
    selector,
    action,
    nestedCalls: [],
    rawDataHex: normalized
  };
}

function flattenCalls(call: EvmDecodedCall): EvmDecodedCall[] {
  const result = [call];
  for (const child of call.nestedCalls) {
    result.push(...flattenCalls(child));
  }
  return result;
}

/**
 * Decodes an unsigned EIP-1559 (0x02), EIP-2930 (0x01), or Legacy RLP EVM transaction
 * directly from raw hex bytes, computing the exact keccak256 digest that Chain Signatures signs.
 */
export function decodeUnsignedEvmTx(rawUnsignedHex: string): DecodedEvmTx {
  const normalizedHex = normalizeHex(rawUnsignedHex);
  const bytes = bytesFromHex(normalizedHex);
  if (bytes.length === 0) {
    throw new Error('ERR_INVALID_RAW_TX: Empty EVM transaction');
  }

  const sighashPayloadHex = ethers.keccak256(bytes).toLowerCase();

  let txType: DecodedEvmTx['txType'] = 'legacy';
  let chainId = 1;
  let nonce = '0';
  let maxPriorityFeePerGas: string | undefined;
  let maxFeePerGas: string | undefined;
  let gasLimit = '0';
  let to = '';
  let valueWei = '0';
  let dataHex = '0x';

  if (bytes[0] === 0x02) {
    txType = 'eip1559';
    const fields = ethers.decodeRlp(hexFromBytes(bytes.slice(1)));
    if (!Array.isArray(fields) || fields.length !== 9) {
      throw new Error('ERR_INVALID_RAW_TX: Invalid EIP-1559 RLP field count (expected 9)');
    }
    chainId = Number(rlpBytesToBigInt(fields[0]));
    nonce = rlpBytesToBigInt(fields[1]).toString();
    maxPriorityFeePerGas = rlpBytesToBigInt(fields[2]).toString();
    maxFeePerGas = rlpBytesToBigInt(fields[3]).toString();
    gasLimit = rlpBytesToBigInt(fields[4]).toString();
    to = rlpBytesToAddress(fields[5]);
    valueWei = rlpBytesToBigInt(fields[6]).toString();
    dataHex = normalizeHex(String(fields[7]));
  } else if (bytes[0] === 0x01) {
    txType = 'eip2930';
    const fields = ethers.decodeRlp(hexFromBytes(bytes.slice(1)));
    if (!Array.isArray(fields) || fields.length !== 8) {
      throw new Error('ERR_INVALID_RAW_TX: Invalid EIP-2930 RLP field count (expected 8)');
    }
    chainId = Number(rlpBytesToBigInt(fields[0]));
    nonce = rlpBytesToBigInt(fields[1]).toString();
    maxFeePerGas = rlpBytesToBigInt(fields[2]).toString();
    gasLimit = rlpBytesToBigInt(fields[3]).toString();
    to = rlpBytesToAddress(fields[4]);
    valueWei = rlpBytesToBigInt(fields[5]).toString();
    dataHex = normalizeHex(String(fields[6]));
  } else if (bytes[0] >= 0xc0) {
    txType = 'legacy';
    const fields = ethers.decodeRlp(normalizedHex);
    if (!Array.isArray(fields) || (fields.length !== 6 && fields.length !== 9)) {
      throw new Error('ERR_INVALID_RAW_TX: Invalid Legacy RLP field count (expected 6 or 9)');
    }
    nonce = rlpBytesToBigInt(fields[0]).toString();
    maxFeePerGas = rlpBytesToBigInt(fields[1]).toString();
    gasLimit = rlpBytesToBigInt(fields[2]).toString();
    to = rlpBytesToAddress(fields[3]);
    valueWei = rlpBytesToBigInt(fields[4]).toString();
    dataHex = normalizeHex(String(fields[5]));
    if (fields.length >= 9) {
      const possibleChainId = Number(rlpBytesToBigInt(fields[6]));
      if (possibleChainId > 0) chainId = possibleChainId;
    }
  } else {
    throw new Error('ERR_INVALID_RAW_TX: Unsupported EVM transaction envelope');
  }

  const rootCall = decodeCalldataRecursive(to, dataHex, 0);
  const flattenedCalls = flattenCalls(rootCall);

  return {
    kind: 'evm',
    txType,
    chainId,
    nonce,
    maxPriorityFeePerGas,
    maxFeePerGas,
    gasLimit,
    to,
    valueWei,
    dataHex,
    rawUnsignedHex: normalizedHex,
    sighashPayloadHex,
    rootCall,
    flattenedCalls
  };
}

