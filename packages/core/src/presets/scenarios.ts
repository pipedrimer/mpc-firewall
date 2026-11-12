import { ethers } from 'ethers';
import { buildSampleUnsignedBtcTx } from '../decoders/btcDecoder.js';
import type { FirewallChainKind, FirewallPolicy } from '../types.js';

export const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
export const BASE_ROUTER_ADDRESS = '0x2626664c2603336e57b271c5c0b26f421741e481';
export const APPROVED_VENDOR_ADDRESS = '0x1111111111111111111111111111111111111111';
export const ATTACKER_DRAINER_ADDRESS = '0xdead00000000000000000000000000000000beef';
export const APPROVED_BTC_P2WPKH_SCRIPT = '0014' + '11'.repeat(20);
export const ATTACKER_BTC_P2WPKH_SCRIPT = '0014' + '99'.repeat(20);

export interface FirewallScenarioPreset {
  id: string;
  title: string;
  badge: 'SAFE' | 'ATTACK' | 'DAO_ESCALATION';
  chainKind: FirewallChainKind;
  agentIntent: string;
  description: string;
  rawUnsignedHex: string;
}

export function getDefaultFirewallPolicy(): FirewallPolicy {
  return {
    id: 'default-agent-treasury',
    name: 'Autonomous Base + Bitcoin Treasury Policy',
    derivationPath: 'ethereum,agent-treasury-1',
    firewallContractId: process.env.MPC_FIREWALL_CONTRACT_ID || 'mpc-firewall.testnet',
    mpcSignerContractId: process.env.MPC_SIGNER_CONTRACT_ID || 'v1.signer-prod.testnet',
    allowedChainIds: [8453, 84532, 42161, 11155111],
    allowedTargetContracts: [BASE_USDC_ADDRESS, BASE_ROUTER_ADDRESS, APPROVED_VENDOR_ADDRESS],
    blockedAddresses: [ATTACKER_DRAINER_ADDRESS],
    allowedRecipients: [APPROVED_VENDOR_ADDRESS],
    maxNativeValueWei: '500000000000000000', // 0.5 ETH
    autoApproveNativeValueWei: '100000000000000000', // 0.1 ETH
    maxDailyNativeWei: '1000000000000000000', // 1.0 ETH/day
    maxTokenAmountUnits: '500000000', // 500 USDC (6 decimals)
    autoApproveTokenUnits: '100000000', // 100 USDC
    maxDailyTokenUnits: '1000000000', // 1000 USDC
    allowUnlimitedApprovals: false,
    allowSetApprovalForAll: false,
    allowUnknownSelectors: false,
    maxBtcOutputSats: '100000',
    allowedBtcOutputScripts: [APPROVED_BTC_P2WPKH_SCRIPT],
    requireTeeRiskCheck: true,
    daoAccount: process.env.TREZU_DAO_ACCOUNT || 'mpc-firewall-council.sputnik-dao.near'
  };
}

