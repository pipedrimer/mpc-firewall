import crypto from 'node:crypto';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP = new Map(BASE58_ALPHABET.split('').map((ch, idx) => [ch, idx]));
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function decodeBase58(input: string): Buffer {
  if (!input) return Buffer.alloc(0);
  let num = 0n;
  for (const ch of input) {
    const digit = BASE58_MAP.get(ch);
    if (digit === undefined) {
      throw new Error(`Invalid base58 character: ${ch}`);
    }
    num = num * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.push(Number(num & 0xffn));
    num >>= 8n;
  }
  bytes.reverse();
  let leadingZeros = 0;
  for (const ch of input) {
    if (ch === '1') leadingZeros += 1;
    else break;
  }
  return Buffer.concat([Buffer.alloc(leadingZeros), Buffer.from(bytes)]);
}

function encodeString(str: string): Buffer {
  const bytes = Buffer.from(str, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

function encodeU64LE(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value, 0);
  return buf;
}

function encodeU128LE(value: bigint): Buffer {
  const buf = Buffer.alloc(16);
  let v = value;
  for (let i = 0; i < 16; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

function encodeBytes(bytes: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

export function parseEd25519SecretKey(secretKeyStr: string): {
  publicKeyRaw: Buffer;
  publicKeyStr: string;
  privateKeyObj: crypto.KeyObject;
} {
  const rawPart = secretKeyStr.startsWith('ed25519:') ? secretKeyStr.slice('ed25519:'.length) : secretKeyStr;
  const decoded = decodeBase58(rawPart.trim());
  if (decoded.length !== 64) {
    throw new Error(`Expected 64-byte NEAR ed25519 keypair, got ${decoded.length} bytes`);
  }
  const seed = decoded.subarray(0, 32);
  const publicKeyRaw = decoded.subarray(32, 64);
  const privateKeyObj = crypto.createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8'
  });

  // Encode public key back to ed25519:<base58> for JSON-RPC access_key lookup
  let pubNum = 0n;
  for (const b of publicKeyRaw) {
    pubNum = (pubNum << 8n) + BigInt(b);
  }
  let encoded = '';
  while (pubNum > 0n) {
    encoded = BASE58_ALPHABET[Number(pubNum % 58n)] + encoded;
    pubNum /= 58n;
  }
  for (const b of publicKeyRaw) {
    if (b === 0) encoded = `1${encoded}`;
    else break;
  }

  return {
    publicKeyRaw,
    publicKeyStr: `ed25519:${encoded}`,
    privateKeyObj
  };
}

async function nearRpc<T>(rpcUrl: string, method: string, params: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`NEAR RPC HTTP ${res.status}`);
    }
    const json = (await res.json()) as { result?: T; error?: { message?: string; data?: unknown } };
    if (json.error) {
      throw new Error(
        `NEAR RPC ${method} error: ${json.error.message || 'unknown'} ${json.error.data ? JSON.stringify(json.error.data) : ''}`
      );
    }
    if (!json.result) {
      throw new Error(`NEAR RPC ${method} returned empty result`);
    }
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

export interface NearFunctionCallParams {
  rpcUrl?: string;
  signerId: string;
  signerPrivateKey: string;
  receiverId: string;
  methodName: string;
  args: Record<string, unknown>;
  gas?: bigint;
  depositYocto?: bigint;
}

export interface NearExecutionOutcome {
  txHash: string;
  explorerUrl: string;
  succeeded: boolean;
  returnValueJson: unknown;
  returnValueText: string | null;
  failureMessage: string | null;
  receiptCount: number;
  gasBurnt: number;
  logs: string[];
}

interface RpcFinalExecutionOutcome {
  status?: {
    SuccessValue?: string;
    Failure?: unknown;
  };
  transaction?: {
    hash?: string;
  };
  transaction_outcome?: {
    id?: string;
    outcome?: {
      gas_burnt?: number;
      logs?: string[];
    };
  };
  receipts_outcome?: Array<{
    id?: string;
    outcome?: {
      status?: {
        SuccessValue?: string;
        Failure?: unknown;
      };
      gas_burnt?: number;
      logs?: string[];
    };
  }>;
}

function extractFailureText(failureObj: unknown): string {
  const raw = JSON.stringify(failureObj);
  const match = raw.match(/panicked at [^:]+:\d+:\d+:\s*\\?"?([^"\\]+)/);
  if (match) return match[1];
  const errMatch = raw.match(/ERR_[A-Z0-9_]+[^"}]*/);
  if (errMatch) return errMatch[0];
  return raw;
}

export async function signAndSendNearFunctionCall(
  params: NearFunctionCallParams
): Promise<NearExecutionOutcome> {
  const rpcUrl = params.rpcUrl || process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
  const { publicKeyRaw, publicKeyStr, privateKeyObj } = parseEd25519SecretKey(params.signerPrivateKey);

  const accessKey = await nearRpc<{ nonce: number | string; block_hash: string }>(rpcUrl, 'query', {
    request_type: 'view_access_key',
    finality: 'final',
    account_id: params.signerId,
    public_key: publicKeyStr
  });

  const nonce = BigInt(accessKey.nonce) + 1n;
  const blockHash = decodeBase58(accessKey.block_hash);
  if (blockHash.length !== 32) {
    throw new Error(`Unexpected block hash byte length: ${blockHash.length}`);
  }

  const argsBuffer = Buffer.from(JSON.stringify(params.args), 'utf8');
  const gas = params.gas ?? 300_000_000_000_000n;
  const deposit = params.depositYocto ?? 0n;

  const txBytes = Buffer.concat([
    encodeString(params.signerId),
    Buffer.from([0]), // Ed25519 PublicKey variant
    publicKeyRaw,
    encodeU64LE(nonce),
    encodeString(params.receiverId),
    blockHash,
    // Vec<Action> len = 1
    (() => {
      const len = Buffer.alloc(4);
      len.writeUInt32LE(1, 0);
      return len;
    })(),
    Buffer.from([2]), // Action::FunctionCall discriminant = 2
    encodeString(params.methodName),
    encodeBytes(argsBuffer),
    encodeU64LE(gas),
    encodeU128LE(deposit)
  ]);

  const txHashBytes = crypto.createHash('sha256').update(txBytes).digest();
  const signatureBytes = crypto.sign(null, txHashBytes, privateKeyObj);

  const signedTxBytes = Buffer.concat([
    txBytes,
    Buffer.from([0]), // Ed25519 Signature variant
    signatureBytes
  ]);

  const rpcOutcome = await nearRpc<RpcFinalExecutionOutcome>(rpcUrl, 'send_tx', {
    signed_tx_base64: signedTxBytes.toString('base64'),
    wait_until: 'FINAL'
  });

  const txHash = rpcOutcome.transaction?.hash || rpcOutcome.transaction_outcome?.id || '';
  const allLogs: string[] = [...(rpcOutcome.transaction_outcome?.outcome?.logs ?? [])];
  let totalGas = rpcOutcome.transaction_outcome?.outcome?.gas_burnt ?? 0;

  let failureMessage: string | null = null;
  if (rpcOutcome.status?.Failure) {
    failureMessage = extractFailureText(rpcOutcome.status.Failure);
  }

  for (const r of rpcOutcome.receipts_outcome ?? []) {
    totalGas += r.outcome?.gas_burnt ?? 0;
    if (r.outcome?.logs) allLogs.push(...r.outcome.logs);
    if (!failureMessage && r.outcome?.status?.Failure) {
      failureMessage = extractFailureText(r.outcome.status.Failure);
    }
  }

  let returnValueText: string | null = null;
  let returnValueJson: unknown = null;
  const successB64 = rpcOutcome.status?.SuccessValue;
  if (successB64) {
    returnValueText = Buffer.from(successB64, 'base64').toString('utf8');
    try {
      returnValueJson = JSON.parse(returnValueText);
    } catch {
      returnValueJson = returnValueText;
    }
  }

  return {
    txHash,
    explorerUrl: `https://testnet.nearblocks.io/txns/${txHash}`,
    succeeded: Boolean(rpcOutcome.status?.SuccessValue !== undefined && !failureMessage),
    returnValueJson,
    returnValueText,
    failureMessage,
    receiptCount: rpcOutcome.receipts_outcome?.length ?? 0,
    gasBurnt: totalGas,
    logs: allLogs
  };
}

