import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';
import {
  APPROVED_BTC_P2WPKH_SCRIPT,
  APPROVED_VENDOR_ADDRESS,
  buildSampleUnsignedBtcTx,
  decodeUnsignedBitcoinTx,
  decodeUnsignedEvmTx,
  evaluateFirewallPolicy,
  FirewallService,
  getDefaultFirewallPolicy,
  runConfidentialTeeAudit
} from '../src/index.js';
import { authorizeAdminRequest } from '../src/security/adminAuth.js';

const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const VENDOR = '0x1111111111111111111111111111111111111111';
const DRAINER = '0xdead00000000000000000000000000000000beef';

describe('hardening: fail-closed TEE, Permit2/ERC2612, daily native cap, concurrency & admin auth', () => {
  it('fails closed in strictLiveTee mode when NEARAI_API_KEY is absent', async () => {
    const prevKey = process.env.NEARAI_API_KEY;
    delete process.env.NEARAI_API_KEY;
    try {
      const tx = ethers.Transaction.from({
        type: 2,
        chainId: 8453,
        nonce: 1,
        maxPriorityFeePerGas: 1_000_000n,
        maxFeePerGas: 20_000_000n,
        gasLimit: 21_000n,
        to: VENDOR,
        value: 1_000_000_000_000_000n,
        data: '0x'
      });
      const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);
      const policy = getDefaultFirewallPolicy();
      const decision = evaluateFirewallPolicy(decoded, policy, '0');

      await assert.rejects(
        () =>
          runConfidentialTeeAudit({
            agentIntent: 'Send 0.001 ETH',
            decoded,
            deterministicDecision: decision,
            strictLiveTee: true
          }),
        /ERR_TEE_UNAVAILABLE/
      );
    } finally {
      if (prevKey !== undefined) process.env.NEARAI_API_KEY = prevKey;
    }
  });

  it('decodes EIP-2612 permit(owner, spender, value, deadline, v, r, s) and blocks unlimited value', () => {
    const iface = new ethers.Interface([
      'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)'
    ]);
    const data = iface.encodeFunctionData('permit', [
      VENDOR,
      DRAINER,
      ethers.MaxUint256,
      1_900_000_000n,
      27,
      '0x' + '11'.repeat(32),
      '0x' + '22'.repeat(32)
    ]);
    const tx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 2,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 90_000n,
      to: USDC_BASE,
      value: 0n,
      data
    });

    const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);
    assert.equal(decoded.rootCall.action, 'ERC20_PERMIT');
    assert.equal(decoded.rootCall.spenderOrOperator, DRAINER);

    const decision = evaluateFirewallPolicy(decoded, getDefaultFirewallPolicy(), '0');
    assert.equal(decision.outcome, 'BLOCKED');
    assert.ok(decision.codes.includes('ERR_UNLIMITED_APPROVAL'));
    assert.ok(decision.codes.includes('ERR_BLOCKED_ADDRESS'));
  });

  it('enforces cumulative daily native wei cap across sequential dispatches and rejects exact tx replays', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-fw-hard-'));
    const svc = new FirewallService({ dataDir: dir, forceLocalEnclave: true });
    svc.updatePolicy({
      autoApproveNativeValueWei: '100000000000000000', // 0.1 ETH
      maxNativeValueWei: '100000000000000000',
      maxDailyNativeWei: '150000000000000000' // 0.15 ETH/day
    });

    const makeNativeTx = (nonce: number, valueWei: bigint) =>
      ethers.Transaction.from({
        type: 2,
        chainId: 8453,
        nonce,
        maxPriorityFeePerGas: 1_000_000n,
        maxFeePerGas: 20_000_000n,
        gasLimit: 21_000n,
        to: VENDOR,
        value: valueWei,
        data: '0x'
      }).unsignedSerialized;

    const tx1 = makeNativeTx(1, 80_000_000_000_000_000n); // 0.08 ETH
    const r1 = await svc.inspectAndDispatch({
      chainKind: 'evm',
      rawUnsignedHex: tx1,
      agentIntent: 'Payout #1'
    });
    assert.equal(r1.decision.outcome, 'APPROVED_FOR_MPC_SIGN');

    // Exact replay of tx1 must be blocked!
    const replay = await svc.inspectAndDispatch({
      chainKind: 'evm',
      rawUnsignedHex: tx1,
      agentIntent: 'Replay tx1'
    });
    assert.equal(replay.decision.outcome, 'BLOCKED');
    assert.ok(replay.decision.codes.includes('ERR_REPLAY_DETECTED'));

    // Second 0.08 ETH tx exceeds 0.15 ETH daily native cap!
    const tx2 = makeNativeTx(2, 80_000_000_000_000_000n);
    const r2 = await svc.inspectAndDispatch({
      chainKind: 'evm',
      rawUnsignedHex: tx2,
      agentIntent: 'Payout #2'
    });
    assert.equal(r2.decision.outcome, 'BLOCKED');
    assert.ok(r2.decision.codes.includes('ERR_DAILY_NATIVE_CAP_EXCEEDED'));
  });

  it('serializes concurrent inspectAndDispatch calls so daily cap cannot be raced', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-fw-race-'));
    const svc = new FirewallService({ dataDir: dir, forceLocalEnclave: true });
    svc.updatePolicy({
      autoApproveTokenUnits: '100000000',
      maxTokenAmountUnits: '100000000',
      maxDailyTokenUnits: '150000000' // 150 USDC daily max
    });

    const erc20 = new ethers.Interface(['function transfer(address to, uint256 amount)']);
    const makeTransfer = (nonce: number) =>
      ethers.Transaction.from({
        type: 2,
        chainId: 8453,
        nonce,
        maxPriorityFeePerGas: 1_000_000n,
        maxFeePerGas: 20_000_000n,
        gasLimit: 65_000n,
        to: USDC_BASE,
        value: 0n,
        data: erc20.encodeFunctionData('transfer', [VENDOR, 80_000_000n]) // 80 USDC each
      }).unsignedSerialized;

    const [a, b] = await Promise.all([
      svc.inspectAndDispatch({ chainKind: 'evm', rawUnsignedHex: makeTransfer(1), agentIntent: 'Concurrent A' }),
      svc.inspectAndDispatch({ chainKind: 'evm', rawUnsignedHex: makeTransfer(2), agentIntent: 'Concurrent B' })
    ]);

    const outcomes = [a.decision.outcome, b.decision.outcome].sort();
    assert.deepEqual(outcomes, ['APPROVED_FOR_MPC_SIGN', 'BLOCKED']);
    assert.equal(svc.getDailyTokenSpentUnits(), '80000000');
  });

  it('enforces constant-time admin auth and fail-closed requireAdminAuth mode', () => {
    const noTokenStrict = authorizeAdminRequest(new Headers(), {
      adminToken: '',
      requireAdminAuth: true
    });
    assert.equal(noTokenStrict.authorized, false);
    assert.equal(noTokenStrict.status, 503);

    const wrongToken = authorizeAdminRequest(new Headers({ authorization: 'Bearer wrong' }), {
      adminToken: 'super-secret-token-123',
      requireAdminAuth: true
    });
    assert.equal(wrongToken.authorized, false);
    assert.equal(wrongToken.status, 401);

    const validBearer = authorizeAdminRequest(
      new Headers({ authorization: 'Bearer super-secret-token-123' }),
      {
        adminToken: 'super-secret-token-123',
        requireAdminAuth: true
      }
    );
    assert.equal(validBearer.authorized, true);

    const validHeader = authorizeAdminRequest(
      new Headers({ 'x-admin-token': 'super-secret-token-123' }),
      {
        adminToken: 'super-secret-token-123',
        requireAdminAuth: true
      }
    );
    assert.equal(validHeader.authorized, true);
  });

  it('flags intent-vs-calldata semantic mismatch in local TEE enclave mode', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-fw-tee-mismatch-'));
    const service = new FirewallService({ dataDir: tmpDir, forceLocalEnclave: true });
    try {
      const tx = ethers.Transaction.from({
        type: 2,
        chainId: 8453,
        nonce: 1,
        maxFeePerGas: ethers.parseUnits('1', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('0.1', 'gwei'),
        gasLimit: 21_000n,
        to: APPROVED_VENDOR_ADDRESS,
        value: ethers.parseEther('0.01'),
        data: '0x'
      });

      const record = await service.inspectAndDispatch({
        chainKind: 'evm',
        rawUnsignedHex: tx.unsignedSerialized,
        agentIntent: 'Transfer 50 USDC on Ethereum Mainnet to vendor.'
      });

      assert.equal(record.teeAudit.riskLevel, 'CRITICAL');
      assert.equal(record.decision.outcome, 'BLOCKED');
      assert.ok(record.decision.codes.includes('ERR_TEE_CRITICAL_RISK'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('enforces cumulative daily Bitcoin satoshi cap across approved payouts', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-fw-btc-cap-'));
    const service = new FirewallService({ dataDir: tmpDir, forceLocalEnclave: true });
    try {
      for (let i = 1; i <= 5; i += 1) {
        const tx = buildSampleUnsignedBtcTx([
          { valueSats: 95_000n + BigInt(i), scriptPubKeyHex: APPROVED_BTC_P2WPKH_SCRIPT }
        ]);
        const res = await service.inspectAndDispatch({
          chainKind: 'bitcoin',
          rawUnsignedHex: tx,
          agentIntent: `Pay ${95_000 + i} sats to approved BTC vendor.`
        });
        assert.equal(res.decision.outcome, 'APPROVED_FOR_MPC_SIGN');
      }

      const tx6 = buildSampleUnsignedBtcTx([
        { valueSats: 95_006n, scriptPubKeyHex: APPROVED_BTC_P2WPKH_SCRIPT }
      ]);
      const r6 = await service.inspectAndDispatch({
        chainKind: 'bitcoin',
        rawUnsignedHex: tx6,
        agentIntent: 'Pay 95006 sats to approved BTC vendor.'
      });
      assert.equal(r6.decision.outcome, 'BLOCKED');
      assert.ok(r6.decision.codes.includes('ERR_DAILY_BTC_CAP_EXCEEDED'));
      assert.equal(service.getDailyBtcSatsSpent(), String(95_001 + 95_002 + 95_003 + 95_004 + 95_005));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('routes FirewallService storage to os.tmpdir() cleanly when NETLIFY env is set', async () => {
    const prevNetlify = process.env.NETLIFY;
    process.env.NETLIFY = 'true';
    try {
      const service = new FirewallService({ dataDir: '/nonexistent-ro-root/.mpc-firewall-data', forceLocalEnclave: true });
      service.resetDemoState();
      const rawBtc = buildSampleUnsignedBtcTx([
        { valueSats: 10_000n, scriptPubKeyHex: APPROVED_BTC_P2WPKH_SCRIPT }
      ]);
      const record = await service.inspectAndDispatch({
        chainKind: 'bitcoin',
        rawUnsignedHex: rawBtc,
        agentIntent: 'Pay 10000 sats to approved BTC vendor.'
      });
      assert.equal(record.decision.outcome, 'APPROVED_FOR_MPC_SIGN');
      service.resetDemoState();
    } finally {
      if (prevNetlify === undefined) {
        delete process.env.NETLIFY;
      } else {
        process.env.NETLIFY = prevNetlify;
      }
    }
  });

  it('computes real BIP-143 P2WPKH sighash preimage and rejects out-of-bounds inputIndex', () => {
    const rawBtc = buildSampleUnsignedBtcTx([
      { valueSats: 42_000n, scriptPubKeyHex: APPROVED_BTC_P2WPKH_SCRIPT }
    ]);

    const legacyDecoded = decodeUnsignedBitcoinTx(rawBtc);
    assert.equal(legacyDecoded.sighashAlgorithm, 'raw-double-sha256');

    const bip143Decoded = decodeUnsignedBitcoinTx(rawBtc, {
      inputIndex: 0,
      prevoutValueSats: '100000',
      scriptCodeHex: APPROVED_BTC_P2WPKH_SCRIPT
    });
    assert.equal(bip143Decoded.sighashAlgorithm, 'bip143');
    assert.equal(bip143Decoded.bip143InputIndex, 0);
    assert.match(bip143Decoded.sighashPayloadHex, /^0x[0-9a-f]{64}$/);
    assert.notEqual(bip143Decoded.sighashPayloadHex, legacyDecoded.sighashPayloadHex);

    assert.throws(
      () =>
        decodeUnsignedBitcoinTx(rawBtc, {
          inputIndex: 3,
          prevoutValueSats: '100000',
          scriptCodeHex: APPROVED_BTC_P2WPKH_SCRIPT
        }),
      /out of bounds/i
    );
  });

  it('decodes Gnosis Safe execTransaction, blocks DELEGATECALL, and inspects inner CALL recursively', () => {
    const SAFE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const ZERO = '0x0000000000000000000000000000000000000000';
    const base = getDefaultFirewallPolicy();
    const policy = {
      ...base,
      allowedTargetContracts: [...base.allowedTargetContracts, SAFE]
    };

    const erc20 = new ethers.Interface(['function transfer(address to, uint256 amount)']);
    const safeIface = new ethers.Interface([
      'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)'
    ]);

    const innerCalldata = erc20.encodeFunctionData('transfer', [VENDOR, 25_000_000n]);
    const makeSafeTx = (nonce: number, op: number, innerTo: string, innerData: string) =>
      ethers.Transaction.from({
        type: 2,
        chainId: 8453,
        nonce,
        maxPriorityFeePerGas: 1_000_000n,
        maxFeePerGas: 20_000_000n,
        gasLimit: 180_000n,
        to: SAFE,
        value: 0n,
        data: safeIface.encodeFunctionData('execTransaction', [
          innerTo,
          0n,
          innerData,
          op,
          0n,
          0n,
          0n,
          ZERO,
          ZERO,
          '0x'
        ])
      }).unsignedSerialized;

    const delegatecallDecoded = decodeUnsignedEvmTx(makeSafeTx(1, 1, USDC_BASE, innerCalldata));
    assert.equal(delegatecallDecoded.rootCall.action, 'SAFE_EXEC_TRANSACTION');
    assert.equal(delegatecallDecoded.rootCall.operationType, 'DELEGATECALL');

    const delegateDecision = evaluateFirewallPolicy(delegatecallDecoded, policy, '0');
    assert.equal(delegateDecision.outcome, 'BLOCKED');
    assert.ok(delegateDecision.codes.includes('ERR_DELEGATECALL_BLOCKED'));

    const safeCallDecoded = decodeUnsignedEvmTx(makeSafeTx(2, 0, USDC_BASE, innerCalldata));
    const safeCallDecision = evaluateFirewallPolicy(safeCallDecoded, policy, '0');
    assert.equal(safeCallDecision.outcome, 'APPROVED_FOR_MPC_SIGN');
  });

  it('decodes Uniswap Permit2 approve and permit calls and blocks unlimited / blocked spenders', () => {
    const PERMIT2 = '0x000000000022d473030f116ddee9f6b43ac78ba3';
    const base = getDefaultFirewallPolicy();
    const policy = {
      ...base,
      allowedTargetContracts: [...base.allowedTargetContracts, PERMIT2]
    };
    const MAX_UINT160 = (1n << 160n) - 1n;

    const p2ApproveIface = new ethers.Interface([
      'function approve(address token, address spender, uint160 amount, uint48 expiration)'
    ]);
    const approveTx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 1,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 90_000n,
      to: PERMIT2,
      value: 0n,
      data: p2ApproveIface.encodeFunctionData('approve', [USDC_BASE, DRAINER, MAX_UINT160, 1_900_000_000])
    });

    const decodedApprove = decodeUnsignedEvmTx(approveTx.unsignedSerialized);
    assert.equal(decodedApprove.rootCall.action, 'PERMIT2_APPROVE');
    assert.equal(decodedApprove.rootCall.spenderOrOperator, DRAINER);
    const approveDecision = evaluateFirewallPolicy(decodedApprove, policy, '0');
    assert.equal(approveDecision.outcome, 'BLOCKED');
    assert.ok(approveDecision.codes.includes('ERR_UNLIMITED_APPROVAL'));
    assert.ok(approveDecision.codes.includes('ERR_BLOCKED_ADDRESS'));

    const p2PermitIface = new ethers.Interface([
      'function permit(address owner, tuple(tuple(address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature)'
    ]);
    const permitTx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 2,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 110_000n,
      to: PERMIT2,
      value: 0n,
      data: p2PermitIface.encodeFunctionData('permit', [
        VENDOR,
        {
          details: {
            token: USDC_BASE,
            amount: MAX_UINT160,
            expiration: 1_900_000_000,
            nonce: 0
          },
          spender: DRAINER,
          sigDeadline: 1_900_000_000n
        },
        '0x' + '11'.repeat(65)
      ])
    });

    const decodedPermit = decodeUnsignedEvmTx(permitTx.unsignedSerialized);
    assert.equal(decodedPermit.rootCall.action, 'PERMIT2_PERMIT');
    assert.equal(decodedPermit.rootCall.spenderOrOperator, DRAINER);
    const permitDecision = evaluateFirewallPolicy(decodedPermit, policy, '0');
    assert.equal(permitDecision.outcome, 'BLOCKED');
    assert.ok(permitDecision.codes.includes('ERR_UNLIMITED_APPROVAL'));
    assert.ok(permitDecision.codes.includes('ERR_BLOCKED_ADDRESS'));
  });

  it('decodes Uniswap UniversalRouter commands: blocks SWEEP to drainer and approves V3_SWAP_EXACT_IN to MSG_SENDER', () => {
    const UNIVERSAL_ROUTER = '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad';
    const MSG_SENDER = '0x0000000000000000000000000000000000000001';
    const base = getDefaultFirewallPolicy();
    const policy = {
      ...base,
      allowedTargetContracts: [...base.allowedTargetContracts, UNIVERSAL_ROUTER]
    };

    const abi = ethers.AbiCoder.defaultAbiCoder();
    const routerIface = new ethers.Interface([
      'function execute(bytes commands, bytes[] inputs)'
    ]);

    // 0x04 = SWEEP(address token, address recipient, uint256 amountMin)
    const sweepInput = abi.encode(['address', 'address', 'uint256'], [USDC_BASE, DRAINER, 1n]);
    const sweepTx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 1,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 220_000n,
      to: UNIVERSAL_ROUTER,
      value: 0n,
      data: routerIface.encodeFunctionData('execute', ['0x04', [sweepInput]])
    });

    const decodedSweep = decodeUnsignedEvmTx(sweepTx.unsignedSerialized);
    assert.equal(decodedSweep.rootCall.action, 'UNIVERSAL_ROUTER_EXECUTE');
    const sweepDecision = evaluateFirewallPolicy(decodedSweep, policy, '0');
    assert.equal(sweepDecision.outcome, 'BLOCKED');
    assert.ok(sweepDecision.codes.includes('ERR_BLOCKED_ADDRESS'));

    // 0x00 = V3_SWAP_EXACT_IN(address recipient, uint256 amountIn, uint256 amountOutMin, bytes path, bool payerIsUser)
    const swapInput = abi.encode(
      ['address', 'uint256', 'uint256', 'bytes', 'bool'],
      [MSG_SENDER, 25_000_000n, 1n, '0x' + 'aa'.repeat(43), true]
    );
    const swapTx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 2,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 240_000n,
      to: UNIVERSAL_ROUTER,
      value: 0n,
      data: routerIface.encodeFunctionData('execute', ['0x00', [swapInput]])
    });

    const decodedSwap = decodeUnsignedEvmTx(swapTx.unsignedSerialized);
    assert.equal(decodedSwap.rootCall.action, 'UNIVERSAL_ROUTER_EXECUTE');
    assert.equal(decodedSwap.rootCall.nestedCalls?.[0]?.action, 'UNIVERSAL_ROUTER_SWAP');
    const swapDecision = evaluateFirewallPolicy(decodedSwap, policy, '0');
    assert.equal(swapDecision.outcome, 'APPROVED_FOR_MPC_SIGN');
  });
});