export function buildPresetScenarios(): FirewallScenarioPreset[] {
  const erc20 = new ethers.Interface([
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)'
  ]);
  const nft = new ethers.Interface([
    'function setApprovalForAll(address operator, bool approved)'
  ]);
  const router = new ethers.Interface(['function multicall(bytes[] data) returns (bytes[])']);

  const safeTransfer = ethers.Transaction.from({
    type: 2,
    chainId: 8453,
    nonce: 12,
    maxPriorityFeePerGas: 1_000_000n,
    maxFeePerGas: 25_000_000n,
    gasLimit: 65_000n,
    to: BASE_USDC_ADDRESS,
    value: 0n,
    data: erc20.encodeFunctionData('transfer', [APPROVED_VENDOR_ADDRESS, 25_000_000n])
  });

  const unlimitedApprove = ethers.Transaction.from({
    type: 2,
    chainId: 8453,
    nonce: 13,
    maxPriorityFeePerGas: 1_000_000n,
    maxFeePerGas: 25_000_000n,
    gasLimit: 65_000n,
    to: BASE_USDC_ADDRESS,
    value: 0n,
    data: erc20.encodeFunctionData('approve', [ATTACKER_DRAINER_ADDRESS, ethers.MaxUint256])
  });

  const smuggledMulticall = ethers.Transaction.from({
    type: 2,
    chainId: 8453,
    nonce: 14,
    maxPriorityFeePerGas: 1_000_000n,
    maxFeePerGas: 25_000_000n,
    gasLimit: 180_000n,
    to: BASE_ROUTER_ADDRESS,
    value: 0n,
    data: router.encodeFunctionData('multicall', [
      [
        erc20.encodeFunctionData('transfer', [APPROVED_VENDOR_ADDRESS, 5_000_000n]),
        erc20.encodeFunctionData('approve', [APPROVED_VENDOR_ADDRESS, ethers.MaxUint256])
      ]
    ])
  });

  const wrongChainReplay = ethers.Transaction.from({
    type: 2,
    chainId: 1,
    nonce: 15,
    maxPriorityFeePerGas: 1_000_000n,
    maxFeePerGas: 25_000_000n,
    gasLimit: 21_000n,
    to: APPROVED_VENDOR_ADDRESS,
    value: 50_000_000_000_000_000n,
    data: '0x'
  });

  const nftBlanketApprove = ethers.Transaction.from({
    type: 2,
    chainId: 8453,
    nonce: 16,
    maxPriorityFeePerGas: 1_000_000n,
    maxFeePerGas: 25_000_000n,
    gasLimit: 65_000n,
    to: BASE_USDC_ADDRESS,
    value: 0n,
    data: nft.encodeFunctionData('setApprovalForAll', [APPROVED_VENDOR_ADDRESS, true])
  });

  const highValueEscalation = ethers.Transaction.from({
    type: 2,
    chainId: 8453,
    nonce: 17,
    maxPriorityFeePerGas: 1_000_000n,
    maxFeePerGas: 25_000_000n,
    gasLimit: 65_000n,
    to: BASE_USDC_ADDRESS,
    value: 0n,
    data: erc20.encodeFunctionData('transfer', [APPROVED_VENDOR_ADDRESS, 250_000_000n])
  });

  const btcDrainTx = buildSampleUnsignedBtcTx([
    { valueSats: 250_000n, scriptPubKeyHex: ATTACKER_BTC_P2WPKH_SCRIPT }
  ]);

  return [
    {
      id: 'safe-base-usdc',
      title: '1. Compliant Base USDC Vendor Payout (25 USDC)',
      badge: 'SAFE',
      chainKind: 'evm',
      agentIntent: 'Pay approved Base infrastructure vendor 25 USDC for RPC compute.',
      description: 'Valid EIP-1559 ERC-20 transfer on Base (8453) within autonomous cap (<= 100 USDC).',
      rawUnsignedHex: safeTransfer.unsignedSerialized
    },
    {
      id: 'attack-unlimited-approve',
      title: '2. Blind-Sign Attack: ERC-20 approve(drainer, MaxUint256)',
      badge: 'ATTACK',
      chainKind: 'evm',
      agentIntent: 'Claim routine gas rebate on Base.',
      description: 'Prompt-injected agent tries to pass a 32-byte keccak256 hash of unlimited USDC approval.',
      rawUnsignedHex: unlimitedApprove.unsignedSerialized
    },
    {
      id: 'attack-nested-multicall',
      title: '3. Smuggled Drain: Nested multicall(bytes[]) Hidden Approve',
      badge: 'ATTACK',
      chainKind: 'evm',
      agentIntent: 'Execute routine router batch transfer (5 USDC).',
      description: 'Outer call looks like a router multicall; inner element 1 hides MaxUint256 approve.',
      rawUnsignedHex: smuggledMulticall.unsignedSerialized
    },
    {
      id: 'attack-wrong-chain',
      title: '4. Cross-Chain Policy Bypass: Disallowed Ethereum Mainnet (chainId=1)',
      badge: 'ATTACK',
      chainKind: 'evm',
      agentIntent: 'Send 0.05 ETH on Base.',
      description: 'Agent claims Base tx, but RLP payload encodes chainId 1 (Ethereum Mainnet).',
      rawUnsignedHex: wrongChainReplay.unsignedSerialized
    },
    {
      id: 'attack-nft-approval',
      title: '5. Blanket NFT Drain: setApprovalForAll(true)',
      badge: 'ATTACK',
      chainKind: 'evm',
      agentIntent: 'Verify NFT collection ownership.',
      description: 'Hidden 0xa22cb465 selector attempts blanket NFT approval.',
      rawUnsignedHex: nftBlanketApprove.unsignedSerialized
    },
    {
      id: 'escalate-dao-250usdc',
      title: '6. Over-Limit Governance: 250 USDC Escalates to Trezu / SputnikDAO',
      badge: 'DAO_ESCALATION',
      chainKind: 'evm',
      agentIntent: 'Pay approved vendor 250 USDC milestone invoice on Base.',
      description: 'Safe transaction exceeding 100 USDC auto-cap cleanly escalates to DAO multisig.',
      rawUnsignedHex: highValueEscalation.unsignedSerialized
    },
    {
      id: 'attack-btc-hijack',
      title: '7. Bitcoin Raw-Tx Hijack: 250,000 sats to Unapproved Script',
      badge: 'ATTACK',
      chainKind: 'bitcoin',
      agentIntent: 'Consolidate 50,000 sats to treasury change address.',
      description: 'Raw unsigned Bitcoin transaction redirects 250,000 sats to an unapproved P2WPKH script.',
      rawUnsignedHex: btcDrainTx
    }
  ];
}

