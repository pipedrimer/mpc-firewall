import crypto from 'node:crypto';
import type { Bip143InputContext, BitcoinOutput, DecodedBitcoinTx } from '../types.js';

function strip0x(hex: string): string {
  return hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
}

function doubleSha256(buf: Buffer): Buffer {
  const first = crypto.createHash('sha256').update(buf).digest();
  return crypto.createHash('sha256').update(first).digest();
}

function normalizeBip143ScriptCode(scriptCodeHex: string): Buffer {
  const clean = strip0x(scriptCodeHex).trim().toLowerCase();
  if (!clean || !/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error('ERR_INVALID_RAW_TX: Invalid BIP-143 scriptCode hex');
  }
  // Accept 20-byte pubkeyHash or 22-byte P2WPKH scriptPubKey (0014<20B>) and expand to P2PKH scriptCode
  if (clean.length === 40) {
    return Buffer.from(`76a914${clean}88ac`, 'hex');
  }
  if (clean.length === 44 && clean.startsWith('0014')) {
    return Buffer.from(`76a914${clean.slice(4)}88ac`, 'hex');
  }
  return Buffer.from(clean, 'hex');
}

function readVarInt(buf: Buffer, state: { pos: number }): number {
  if (state.pos >= buf.length) {
    throw new Error('ERR_INVALID_RAW_TX: Bitcoin varint EOF');
  }
  const first = buf[state.pos++];
  if (first < 0xfd) return first;
  if (first === 0xfd) {
    if (state.pos + 2 > buf.length) throw new Error('ERR_INVALID_RAW_TX: Bitcoin varint OOB');
    const v = buf.readUInt16LE(state.pos);
    state.pos += 2;
    return v;
  }
  if (first === 0xfe) {
    if (state.pos + 4 > buf.length) throw new Error('ERR_INVALID_RAW_TX: Bitcoin varint OOB');
    const v = buf.readUInt32LE(state.pos);
    state.pos += 4;
    return v;
  }
  throw new Error('ERR_INVALID_RAW_TX: Unsupported 64-bit varint');
}

