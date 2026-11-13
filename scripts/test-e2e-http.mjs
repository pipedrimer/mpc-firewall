#!/usr/bin/env node
/**
 * Starts the built Next.js server on isolated ports, exercises HTTP endpoints
 * end-to-end across both Demo Mode and Production-Hardened Mode (Admin Auth + Fail-Closed TEE),
 * asserts exact responses, and shuts down cleanly.
 */
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WEB_DIR = path.resolve(process.cwd(), 'apps', 'web');
const NEXT_BIN = path.resolve(WEB_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');

async function waitForHealth(baseUrl, proc, logs, timeoutMs = 25000) {
  const start = Date.now();
  let lastErr = 'unknown';
  while (Date.now() - start < timeoutMs) {
    if (proc.exitCode !== null) {
      throw new Error(`Next.js server exited prematurely with code ${proc.exitCode}:\n${logs.join('')}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return await res.json();
      lastErr = `HTTP ${res.status}: ${await res.text()}`;
    } catch (err) {
      lastErr = err instanceof Error ? `${err.message} (${err.cause ?? ''})` : String(err);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for Next.js server health (${lastErr}).\nLogs:\n${logs.join('')}`);
}

async function runWithServer(port, extraEnv, fn) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-fw-e2e-'));
  const logs = [];
  const proc = spawn(process.execPath, [NEXT_BIN, 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: WEB_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MPC_FIREWALL_DATA_DIR: tempDataDir,
      ...extraEnv
    }
  });
  proc.stdout.on('data', (d) => logs.push(d.toString()));
  proc.stderr.on('data', (d) => logs.push(d.toString()));

  try {
    const health = await waitForHealth(baseUrl, proc, logs);
    await fn(baseUrl, health);
  } finally {
    proc.kill();
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
}

async function main() {
  // Suite 1: Standard Judge / Local Demo Mode (deterministic local enclave)
  await runWithServer(3199, { MPC_FIREWALL_ADMIN_TOKEN: '', REQUIRE_ADMIN_AUTH: 'false', STRICT_LIVE_TEE: 'false', NEARAI_API_KEY: '' }, async (baseUrl, health) => {
    assert.equal(health.data.service, 'mpc-firewall');
    assert.equal(health.data.status, 'ok');
    assert.equal(health.data.adminAuthEnabled, false);

    const homeRes = await fetch(`${baseUrl}/`);
    assert.equal(homeRes.status, 200);
    const html = await homeRes.text();
    assert.ok(html.includes('MpcFirewall'));

    const presetsRes = await fetch(`${baseUrl}/api/presets`);
    assert.equal(presetsRes.status, 200);
    const presetsJson = await presetsRes.json();
    const presets = presetsJson.data.presets;
    assert.equal(presets.length, 7);

    // 1. Safe Base USDC transfer -> APPROVED_FOR_MPC_SIGN
    const safeRes = await fetch(`${baseUrl}/api/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainKind: presets[0].chainKind,
        rawUnsignedHex: presets[0].rawUnsignedHex,
        agentIntent: presets[0].agentIntent
      })
    });
    assert.equal(safeRes.status, 200);
    const safeJson = await safeRes.json();
    assert.equal(safeJson.data.record.decision.outcome, 'APPROVED_FOR_MPC_SIGN');
    assert.ok(safeJson.data.record.mpcDispatch);

    // 1b. Replay of identical safe tx -> BLOCKED (ERR_REPLAY_DETECTED)
    const replayRes = await fetch(`${baseUrl}/api/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainKind: presets[0].chainKind,
        rawUnsignedHex: presets[0].rawUnsignedHex,
        agentIntent: presets[0].agentIntent
      })
    });
    assert.equal(replayRes.status, 200);
    const replayJson = await replayRes.json();
    assert.equal(replayJson.data.record.decision.outcome, 'BLOCKED');
    assert.ok(replayJson.data.record.decision.codes.includes('ERR_REPLAY_DETECTED'));

    // 2. Unlimited Approve Attack -> BLOCKED
    const attackRes = await fetch(`${baseUrl}/api/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainKind: presets[1].chainKind,
        rawUnsignedHex: presets[1].rawUnsignedHex,
        agentIntent: presets[1].agentIntent
      })
    });
    const attackJson = await attackRes.json();
    assert.equal(attackJson.data.record.decision.outcome, 'BLOCKED');
    assert.ok(attackJson.data.record.decision.codes.includes('ERR_UNLIMITED_APPROVAL'));

    // 3. Nested multicall drain -> BLOCKED
    const mcRes = await fetch(`${baseUrl}/api/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainKind: presets[2].chainKind,
        rawUnsignedHex: presets[2].rawUnsignedHex,
        agentIntent: presets[2].agentIntent
      })
    });
    const mcJson = await mcRes.json();
    assert.equal(mcJson.data.record.decision.outcome, 'BLOCKED');
    assert.ok(mcJson.data.record.decision.codes.includes('ERR_NESTED_MULTICALL_VIOLATION'));

    // 4. Escalate 250 USDC -> ESCALATE_TO_DAO
    const daoRes = await fetch(`${baseUrl}/api/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainKind: presets[5].chainKind,
        rawUnsignedHex: presets[5].rawUnsignedHex,
        agentIntent: presets[5].agentIntent
      })
    });
    const daoJson = await daoRes.json();
    assert.equal(daoJson.data.record.decision.outcome, 'ESCALATE_TO_DAO');
    assert.equal(daoJson.data.record.daoProposalPayload.methodName, 'add_proposal');
  });

  // Suite 2: Hardened Production Mode (Admin Auth + Fail-Closed STRICT_LIVE_TEE)
  await runWithServer(
    3200,
    {
      MPC_FIREWALL_ADMIN_TOKEN: 'prod-secret-token-xyz',
      REQUIRE_ADMIN_AUTH: 'true',
      STRICT_LIVE_TEE: 'true',
      NEARAI_API_KEY: ''
    },
    async (baseUrl, health) => {
      assert.equal(health.data.adminAuthEnabled, true);
      assert.equal(health.data.strictLiveTee, true);

      // Unauthenticated PATCH /api/policy must return 401
      const unauthPatch = await fetch(`${baseUrl}/api/policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowUnlimitedApprovals: true })
      });
      assert.equal(unauthPatch.status, 401);

      // Unauthenticated POST /api/policy reset must return 401
      const unauthReset = await fetch(`${baseUrl}/api/policy`, { method: 'POST' });
      assert.equal(unauthReset.status, 401);

      // Authenticated PATCH /api/policy succeeds (200)
      const authPatch = await fetch(`${baseUrl}/api/policy`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'prod-secret-token-xyz'
        },
        body: JSON.stringify({ maxBtcOutputSats: '50000' })
      });
      assert.equal(authPatch.status, 200);
      const authJson = await authPatch.json();
      assert.equal(authJson.data.policy.maxBtcOutputSats, '50000');

      // Fail-closed TEE check: without NEARAI_API_KEY in STRICT_LIVE_TEE=true, /api/inspect blocks!
      const presetsRes = await fetch(`${baseUrl}/api/presets`);
      const presets = (await presetsRes.json()).data.presets;
      const strictInspect = await fetch(`${baseUrl}/api/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainKind: presets[0].chainKind,
          rawUnsignedHex: presets[0].rawUnsignedHex,
          agentIntent: presets[0].agentIntent
        })
      });
      assert.equal(strictInspect.status, 200);
      const strictJson = await strictInspect.json();
      assert.equal(strictJson.data.record.decision.outcome, 'BLOCKED');
      assert.ok(strictJson.data.record.decision.codes.includes('ERR_TEE_UNAVAILABLE'));
    }
  );

  console.log('✅ Live Next.js HTTP E2E checks passed across Demo Mode & Hardened Production Mode (401 auth, replay block, fail-closed TEE).');
}

main().catch((err) => {
  console.error('❌ HTTP E2E check failed:', err);
  process.exit(1);
});
