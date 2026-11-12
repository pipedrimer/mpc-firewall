import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { decodeUnsignedEvmTx } from '../src/decoders/evmDecoder.js';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const VENDOR = '0x1111111111111111111111111111111111111111';
const DRAINER = '0xdead00000000000000000000000000000000beef';

describe('decoders/evmDecoder (Zero-Trust RLP & ABI Calldata)', () => {
  it('decodes raw unsigned EIP-1559 ERC20 transfer and matches ethers keccak256 digest', () => {
    const erc20 = new ethers.Interface([
      'function transfer(address to, uint256 amount) returns (bool)'
    ]);
    const calldata = erc20.encodeFunctionData('transfer', [VENDOR, 25_000_000n]);
    const tx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 7,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 65_000n,
      to: USDC_BASE,
      value: 0n,
      data: calldata
    });

    const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);

    assert.equal(decoded.kind, 'evm');
    assert.equal(decoded.txType, 'eip1559');
    assert.equal(decoded.chainId, 8453);
    assert.equal(decoded.to, USDC_BASE.toLowerCase());
    assert.equal(decoded.valueWei, '0');
    assert.equal(decoded.sighashPayloadHex, tx.unsignedHash.toLowerCase());
    assert.equal(decoded.rootCall.action, 'ERC20_TRANSFER');
    assert.equal(decoded.rootCall.selector, '0xa9059cbb');
    assert.equal(decoded.rootCall.recipient, VENDOR.toLowerCase());
    assert.equal(decoded.rootCall.tokenAmount, '25000000');
  });

  it('decodes ERC20 unlimited approve(MaxUint256) inside unsigned RLP', () => {
    const erc20 = new ethers.Interface([
      'function approve(address spender, uint256 amount) returns (bool)'
    ]);
    const calldata = erc20.encodeFunctionData('approve', [DRAINER, ethers.MaxUint256]);
    const tx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 8,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 65_000n,
      to: USDC_BASE,
      value: 0n,
      data: calldata
    });

    const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);

    assert.equal(decoded.rootCall.action, 'ERC20_APPROVE');
    assert.equal(decoded.rootCall.selector, '0x095ea7b3');
    assert.equal(decoded.rootCall.spenderOrOperator, DRAINER.toLowerCase());
    assert.equal(decoded.rootCall.tokenAmount, ethers.MaxUint256.toString());
  });

  it('unwraps nested multicall(bytes[]) to expose smuggled approve(MaxUint256)', () => {
    const routerIface = new ethers.Interface([
      'function multicall(bytes[] data) returns (bytes[])'
    ]);
    const erc20Iface = new ethers.Interface([
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)'
    ]);
    const innerTransfer = erc20Iface.encodeFunctionData('transfer', [VENDOR, 1_000_000n]);
    const innerPoison = erc20Iface.encodeFunctionData('approve', [DRAINER, ethers.MaxUint256]);
    const outerData = routerIface.encodeFunctionData('multicall', [[innerTransfer, innerPoison]]);

    const tx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 9,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 180_000n,
      to: '0x2626664c2603336e57b271c5c0b26f421741e481',
      value: 0n,
      data: outerData
    });

    const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);

    assert.equal(decoded.rootCall.action, 'MULTICALL');
    assert.equal(decoded.rootCall.nestedCalls.length, 2);
    assert.equal(decoded.rootCall.nestedCalls[0].action, 'ERC20_TRANSFER');
    assert.equal(decoded.rootCall.nestedCalls[1].action, 'ERC20_APPROVE');
    assert.equal(decoded.rootCall.nestedCalls[1].spenderOrOperator, DRAINER.toLowerCase());
    assert.equal(decoded.rootCall.nestedCalls[1].tokenAmount, ethers.MaxUint256.toString());
  });

  it('decodes legacy EIP-155 unsigned ETH transfer', () => {
    const tx = ethers.Transaction.from({
      type: 0,
      chainId: 42161,
      nonce: 2,
      gasPrice: 100_000_000n,
      gasLimit: 21_000n,
      to: VENDOR,
      value: 100_000_000_000_000_000n,
      data: '0x'
    });

    const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);

    assert.equal(decoded.txType, 'legacy');
    assert.equal(decoded.chainId, 42161);
    assert.equal(decoded.rootCall.action, 'NATIVE_TRANSFER');
    assert.equal(decoded.valueWei, '100000000000000000');
    assert.equal(decoded.sighashPayloadHex, tx.unsignedHash.toLowerCase());
  });
});