function writeVarInt(n: number): Buffer {
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) {
    const b = Buffer.alloc(3);
    b[0] = 0xfd;
    b.writeUInt16LE(n, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b[0] = 0xfe;
  b.writeUInt32LE(n, 1);
  return b;
}

function classifyScript(scriptHex: string): BitcoinOutput['scriptType'] {
  if (scriptHex.startsWith('0014') && scriptHex.length === 44) return 'P2WPKH';
  if (scriptHex.startsWith('0020') && scriptHex.length === 68) return 'P2WSH';
  if (scriptHex.startsWith('5120') && scriptHex.length === 68) return 'P2TR';
  if (scriptHex.startsWith('76a914') && scriptHex.endsWith('88ac') && scriptHex.length === 50) return 'P2PKH';
  if (scriptHex.startsWith('a914') && scriptHex.endsWith('87') && scriptHex.length === 46) return 'P2SH';
  if (scriptHex.startsWith('6a')) return 'OP_RETURN';
  return 'UNKNOWN';
}

export function decodeUnsignedBitcoinTx(
  rawUnsignedHex: string,
  bip143?: Bip143InputContext
): DecodedBitcoinTx {
  const clean = strip0x(rawUnsignedHex).trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error('ERR_INVALID_RAW_TX: Invalid Bitcoin hex');
  }
  const buf = Buffer.from(clean, 'hex');
  if (buf.length < 10) {
    throw new Error('ERR_INVALID_RAW_TX: Bitcoin tx too short');
  }

  const state = { pos: 0 };
  const versionBytes = buf.subarray(0, 4);
  const version = buf.readInt32LE(state.pos);
  state.pos += 4;

  let isSegwit = false;
  if (buf[state.pos] === 0x00 && buf[state.pos + 1] === 0x01) {
    isSegwit = true;
    state.pos += 2;
  }

  const inputCount = readVarInt(buf, state);
  if (inputCount === 0) {
    throw new Error('ERR_INVALID_RAW_TX: Bitcoin tx has no inputs');
  }
  const outpoints: Buffer[] = [];
  const sequences: Buffer[] = [];
  for (let i = 0; i < inputCount; i++) {
    if (state.pos + 36 > buf.length) throw new Error('ERR_INVALID_RAW_TX: Bitcoin input OOB');
    outpoints.push(buf.subarray(state.pos, state.pos + 36));
    state.pos += 36; // prev txid (32) + vout (4)
    const scriptLen = readVarInt(buf, state);
    if (state.pos + scriptLen + 4 > buf.length) {
      throw new Error('ERR_INVALID_RAW_TX: Bitcoin scriptSig OOB');
    }
    state.pos += scriptLen; // scriptSig
    sequences.push(buf.subarray(state.pos, state.pos + 4));
    state.pos += 4; // sequence
  }

  const voutCount = readVarInt(buf, state);
  const outputs: BitcoinOutput[] = [];
  let totalSats = 0n;
  const outputsStart = state.pos;

  for (let i = 0; i < voutCount; i++) {
    if (state.pos + 8 > buf.length) throw new Error('ERR_INVALID_RAW_TX: Bitcoin output value OOB');
    const valueSats = buf.readBigUInt64LE(state.pos);
    state.pos += 8;
    const scriptLen = readVarInt(buf, state);
    if (state.pos + scriptLen > buf.length) {
      throw new Error('ERR_INVALID_RAW_TX: Bitcoin output script OOB');
    }
    const scriptPubKeyHex = buf.subarray(state.pos, state.pos + scriptLen).toString('hex');
    state.pos += scriptLen;
    totalSats += valueSats;
    outputs.push({
      index: i,
      valueSats: valueSats.toString(),
      scriptPubKeyHex,
      scriptType: classifyScript(scriptPubKeyHex)
    });
  }
  const outputsRawSlice = buf.subarray(outputsStart, state.pos);

  if (voutCount === 0) {
    throw new Error('ERR_INVALID_RAW_TX: Bitcoin tx has no outputs');
  }

  if (isSegwit) {
    for (let i = 0; i < inputCount; i++) {
      const stackCount = readVarInt(buf, state);
      for (let j = 0; j < stackCount; j++) {
        const itemLen = readVarInt(buf, state);
        state.pos += itemLen;
        if (state.pos > buf.length) {
          throw new Error('ERR_INVALID_RAW_TX: Bitcoin witness OOB');
        }
      }
    }
  }

  if (state.pos + 4 !== buf.length) {
    throw new Error('ERR_INVALID_RAW_TX: Bitcoin locktime/trailing bytes invalid');
  }
  const locktimeBytes = buf.subarray(state.pos, state.pos + 4);

  if (bip143) {
    if (!Number.isInteger(bip143.inputIndex) || bip143.inputIndex < 0 || bip143.inputIndex >= inputCount) {
      throw new Error('ERR_INVALID_RAW_TX: BIP-143 inputIndex out of bounds');
    }
    const prevoutValue = BigInt(bip143.prevoutValueSats);
    if (prevoutValue < 0n || prevoutValue > 0xffffffffffffffffn) {
      throw new Error('ERR_INVALID_RAW_TX: BIP-143 prevoutValueSats out of range');
    }
    const scriptCode = normalizeBip143ScriptCode(bip143.scriptCodeHex);
    const scriptCodeWithLen = Buffer.concat([writeVarInt(scriptCode.length), scriptCode]);
    const valueBuf = Buffer.alloc(8);
    valueBuf.writeBigUInt64LE(prevoutValue, 0);
    const sighashAllBuf = Buffer.from([0x01, 0x00, 0x00, 0x00]);

    const hashPrevouts = doubleSha256(Buffer.concat(outpoints));
    const hashSequence = doubleSha256(Buffer.concat(sequences));
    const hashOutputs = doubleSha256(outputsRawSlice);

    const preimage = Buffer.concat([
      versionBytes,
      hashPrevouts,
      hashSequence,
      outpoints[bip143.inputIndex],
      scriptCodeWithLen,
      valueBuf,
      sequences[bip143.inputIndex],
      hashOutputs,
      locktimeBytes,
      sighashAllBuf
    ]);
    const sighashHex = doubleSha256(preimage).toString('hex');

    return {
      kind: 'bitcoin',
      version,
      isSegwit,
      inputCount,
      outputs,
      totalOutputSats: totalSats.toString(),
      rawUnsignedHex: `0x${clean}`,
      sighashPayloadHex: `0x${sighashHex}`,
      sighashAlgorithm: 'bip143',
      bip143InputIndex: bip143.inputIndex
    };
  }

  const doubleHash = doubleSha256(buf).toString('hex');

  return {
    kind: 'bitcoin',
    version,
    isSegwit,
    inputCount,
    outputs,
    totalOutputSats: totalSats.toString(),
    rawUnsignedHex: `0x${clean}`,
    sighashPayloadHex: `0x${doubleHash}`,
    sighashAlgorithm: 'raw-double-sha256'
  };
}

export function buildSampleUnsignedBtcTx(
  outputs: Array<{ valueSats: bigint; scriptPubKeyHex: string }>
): string {
  const parts: Buffer[] = [];
  const version = Buffer.alloc(4);
  version.writeInt32LE(2, 0);
  parts.push(version);

  // 1 dummy input
  parts.push(writeVarInt(1));
  parts.push(Buffer.alloc(32, 0xaa)); // prev txid
  const vout = Buffer.alloc(4);
  vout.writeUInt32LE(0, 0);
  parts.push(vout);
  parts.push(writeVarInt(0)); // empty scriptSig
  parts.push(Buffer.from('ffffffff', 'hex')); // sequence

  parts.push(writeVarInt(outputs.length));
  for (const out of outputs) {
    const val = Buffer.alloc(8);
    val.writeBigUInt64LE(out.valueSats, 0);
    const script = Buffer.from(strip0x(out.scriptPubKeyHex), 'hex');
    parts.push(val);
    parts.push(writeVarInt(script.length));
    parts.push(script);
  }

  parts.push(Buffer.alloc(4, 0)); // locktime
  return `0x${Buffer.concat(parts).toString('hex')}`;
}

