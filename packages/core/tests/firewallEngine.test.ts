import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { decodeUnsignedEvmTx } from '../src/decoders/evmDecoder.js';
import { buildSampleUnsignedBtcTx, decodeUnsignedBitcoinTx } from '../src/decoders/btcDecoder.js';
import { evaluateFirewallPolicy } from '../src/policy/firewallEngine.js';
import type { FirewallPolicy } from '../src/types.js';

const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const ROUTER_BASE = '0x2626664c2603336e57b271c5c0b26f421741e481';
const VENDOR = '0x1111111111111111111111111111111111111111';
const DRAINER = '0xdead00000000000000000000000000000000beef';

const basePolicy: FirewallPolicy = {
  id: 'default-agent-treasury',
  name: 'Base + BTC Treasury Guard',
  derivationPath: 'ethereum,agent-treasury-1',
  firewallContractId: 'mpc-firewall.testnet',
  mpcSignerContractId: 'v1.signer-prod.testnet',
  allowedChainIds: [8453, 84532, 42161],
  allowedTargetContracts: [USDC_BASE, ROUTER_BASE, VENDOR],
  blockedAddresses: [DRAINER],
  allowedRecipients: [VENDOR],
  maxNativeValueWei: '500000000000000000', // 0.5 ETH
  autoApproveNativeValueWei: '100000000000000000', // 0.1 ETH
  maxTokenAmountUnits: '500000000', // 500 USDC
  autoApproveTokenUnits: '100000000', // 100 USDC
  maxDailyTokenUnits: '1000000000', // 1000 USDC
  allowUnlimitedApprovals: false,
  allowSetApprovalForAll: false,
  allowUnknownSelectors: false,
  maxBtcOutputSats: '100000',
  allowedBtcOutputScripts: ['0014' + '11'.repeat(20)],
  requireTeeRiskCheck: true,
  daoAccount: 'mpc-firewall-council.sputnik-dao.near'
};

describe('policy/firewallEngine (Zero-Blind-Signing Enforcement)', () => {
  it('approves compliant Base USDC transfer within auto-approve cap', () => {
    const erc20 = new ethers.Interface(['function transfer(address to, uint256 amount)']);
    const tx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 1,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 65_000n,
      to: USDC_BASE,
      value: 0n,
      data: erc20.encodeFunctionData('transfer', [VENDOR, 25_000_000n])
    });

    const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);
    const decision = evaluateFirewallPolicy(decoded, basePolicy, '0');
    assert.equal(decision.outcome, 'APPROVED_FOR_MPC_SIGN');
    assert.deepEqual(decision.codes, []);
  });

  it('blocks ERC20 unlimited MaxUint256 approval', () => {
    const erc20 = new ethers.Interface(['function approve(address spender, uint256 amount)']);
    const tx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 2,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 65_000n,
      to: USDC_BASE,
      value: 0n,
      data: erc20.encodeFunctionData('approve', [DRAINER, ethers.MaxUint256])
    });

    const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);
    const decision = evaluateFirewallPolicy(decoded, basePolicy, '0');
    assert.equal(decision.outcome, 'BLOCKED');
    assert.ok(decision.codes.includes('ERR_UNLIMITED_APPROVAL'));
    assert.ok(decision.codes.includes('ERR_BLOCKED_ADDRESS'));
  });

  it('catches and blocks nested multicall drain attempt', () => {
    const router = new ethers.Interface(['function multicall(bytes[] data)']);
    const erc20 = new ethers.Interface([
      'function transfer(address to, uint256 amount)',
      'function approve(address spender, uint256 amount)'
    ]);
    const data = router.encodeFunctionData('multicall', [
      [
        erc20.encodeFunctionData('transfer', [VENDOR, 1_000_000n]),
        erc20.encodeFunctionData('approve', [VENDOR, ethers.MaxUint256])
      ]
    ]);
    const tx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 3,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 180_000n,
      to: ROUTER_BASE,
      value: 0n,
      data
    });

    const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);
    const decision = evaluateFirewallPolicy(decoded, basePolicy, '0');
    assert.equal(decision.outcome, 'BLOCKED');
    assert.ok(decision.codes.includes('ERR_NESTED_MULTICALL_VIOLATION'));
    assert.ok(decision.codes.includes('ERR_UNLIMITED_APPROVAL'));
  });

  it('blocks disallowed chainId (Ethereum Mainnet 1)', () => {
    const tx = ethers.Transaction.from({
      type: 2,
      chainId: 1,
      nonce: 1,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 21_000n,
      to: VENDOR,
      value: 1_000_000_000_000_000n,
      data: '0x'
    });

    const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);
    const decision = evaluateFirewallPolicy(decoded, basePolicy, '0');
    assert.equal(decision.outcome, 'BLOCKED');
    assert.ok(decision.codes.includes('ERR_CHAIN_ID_NOT_ALLOWED'));
  });

  it('blocks setApprovalForAll(operator, true)', () => {
    const nft = new ethers.Interface(['function setApprovalForAll(address operator, bool approved)']);
    const tx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 4,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 65_000n,
      to: USDC_BASE,
      value: 0n,
      data: nft.encodeFunctionData('setApprovalForAll', [VENDOR, true])
    });

    const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);
    const decision = evaluateFirewallPolicy(decoded, basePolicy, '0');
    assert.equal(decision.outcome, 'BLOCKED');
    assert.ok(decision.codes.includes('ERR_SET_APPROVAL_FOR_ALL_BLOCKED'));
  });

  it('escalates compliant 250 USDC transfer (> 100 autoApprove, <= 500 max) to Trezu / SputnikDAO', () => {
    const erc20 = new ethers.Interface(['function transfer(address to, uint256 amount)']);
    const tx = ethers.Transaction.from({
      type: 2,
      chainId: 8453,
      nonce: 5,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 20_000_000n,
      gasLimit: 65_000n,
      to: USDC_BASE,
      value: 0n,
      data: erc20.encodeFunctionData('transfer', [VENDOR, 250_000_000n])
    });

    const decoded = decodeUnsignedEvmTx(tx.unsignedSerialized);
    const decision = evaluateFirewallPolicy(decoded, basePolicy, '0');
    assert.equal(decision.outcome, 'ESCALATE_TO_DAO');
    assert.ok(decision.codes.includes('ERR_DAO_ESCALATION_REQUIRED'));
  });

  it('blocks Bitcoin tx sending to unapproved scriptPubKey or exceeding satoshi cap', () => {
    const evilScript = '0014' + '99'.repeat(20);
    const btcHex = buildSampleUnsignedBtcTx([{ valueSats: 250_000n, scriptPubKeyHex: evilScript }]);
    const decoded = decodeUnsignedBitcoinTx(btcHex);
    const decision = evaluateFirewallPolicy(decoded, basePolicy, '0');
    assert.equal(decision.outcome, 'BLOCKED');
    assert.ok(decision.codes.includes('ERR_BTC_OUTPUT_EXCEEDS_CAP'));
    assert.ok(decision.codes.includes('ERR_BTC_UNAPPROVED_OUTPUT_SCRIPT'));
  });
});

