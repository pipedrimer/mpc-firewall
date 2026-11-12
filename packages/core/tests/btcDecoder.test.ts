import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSampleUnsignedBtcTx, decodeUnsignedBitcoinTx } from '../src/decoders/btcDecoder.js';

describe('decoders/btcDecoder', () => {
  it('decodes raw unsigned Bitcoin tx outputs, satoshi values, and script types', () => {
    const p2wpkhScript = '0014' + '11'.repeat(20);
    const rawHex = buildSampleUnsignedBtcTx([
      { valueSats: 50_000n, scriptPubKeyHex: p2wpkhScript },
      { valueSats: 900_000n, scriptPubKeyHex: '0014' + '22'.repeat(20) }
    ]);

    const decoded = decodeUnsignedBitcoinTx(rawHex);
    assert.equal(decoded.kind, 'bitcoin');
    assert.equal(decoded.outputs.length, 2);
    assert.equal(decoded.outputs[0].valueSats, '50000');
    assert.equal(decoded.outputs[0].scriptType, 'P2WPKH');
    assert.equal(decoded.totalOutputSats, '950000');
    assert.match(decoded.sighashPayloadHex, /^0x[0-9a-f]{64}$/);
  });
});

