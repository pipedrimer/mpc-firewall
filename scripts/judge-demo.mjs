#!/usr/bin/env node
/**
 * MpcFirewall — Deterministic Judge Verification Script ("Do X -> See Y")
 *
 * Exercises all 7 real unsigned EVM (EIP-1559 RLP + ABI) & Bitcoin raw-tx presets
 * against @mpc-firewall/core and asserts exact APPROVED / BLOCKED / ESCALATE_TO_DAO
 * cryptographic outputs.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildPresetScenarios, FirewallService, verifyLocalTeeAuditSignature } from '../packages/core/dist/index.js';

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-firewall-judge-'));
  const service = new FirewallService({ dataDir, forceLocalEnclave: true });
  const presets = buildPresetScenarios();

  console.log('=== MpcFirewall Deterministic Judge Verification ===\n');

  const expected = {
    'safe-base-usdc': 'APPROVED_FOR_MPC_SIGN',
    'attack-unlimited-approve': 'BLOCKED',
    'attack-nested-multicall': 'BLOCKED',
    'attack-wrong-chain': 'BLOCKED',
    'attack-nft-approval': 'BLOCKED',
    'escalate-dao-250usdc': 'ESCALATE_TO_DAO',
    'attack-btc-hijack': 'BLOCKED'
  };

  for (const preset of presets) {
    const result = await service.inspectAndDispatch({
      chainKind: preset.chainKind,
      rawUnsignedHex: preset.rawUnsignedHex,
      agentIntent: preset.agentIntent
    });

    const want = expected[preset.id];
    const got = result.decision.outcome;
    const sigOk = result.teeAudit ? verifyLocalTeeAuditSignature(result.teeAudit) : false;

    console.log(`[${preset.id}]`);
    console.log(
      JSON.stringify(
        {
          chainKind: result.decoded.kind,
          sighashPayloadHex: result.decoded.sighashPayloadHex,
          outcome: got,
          codes: result.decision.codes,
          teeSignatureVerified: sigOk,
          mpcDispatchGenerated: Boolean(result.mpcDispatch),
          daoProposalGenerated: Boolean(result.daoProposalPayload)
        },
        null,
        2
      )
    );

    if (got !== want || !sigOk) {
      console.error(`\n❌ Assertion failed for ${preset.id}: expected ${want}, got ${got} (sigOk=${sigOk})`);
      process.exit(1);
    }
  }

  console.log(`\n✅ All ${presets.length} MpcFirewall scenarios verified. Daily spent: ${service.getDailyTokenSpentUnits()} units.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

