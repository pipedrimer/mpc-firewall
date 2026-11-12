import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildPresetScenarios } from '../src/presets/scenarios.js';
import { FirewallService } from '../src/store/firewallService.js';
import { verifyLocalTeeAuditSignature } from '../src/integrations/nearAi.js';

describe('store/firewallService integration', () => {
  it('runs all 7 real presets with expected APPROVED / BLOCKED / ESCALATE_TO_DAO outcomes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-fw-svc-'));
    const svc = new FirewallService({ dataDir: dir, forceLocalEnclave: true });
    const presets = buildPresetScenarios();

    const safe = await svc.inspectAndDispatch({
      chainKind: presets[0].chainKind,
      rawUnsignedHex: presets[0].rawUnsignedHex,
      agentIntent: presets[0].agentIntent
    });
    assert.equal(safe.decision.outcome, 'APPROVED_FOR_MPC_SIGN');
    assert.ok(safe.mpcDispatch);
    assert.equal(safe.mpcDispatch.args.request.payload.length, 32);
    assert.equal(safe.teeAudit?.signatureVerified, true);
    assert.equal(verifyLocalTeeAuditSignature(safe.teeAudit!), true);
    assert.equal(svc.getDailyTokenSpentUnits(), '25000000');

    for (const attackIdx of [1, 2, 3, 4, 6]) {
      const p = presets[attackIdx];
      const blocked = await svc.inspectAndDispatch({
        chainKind: p.chainKind,
        rawUnsignedHex: p.rawUnsignedHex,
        agentIntent: p.agentIntent
      });
      assert.equal(blocked.decision.outcome, 'BLOCKED', `Expected ${p.id} to be BLOCKED`);
      assert.equal(blocked.mpcDispatch, undefined);
      assert.equal(blocked.teeAudit?.riskLevel, 'CRITICAL');
    }

    const escalated = await svc.inspectAndDispatch({
      chainKind: presets[5].chainKind,
      rawUnsignedHex: presets[5].rawUnsignedHex,
      agentIntent: presets[5].agentIntent
    });
    assert.equal(escalated.decision.outcome, 'ESCALATE_TO_DAO');
    assert.equal(escalated.mpcDispatch, undefined);
    assert.equal(escalated.daoProposalPayload?.methodName, 'add_proposal');
  });
});

