'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { FirewallEvaluationRecord, FirewallPolicy } from '@mpc-firewall/core';
import type { ScenarioPresetView } from '@/components/TxWorkbench';
import { LiveTestnetExecutePanel } from '@/components/LiveTestnetExecutePanel';
import {
  InteractiveXRayStage,
  type ScenarioStoryMeta
} from '@/components/InteractiveXRayStage';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Code2,
  Cpu,
  Landmark,
  Lock,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

interface VisualStoryViewProps {
  presets: ScenarioPresetView[];
  selectedPresetId: string;
  onSelectPreset: (preset: ScenarioPresetView) => void;
  record: FirewallEvaluationRecord | null;
  policy: FirewallPolicy | null;
  savingPolicy?: boolean;
  onTogglePolicy?: (patch: Partial<FirewallPolicy>) => void;
  onResetPolicy?: () => void;
  isTamperedSimulation?: boolean;
  onTamperSimulation?: (injectTrap: boolean) => void;
  loading: boolean;
  scanPulseId?: number;
  lastScanDurationMs?: number | null;
  onInspect: () => void;
}

const STORY_MAP: Record<string, ScenarioStoryMeta> = {
  'safe-base-usdc': {
    index: '01',
    shortLabel: '$25 Server Bill',
    humanTitle: 'The $25 Server Bill',
    plainSummary: 'Routine $25 USDC vendor payment on Base within the $100 automatic limit.',
    assistantClaim: 'Pay approved Base infrastructure vendor 25 USDC for server compute.',
    hiddenReality: 'Clean 25 USDC transfer to your approved vendor address.',
    withoutResult: 'Signed normally ($25.00 sent)',
    withResult: '$25.00 USDC verified & signed safely via v1.signer',
    dollarBadge: '$25 Approved',
    illustration: '/illustrations/hero-xray.jpg',
    networkLabel: 'Base • 8453'
  },
  'attack-unlimited-approve': {
    index: '02',
    shortLabel: 'Blank Check Trap',
    humanTitle: 'The Infinite Blank Check',
    plainSummary: 'Tricked assistant hides an unlimited token approval inside a routine rebate claim.',
    assistantClaim: 'Claim routine gas rebate on Base.',
    hiddenReality: 'Unlimited power-of-attorney check (MaxUint256) to a known drainer.',
    withoutResult: 'Unlimited USDC allowance granted to drainer',
    withResult: '$0.00 lost — blocked before reaching v1.signer',
    dollarBadge: 'Unlimited Drain Prevented',
    illustration: '/illustrations/blank-check.jpg',
    networkLabel: 'Base • 8453'
  },
  'attack-nested-multicall': {
    index: '03',
    shortLabel: 'Nesting Doll',
    humanTitle: 'The Russian Nesting Doll',
    plainSummary: 'Smuggles a wallet-draining approval inside a bundle of harmless transfers.',
    assistantClaim: 'Execute routine router batch transfer (5 USDC).',
    hiddenReality: 'Outer box transfers 5 USDC; inner nesting doll grants infinite access.',
    withoutResult: 'Surface filters fooled — unlimited USDC allowance drained',
    withResult: 'Unwrapped 2 layers deep & blocked at $0.00',
    dollarBadge: 'Unlimited Drain Prevented',
    illustration: '/illustrations/nesting-dolls.jpg',
    networkLabel: 'Base Router • 8453'
  },
  'attack-wrong-chain': {
    index: '04',
    shortLabel: 'Wrong Network',
    humanTitle: 'The Wrong-Network Switch',
    plainSummary: 'Claims to send funds on Base, but secretly targets Ethereum Mainnet.',
    assistantClaim: 'Send 0.05 ETH on Base.',
    hiddenReality: 'Transaction bytes actually target Ethereum Mainnet (chainId 1).',
    withoutResult: '0.05 ETH replayed on unauthorized network',
    withResult: '$0.00 lost — unauthorized network blocked cold',
    dollarBadge: '0.05 ETH Saved',
    illustration: '/illustrations/multichain-passport.jpg',
    networkLabel: 'Ethereum • Chain 1'
  },
  'attack-nft-approval': {
    index: '05',
    shortLabel: 'NFT Sweep',
    humanTitle: 'The NFT Collection Sweep',
    plainSummary: 'Disguises a blanket NFT collection handover as an ownership check.',
    assistantClaim: 'Verify NFT collection ownership.',
    hiddenReality: 'Calls setApprovalForAll(true) handing over every NFT in your vault.',
    withoutResult: '100% of vault NFTs swept in one click',
    withResult: '$0.00 lost — blanket NFT approval blocked',
    dollarBadge: 'Vault Protected',
    illustration: '/illustrations/blind-envelope.jpg',
    networkLabel: 'Base NFT • 8453'
  },
  'escalate-dao-250usdc': {
    index: '06',
    shortLabel: '$250 Team Vote',
    humanTitle: 'The $250 Team Milestone',
    plainSummary: 'Valid $250 vendor invoice above the $100 automatic cap asks humans to vote.',
    assistantClaim: 'Pay approved vendor 250 USDC milestone invoice on Base.',
    hiddenReality: 'Valid 250 USDC payment — above $100 auto-cap, within $500 hard cap.',
    withoutResult: '$250 spent without manager sign-off',
    withResult: 'Paused & routed to Trezu / SputnikDAO for human vote',
    dollarBadge: 'Team Vote Created',
    illustration: '/illustrations/three-lanes.jpg',
    networkLabel: 'Base • SputnikDAO'
  },
  'attack-btc-hijack': {
    index: '07',
    shortLabel: 'Bitcoin Redirect',
    humanTitle: 'The Bitcoin Redirect',
    plainSummary: 'Raw Bitcoin transaction diverts 250,000 satoshis to an unapproved address.',
    assistantClaim: 'Consolidate 50,000 sats to treasury change address.',
    hiddenReality: 'Redirects 250,000 sats (2.5x limit) to an unapproved Bitcoin script.',
    withoutResult: '250,000 satoshis stolen on Bitcoin',
    withResult: '0 sats lost — raw Bitcoin output blocked on NEAR',
    dollarBadge: '250k Sats Saved',
    illustration: '/illustrations/xray-conveyor.jpg',
    networkLabel: 'Bitcoin Raw Tx'
  }
};

const FALLBACK_META: ScenarioStoryMeta = {
  index: '01',
  shortLabel: 'Errand',
  humanTitle: 'AI Assistant Transaction',
  plainSummary: 'Inspect raw transaction bytes before NEAR Chain Signatures signs.',
  assistantClaim: 'Execute cross-chain transaction.',
  hiddenReality: 'Decoded on-chain in Rust WebAssembly.',
  withoutResult: 'Signed blindfolded by v1.signer',
  withResult: 'Verified on-chain before signing',
  dollarBadge: 'Protected',
  illustration: '/illustrations/hero-xray.jpg',
  networkLabel: 'Multi-Chain'
};

const ECOSYSTEM_INTEGRATIONS = [
  {
    name: 'Base',
    tag: 'EVM • Chain 8453',
    summary: 'Full EIP-1559 RLP, ERC-20 transfer/approve caps, and nested router calldata X-ray.'
  },
  {
    name: 'Ethereum & Sepolia',
    tag: 'EVM • Chains 1 / 11155111',
    summary: 'Prevents silent chain-ID swaps, drainer approvals, and blanket NFT sweeps.'
  },
  {
    name: 'Arbitrum One',
    tag: 'L2 • Chain 42161',
    summary: 'Enforces exact network allowlists and per-call spend budgets across L2 routes.'
  },
  {
    name: 'Bitcoin SegWit',
    tag: 'UTXO • BIP-143',
    summary: 'Inspects raw SegWit inputs, satoshi values, and output scripts inside Rust WASM.'
  },
  {
    name: 'Chain Signatures',
    tag: 'v1.signer-prod.testnet',
    summary: 'Deterministic pre-signing gate — unsafe payloads never trigger MPC threshold shares.'
  },
  {
    name: 'NEAR AI Cloud TEE',
    tag: 'Confidential Audit',
    summary: 'Compares natural-language agent intent against unpacked raw calldata semantics.'
  },
  {
    name: 'NEAR Intents 1Click',
    tag: 'Cross-Chain Swap API',
    summary: 'Supports verifiable confidential swap quotes alongside firewall inspection.'
  },
  {
    name: 'SputnikDAO / Trezu',
    tag: 'Human Multisig Lane',
    summary: 'Automatically routes mid-sized $100–$500 payouts to human council voting.'
  }
];

export function VisualStoryView({
  presets,
  selectedPresetId,
  onSelectPreset,
  record,
  policy,
  savingPolicy = false,
  onTogglePolicy,
  onResetPolicy,
  isTamperedSimulation = false,
  onTamperSimulation,
  loading,
  scanPulseId = 0,
  lastScanDurationMs = null,
  onInspect
}: VisualStoryViewProps) {
  const [showProofDrawer, setShowProofDrawer] = useState(false);
  const [filterBadge, setFilterBadge] = useState<'ALL' | 'SAFE' | 'DAO_ESCALATION' | 'ATTACK'>('ALL');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteOutput, setQuoteOutput] = useState<string | null>(null);

  const activePreset = presets.find((p) => p.id === selectedPresetId) || presets[0] || null;
  const activeMeta = (activePreset && STORY_MAP[activePreset.id]) || FALLBACK_META;

  const filteredPresets = presets.filter((p) =>
    filterBadge === 'ALL' ? true : p.badge === filterBadge
  );

  async function handlePreviewIntents() {
    setQuoteLoading(true);
    setQuoteOutput(null);
    try {
      const res = await fetch('/api/intents/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originAsset: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
          destinationAsset: 'nep141:wrap.near',
          amount: '25000000',
          recipient: 'mpc-firewall.near',
          refundTo: 'mpc-firewall.near',
          confidentiality: 'advanced'
        })
      });
      const json = await res.json();
      setQuoteOutput(JSON.stringify(json.data ?? json, null, 2));
    } catch (err) {
      setQuoteOutput(err instanceof Error ? err.message : 'Quote request failed');
    } finally {
      setQuoteLoading(false);
    }
  }

  return (
    <div>
      {/* =====================================================================
          BAND 1: PRIMARY HERO (CRISP WHITE EDITORIAL + LIVE 3D X-RAY STAGE)
         ===================================================================== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1365px] px-4 pt-8 pb-16 sm:px-8 lg:pt-12 lg:pb-24">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Left Column: Proof Pills + Display Hero + NEAR-Style Actions */}
            <div className="space-y-7 lg:col-span-5">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="https://testnet.nearblocks.io/address/mpc-firewall.testnet"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded border border-black/15 bg-[#F9F9FA] px-2.5 py-1 font-mono text-[11px] font-semibold text-black transition-colors hover:border-black hover:bg-white"
                >
                  <span className="h-2 w-2 rounded-full bg-[#00C758]" />
                  <span>mpc-firewall.testnet</span>
                  <ArrowUpRight className="h-3 w-3 text-[#525B6C]" />
                </a>
                <a
                  href="https://testnet.nearblocks.io/txns/9CMZemnkejMCCJHeUXHBtHp4A49T71aLyjoBBQ98ZxVN"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-[#00C758]/35 bg-[#F0FDF4] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#032E15] transition-colors hover:border-[#00C758]"
                >
                  <span>MPC TX: 9CMZem…8ZxVN</span>
                  <ArrowUpRight className="h-3 w-3" />
                </a>
                <a
                  href="https://testnet.nearblocks.io/address/mpc-firewall-council.sputnikv2.testnet"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-black/15 bg-[#F2F1E9] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#0B0F17] transition-colors hover:border-black"
                >
                  <span>sputnikv2 DAO</span>
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>

              <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] leading-[1.03] text-black sm:text-5xl xl:text-[56px]">
                Never let your AI assistant{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-[#1F3CFF] via-[#0B0F17] to-[#00A544] bg-clip-text text-transparent">
                    sign a sealed envelope.
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 left-0 right-0 h-2.5 rounded-sm bg-[#05DF72]/35"
                  />
                </span>
              </h1>

              <p className="max-w-[46ch] text-base leading-relaxed text-[#4A5568] sm:text-[18px]">
                Before your AI spends funds on Ethereum, Base, or Bitcoin, MpcFirewall X-rays the raw
                transaction bytes inside a deterministic NEAR contract and stops traps cold.
              </p>

              <div className="flex flex-col items-stretch gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={onInspect}
                  disabled={loading}
                  className="btn-roll group inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-black px-7 py-4 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1F3CFF] disabled:opacity-75 sm:w-auto"
                >
                  <span className="btn-roll-inner">
                    <span>
                      {loading
                        ? `X-Raying Errand ${activeMeta.index}…`
                        : `Scan Errand ${activeMeta.index} (${activeMeta.shortLabel})`}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-[#05DF72] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
                  </span>
                </button>

                <a
                  href="#scenarios"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-black/20 bg-white px-6 py-4 text-sm font-bold text-black transition-all hover:-translate-y-0.5 hover:border-black sm:w-auto"
                >
                  <span>Explore 7 Real Errands</span>
                  <ArrowRight className="h-4 w-4" />
                </a>

                <Link
                  href="/docs"
                  className="inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold text-[#4A5568] transition-colors hover:text-black sm:justify-start"
                >
                  <BookOpen className="h-3.5 w-3.5 text-[#1F3CFF]" />
                  <span>Read Docs</span>
                </Link>
              </div>
            </div>

            {/* Right Column: Tactile 3D Interactive Transaction X-Ray */}
            <div className="lg:col-span-7">
              <InteractiveXRayStage
                presets={presets}
                preset={activePreset}
                storyMap={STORY_MAP}
                meta={activeMeta}
                record={record}
                policy={policy}
                savingPolicy={savingPolicy}
                onTogglePolicy={onTogglePolicy}
                onResetPolicy={onResetPolicy}
                isTamperedSimulation={isTamperedSimulation}
                onTamperSimulation={onTamperSimulation}
                loading={loading}
                scanPulseId={scanPulseId}
                lastScanDurationMs={lastScanDurationMs}
                onSelectPreset={onSelectPreset}
                onInspect={onInspect}
              />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BAND 2: "WHAT IS MPCFIREWALL?" + 7-ERRAND LIVE SCENARIO MATRIX
         ===================================================================== */}
      <section className="border-t border-black/10 bg-[#F9F9FA]">
        <div className="mx-auto max-w-[1365px] px-4 py-20 sm:px-8 lg:py-24">
          {/* Top Editorial Split Thesis (NEAR.org "What is NEAR?" cadence) */}
          <div className="grid grid-cols-1 gap-8 border-b border-black/10 pb-12 lg:grid-cols-12 lg:items-end">
            <div className="space-y-3 lg:col-span-5">
              <span className="inline-flex items-center gap-2 rounded border border-[#00C758]/40 bg-[#F0FDF4] px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-[#032E15] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00C758]" />
                What is MpcFirewall?
              </span>
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em] leading-[1.08] text-black sm:text-4xl lg:text-[42px]">
                Agents shouldn&apos;t sign blind hashes.
              </h2>
            </div>

            <div className="lg:col-span-7">
              <p className="text-base leading-relaxed text-[#374151] sm:text-lg">
                Today on NEAR, Function Call Keys check <em>who</em> your AI assistant is—then let
                it hand a sealed 32-byte digest straight to{' '}
                <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-sm font-semibold text-black">
                  v1.signer
                </code>
                . MpcFirewall sits directly in front of Chain Signatures inside a Rust WebAssembly
                contract, unwrapping every byte and stopping hidden traps before MPC nodes touch
                your key.
              </p>
            </div>
          </div>

          {/* Interactive 7-Scenario Selector */}
          <div id="scenarios" className="mt-12 scroll-mt-24 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1.5">
                <span className="font-mono text-[11px] font-bold tracking-wider text-[#1F3CFF] uppercase">
                  Live Testnet Scenarios
                </span>
                <h3 className="font-display text-2xl font-extrabold tracking-tight text-black sm:text-3xl">
                  Click any errand to inspect its bytes live.
                </h3>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-black/10 bg-white p-1">
                {[
                  { id: 'ALL', label: 'All 7 Errands' },
                  { id: 'SAFE', label: 'Auto-Approved' },
                  { id: 'DAO_ESCALATION', label: 'Team Vote' },
                  { id: 'ATTACK', label: 'Blocked Traps' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setFilterBadge(tab.id as 'ALL' | 'SAFE' | 'DAO_ESCALATION' | 'ATTACK')
                    }
                    className={`rounded-md px-3.5 py-1.5 text-xs font-bold transition-all ${
                      filterBadge === tab.id
                        ? 'bg-black text-white'
                        : 'text-[#525B6C] hover:bg-[#F9F9FA] hover:text-black'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scenario Cards Grid */}
            <div className="space-y-3">
              {filteredPresets.map((preset) => {
                const meta = STORY_MAP[preset.id] || FALLBACK_META;
                const isSelected = preset.id === activePreset?.id;

                const statusPill =
                  preset.badge === 'SAFE' ? (
                    <span className="inline-flex items-center gap-1 rounded border border-[#00C758]/40 bg-[#F0FDF4] px-2.5 py-1 text-xs font-bold text-[#032E15]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#00A544]" />
                      Auto-Approved
                    </span>
                  ) : preset.badge === 'DAO_ESCALATION' ? (
                    <span className="inline-flex items-center gap-1 rounded border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1 text-xs font-bold text-[#92400E]">
                      <Landmark className="h-3.5 w-3.5 text-[#D97706]" />
                      Team Vote
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-1 text-xs font-bold text-[#9F1239]">
                      <ShieldAlert className="h-3.5 w-3.5 text-[#E11D48]" />
                      Trap Blocked
                    </span>
                  );

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(preset)}
                    className={`index-row group w-full rounded-xl border px-5 py-5 text-left transition-all duration-150 sm:px-7 ${
                      isSelected
                        ? 'border-[#1F3CFF] bg-white ring-2 ring-[#1F3CFF]/15 shadow-sm'
                        : 'border-black/10 bg-white hover:-translate-y-0.5 hover:border-black/30 hover:shadow-xs'
                    }`}
                  >
                    <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-12 md:gap-4">
                      <div className="flex items-baseline gap-4 md:col-span-4">
                        <span
                          className={`font-mono text-xs font-extrabold ${
                            isSelected ? 'text-[#1F3CFF]' : 'text-[#525B6C]'
                          }`}
                        >
                          /{meta.index}
                        </span>
                        <div>
                          <div className="font-display text-lg font-extrabold text-black">
                            {meta.humanTitle}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] font-semibold text-[#525B6C]">
                            {meta.networkLabel}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm leading-relaxed text-[#4A5568] md:col-span-5">
                        {meta.plainSummary}
                      </div>

                      <div className="flex items-center justify-between gap-3 md:col-span-3 md:justify-end">
                        <div className="text-left md:text-right">
                          {statusPill}
                          <div className="mt-1 font-mono text-[11px] font-semibold text-[#525B6C]">
                            {meta.dollarBadge}
                          </div>
                        </div>
                        <ArrowUpRight
                          className={`h-4 w-4 shrink-0 transition-transform ${
                            isSelected
                              ? 'translate-x-0.5 -translate-y-0.5 text-[#1F3CFF]'
                              : 'text-[#94A3B8] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-black'
                          }`}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BAND 3: "THE MPCFIREWALL STACK" (CENTERED HEADER + 4 MODULAR PILLARS)
         ===================================================================== */}
      <section className="border-t border-black/10 bg-white">
        <div className="mx-auto max-w-[1365px] px-4 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <span className="inline-flex items-center gap-1.5 rounded border border-black/15 bg-[#F9F9FA] px-3 py-1 font-mono text-[11px] font-bold tracking-wider text-black uppercase">
              The MpcFirewall Stack
            </span>
            <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-black sm:text-4xl lg:text-[44px]">
              Zero blind signing from intent to threshold signature.
            </h2>
            <p className="text-base leading-relaxed text-[#4A5568] sm:text-lg">
              Every transaction passes deterministic byte decoding, policy lane routing, and
              confidential AI verification before Chain Signatures signs.
            </p>
          </div>

          {/* Stack Row 1: Side-by-Side Blind Signing vs. X-Ray Gate */}
          <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="obsidian-grid flex flex-col justify-between rounded-2xl border border-black bg-[#070A0F] p-7 text-white sm:p-9">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded border border-[#F43F5E]/40 bg-[#F43F5E]/15 px-3 py-1 text-xs font-bold text-[#FDA4AF]">
                    <Lock className="h-3.5 w-3.5 text-[#F43F5E]" />
                    Without MpcFirewall
                  </span>
                  <span className="font-mono text-xs text-white/50">Blind 32-Byte Hash</span>
                </div>

                <h3 className="font-display text-2xl font-extrabold tracking-tight text-white">
                  The vault signs a sealed envelope blindfolded.
                </h3>

                <div className="overflow-hidden rounded-xl border border-white/15 bg-white p-3">
                  <img
                    src="/illustrations/blind-envelope.jpg"
                    alt="Blindfolded notary stamping a sealed black envelope"
                    className="h-44 w-full object-contain"
                  />
                </div>

                <p className="text-sm leading-relaxed text-white/80">
                  When an agent calls <code className="text-white">v1.signer</code> directly, MPC
                  nodes only see an opaque 32-byte digest. A $25 invoice and a wallet drain look
                  identical.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-[#F43F5E]/40 bg-[#F43F5E]/15 px-4 py-3 text-sm">
                <span className="text-white/80">If your assistant is tricked:</span>
                <strong className="text-right font-bold text-[#FDA4AF]">
                  {activeMeta.withoutResult}
                </strong>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border-2 border-[#00C758]/50 bg-[#F0FDF4]/60 p-7 sm:p-9">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded bg-[#00A544] px-3 py-1 text-xs font-bold text-white">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    With MpcFirewall
                  </span>
                  <span className="font-mono text-xs font-bold text-[#032E15]">
                    Verified Before MPC
                  </span>
                </div>

                <h3 className="font-display text-2xl font-extrabold tracking-tight text-black">
                  Every byte is unwrapped before signing.
                </h3>

                <div className="overflow-hidden rounded-xl border border-[#00C758]/30 bg-white p-3">
                  <img
                    src="/illustrations/xray-conveyor.jpg"
                    alt="X-ray conveyor belt inspecting an open transparent box"
                    className="h-44 w-full object-contain"
                  />
                </div>

                <p className="text-sm leading-relaxed text-[#374151]">
                  Your assistant&apos;s Function Call Key is scoped strictly to{' '}
                  <code className="rounded bg-black/5 px-1 py-0.5 font-semibold text-black">
                    mpc-firewall.testnet
                  </code>
                  . If any rule fails, <code className="font-semibold text-black">v1.signer</code>{' '}
                  is never invoked.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-[#00C758]/40 bg-white px-4 py-3 text-sm">
                <span className="font-medium text-[#032E15]">Protected outcome:</span>
                <strong className="text-right font-bold text-[#008138]">
                  {activeMeta.withResult}
                </strong>
              </div>
            </div>
          </div>

          {/* Stack Row 2: 3-Tier Treasury Lanes + NEAR AI Cloud TEE Enclave */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col justify-between rounded-2xl border border-black/10 bg-[#F9F9FA] p-7 sm:p-9 lg:col-span-7">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded border border-[#00C758]/40 bg-[#F0FDF4] px-3 py-1 text-xs font-bold text-[#032E15]">
                  <Landmark className="h-3.5 w-3.5 text-[#00A544]" />
                  01 · 3-Lane Autonomous Treasury
                </div>
                <h3 className="font-display text-2xl font-extrabold tracking-tight text-black">
                  Clear expense policies for autonomous wallets
                </h3>
                <p className="text-sm leading-relaxed text-[#4A5568]">
                  Routine purchases under <strong>$100 USDC</strong> sign automatically. Mid-sized
                  transfers (<strong>$100–$500 USDC</strong>) pause and generate a real proposal on{' '}
                  <strong>Trezu / SputnikDAO</strong>. Infinite approvals and wrong networks get
                  blocked cold.
                </p>
              </div>

              <div className="my-6 overflow-hidden rounded-xl border border-black/10 bg-white p-3">
                <img
                  src="/illustrations/three-lanes.jpg"
                  alt="Three spending lanes: green auto-pass, amber human team vote, red blocked wall"
                  className="h-48 w-full object-contain"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-bold">
                <div className="rounded-lg border border-[#00C758]/35 bg-[#F0FDF4] py-2.5 text-[#032E15]">
                  &le; $100 Auto-Signed
                </div>
                <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] py-2.5 text-[#92400E]">
                  $100–$500 Team Vote
                </div>
                <div className="rounded-lg border border-[#FECDD3] bg-[#FFF1F2] py-2.5 text-[#9F1239]">
                  Traps Blocked ($0)
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF]/70 p-7 sm:p-9 lg:col-span-5">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded bg-[#1F3CFF] px-3 py-1 text-xs font-bold text-white">
                  <Cpu className="h-3.5 w-3.5" />
                  02 · NEAR AI Cloud TEE Co-Audit
                </div>
                <h3 className="font-display text-2xl font-extrabold tracking-tight text-black">
                  The Private AI Lie Detector
                </h3>
                <p className="text-sm leading-relaxed text-[#1E293B]">
                  A confidential enclave audit compares what the AI agent <em>claims</em> in plain
                  English against the unpacked on-chain calldata—catching prompt injections before
                  anything is signed.
                </p>
              </div>

              <div className="my-6 overflow-hidden rounded-xl border border-[#C7D2FE] bg-white p-3">
                <img
                  src="/illustrations/ai-assistant.jpg"
                  alt="Polite AI assistant with a sneaky prompt-injection bug"
                  className="h-48 w-full object-contain"
                />
              </div>

              <Link
                href="/docs/features"
                className="inline-flex items-center justify-between rounded-lg border border-[#1F3CFF]/30 bg-white px-4 py-3 text-xs font-bold text-[#1F3CFF] transition-colors hover:bg-[#1F3CFF] hover:text-white"
              >
                <span>See how deterministic WASM + TEE audit work together</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BAND 4: NEAR.ORG-STYLE FULL-BLEED EDITORIAL PULL-QUOTE BAND
         ===================================================================== */}
      <section className="obsidian-grid bg-black text-white">
        <div className="mx-auto max-w-[1000px] px-4 py-20 text-center sm:px-8 lg:py-28">
          <div className="inline-flex items-center gap-2 rounded border border-[#05DF72]/40 bg-[#05DF72]/10 px-3 py-1 font-mono text-[11px] font-bold tracking-wider text-[#05DF72] uppercase">
            Chain Signatures Security Principle
          </div>

          <blockquote className="mt-6 font-display text-3xl font-bold tracking-[-0.025em] leading-[1.16] text-white sm:text-4xl lg:text-[44px]">
            &ldquo;The agentic economy can only take shape if the agents are secure—and every
            signature is verified on-chain before it leaves NEAR.&rdquo;
          </blockquote>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70">
            Zero private-key custody shifts, zero UX prompt-fatigue popups—just enforceable policy
            gates between autonomous bots and threshold signatures.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-lg bg-[#05DF72] px-6 py-3.5 text-sm font-extrabold text-black transition-transform hover:-translate-y-0.5 hover:bg-[#00C758]"
            >
              <span>Read the Documentation</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <a
              href="#live-proofs"
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:border-white hover:bg-white/10"
            >
              <span>Inspect Live On-Chain Proofs</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BAND 5: "INTEGRATED ACROSS CHAINS & NEAR STACK" GRID (WARM CREAM)
         ===================================================================== */}
      <section className="border-y border-black/10 bg-[#F2F1E9]">
        <div className="mx-auto max-w-[1365px] px-4 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <span className="font-mono text-[11px] font-bold tracking-wider text-[#525B6C] uppercase">
              Cross-Chain &amp; NEAR Native
            </span>
            <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-black sm:text-4xl">
              Integrated across chains, protocols, and NEAR infrastructure.
            </h2>
            <p className="text-base leading-relaxed text-[#4A5568]">
              One policy layer protecting outbound execution wherever Chain Signatures signs.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ECOSYSTEM_INTEGRATIONS.map((item) => (
              <div
                key={item.name}
                className="flex flex-col justify-between rounded-xl border border-black/10 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-black/25 hover:shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-extrabold text-black">{item.name}</h3>
                    <span className="h-2 w-2 rounded-full bg-[#00C758]" />
                  </div>
                  <div className="mt-1 font-mono text-[11px] font-semibold text-[#1F3CFF]">
                    {item.tag}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-[#4A5568]">{item.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          BAND 6: 3-STEP INTEGRATION GUIDE + LIVE TESTNET PROOF DRAWER
         ===================================================================== */}
      <section id="live-proofs" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-[1365px] space-y-12 px-4 py-20 sm:px-8 lg:py-24">
          <div className="flex flex-col gap-6 border-b border-black/10 pb-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2.5">
              <span className="inline-flex items-center gap-2 rounded border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-[#1F3CFF] uppercase">
                Zero Workflow Disruption
              </span>
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-black sm:text-4xl">
                Drop into any NEAR agent flow in 3 steps.
              </h2>
              <p className="text-base text-[#4A5568]">
                Keep your existing AI framework, NEAR account, and Chain Signatures derivation paths.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <img
                src="/illustrations/multichain-passport.jpg"
                alt="One protective shield over Bitcoin, Ethereum, and NEAR coins"
                className="hidden h-20 w-32 rounded-xl border border-black/10 bg-[#F9F9FA] object-contain p-1.5 sm:block"
              />
              <Link
                href="/docs/quickstart"
                className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-[#1F3CFF]"
              >
                <span>Open Integration Guide</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[#05DF72]" />
              </Link>
            </div>
          </div>

          {/* 3-Column Editorial Integration Cards (near.org "What's new" 3-col layout) */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Link
              href="/docs/on-chain"
              className="group flex flex-col justify-between rounded-2xl border border-black/10 bg-[#F9F9FA] p-6 transition-all hover:-translate-y-0.5 hover:border-black/30 hover:bg-white"
            >
              <div>
                <span className="font-mono text-xs font-extrabold text-[#1F3CFF]">STEP 01</span>
                <h3 className="mt-2 font-display text-xl font-extrabold text-black">
                  Park the Checkbook
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4A5568]">
                  Derive your agent treasury address under{' '}
                  <code className="font-mono text-xs font-semibold text-black">
                    mpc-firewall.testnet
                  </code>{' '}
                  and authorize your bot account.
                </p>
              </div>
              <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-black group-hover:text-[#1F3CFF]">
                <span>On-Chain Integration Docs</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <Link
              href="/docs/contract"
              className="group flex flex-col justify-between rounded-2xl border border-black/10 bg-[#F9F9FA] p-6 transition-all hover:-translate-y-0.5 hover:border-black/30 hover:bg-white"
            >
              <div>
                <span className="font-mono text-xs font-extrabold text-[#00A544]">STEP 02</span>
                <h3 className="mt-2 font-display text-xl font-extrabold text-black">
                  Scope the Function Key
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4A5568]">
                  Restrict your agent&apos;s Function Call Key to our contract receiver so it can
                  never call <code className="font-mono text-xs font-semibold text-black">v1.signer</code>{' '}
                  directly.
                </p>
              </div>
              <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-black group-hover:text-[#00A544]">
                <span>Contract &amp; Method Specs</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <Link
              href="/docs/sdk"
              className="group flex flex-col justify-between rounded-2xl border border-black/10 bg-[#F9F9FA] p-6 transition-all hover:-translate-y-0.5 hover:border-black/30 hover:bg-white"
            >
              <div>
                <span className="font-mono text-xs font-extrabold text-[#D97706]">STEP 03</span>
                <h3 className="mt-2 font-display text-xl font-extrabold text-black">
                  Send Unsealed Bytes
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4A5568]">
                  Submit unsigned EVM RLP or Bitcoin SegWit hex + intent via HTTP API, TypeScript
                  SDK, or direct NEAR call.
                </p>
              </div>
              <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-black group-hover:text-[#D97706]">
                <span>SDK &amp; Agent Tooling</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          </div>

          {/* Cryptographic Proof Drawer & Live Testnet Signing Runner */}
          <div className="overflow-hidden rounded-2xl border border-black/15 bg-white">
            <button
              type="button"
              onClick={() => setShowProofDrawer((v) => !v)}
              className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-[#F9F9FA] sm:px-7"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black text-[#05DF72]">
                  <Code2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-base font-extrabold text-black">
                    Cryptographic Proof Drawer: Raw AST, v1.signer Promises &amp; DAO Payloads
                  </div>
                  <div className="text-xs text-[#4A5568]">
                    Inspect byte-level disassembly, SputnikDAO proposals, and live NEAR Intents
                    1Click quotes
                  </div>
                </div>
              </div>

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-black/15 bg-[#F9F9FA] px-3.5 py-2 text-xs font-bold text-black">
                <span>{showProofDrawer ? 'Hide Proof' : 'Inspect Proof'}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showProofDrawer ? 'rotate-180' : ''}`}
                />
              </span>
            </button>

            {record && (
              <div className="border-t border-black/10 bg-[#F9F9FA]/50 p-4 sm:p-6">
                <LiveTestnetExecutePanel
                  record={record}
                  presetId={activePreset?.id}
                  bip143Input={activePreset?.bip143Input}
                  compact
                />
              </div>
            )}

            {showProofDrawer && record && (
              <div className="space-y-4 border-t border-black/10 bg-[#F9F9FA] p-6 text-xs sm:p-7">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <div className="mb-2 font-mono text-[11px] font-bold text-black">
                      Unwrapped Transaction AST ({record.decoded.kind.toUpperCase()})
                    </div>
                    <pre className="max-h-60 overflow-auto font-mono text-[11px] leading-relaxed text-[#4A5568]">
                      {JSON.stringify(record.decoded, null, 2)}
                    </pre>
                  </div>

                  <div className="space-y-4">
                    {record.mpcDispatch && (
                      <div className="rounded-xl border border-[#00C758]/40 bg-white p-4">
                        <div className="mb-2 font-mono text-[11px] font-bold text-[#00A544]">
                          Cross-Contract Promise ({record.mpcDispatch.firewallContractMethod} &rarr;{' '}
                          {record.mpcDispatch.signerContractId})
                        </div>
                        <pre className="max-h-48 overflow-auto font-mono text-[11px] text-black">
                          {JSON.stringify(record.mpcDispatch, null, 2)}
                        </pre>
                      </div>
                    )}

                    {record.daoProposalPayload && (
                      <div className="rounded-xl border border-[#FDE68A] bg-white p-4">
                        <div className="mb-2 font-mono text-[11px] font-bold text-[#D97706]">
                          Generated Trezu / SputnikDAO Proposal (
                          {record.daoProposalPayload.contractId})
                        </div>
                        <pre className="max-h-48 overflow-auto font-mono text-[11px] text-black">
                          {JSON.stringify(record.daoProposalPayload, null, 2)}
                        </pre>
                      </div>
                    )}

                    {!record.mpcDispatch && !record.daoProposalPayload && (
                      <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2] p-4 text-[#9F1239]">
                        <div className="font-bold">Zero Dispatch Payload Generated ($0 Signed)</div>
                        <p className="mt-1 text-xs">
                          Because MpcFirewall blocked this transaction during on-chain verification,
                          no cross-contract call was ever dispatched to{' '}
                          <code>v1.signer-prod.testnet</code>.
                        </p>
                      </div>
                    )}

                    <div className="rounded-xl border border-black/10 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-black">
                          NEAR Intents 1Click Confidential Quote
                        </span>
                        <button
                          type="button"
                          onClick={handlePreviewIntents}
                          disabled={quoteLoading}
                          className="rounded-lg bg-black px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#1F3CFF] disabled:opacity-50"
                        >
                          {quoteLoading ? 'Querying 1Click API…' : 'Preview Live Confidential Quote'}
                        </button>
                      </div>
                      {quoteOutput && (
                        <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-[#F9F9FA] p-3 font-mono text-[10px] text-[#4A5568]">
                          {quoteOutput}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          BAND 7: NEAR.ORG-INSPIRED DARK ANCHOR FOOTER
         ===================================================================== */}
      <footer className="border-t border-white/10 bg-black text-white">
        <div className="mx-auto max-w-[1365px] px-4 py-16 sm:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="space-y-4 md:col-span-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#05DF72] text-black">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span className="font-display text-lg font-extrabold tracking-tight text-white">
                  MpcFirewall
                </span>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-white/65">
                Deterministic policy firewall for NEAR Chain Signatures agents—decoding EVM and
                Bitcoin bytes on-chain before threshold signatures leave NEAR.
              </p>
              <div className="inline-flex items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[11px] text-[#05DF72]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#05DF72]" />
                <span>Live on NEAR Testnet</span>
              </div>
            </div>

            <div className="space-y-3 md:col-span-2">
              <h3 className="font-mono text-xs font-bold tracking-wider text-white/50 uppercase">
                Documentation
              </h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li>
                  <Link href="/docs" className="hover:text-[#05DF72]">
                    Why MpcFirewall
                  </Link>
                </li>
                <li>
                  <Link href="/docs/features" className="hover:text-[#05DF72]">
                    Core Features
                  </Link>
                </li>
                <li>
                  <Link href="/docs/quickstart" className="hover:text-[#05DF72]">
                    Agent Quickstart
                  </Link>
                </li>
                <li>
                  <Link href="/docs/http-api" className="hover:text-[#05DF72]">
                    HTTP API Reference
                  </Link>
                </li>
                <li>
                  <Link href="/docs/sdk" className="hover:text-[#05DF72]">
                    TypeScript SDK
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3 md:col-span-2">
              <h3 className="font-mono text-xs font-bold tracking-wider text-white/50 uppercase">
                Protocol
              </h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li>
                  <Link href="/docs/on-chain" className="hover:text-[#05DF72]">
                    On-Chain Integration
                  </Link>
                </li>
                <li>
                  <Link href="/docs/contract" className="hover:text-[#05DF72]">
                    Rust Contract Spec
                  </Link>
                </li>
                <li>
                  <Link href="/docs/security" className="hover:text-[#05DF72]">
                    Security Model
                  </Link>
                </li>
                <li>
                  <Link href="/docs/proofs" className="hover:text-[#05DF72]">
                    Verified Proofs
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3 md:col-span-3">
              <h3 className="font-mono text-xs font-bold tracking-wider text-white/50 uppercase">
                Testnet Infrastructure
              </h3>
              <ul className="space-y-2 font-mono text-xs text-white/75">
                <li>
                  <a
                    href="https://testnet.nearblocks.io/address/mpc-firewall.testnet"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[#05DF72]"
                  >
                    <span>mpc-firewall.testnet</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://testnet.nearblocks.io/address/mpc-firewall-council.sputnikv2.testnet"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[#05DF72]"
                  >
                    <span>mpc-firewall-council.sputnikv2.testnet</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://testnet.nearblocks.io/address/v1.signer-prod.testnet"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[#05DF72]"
                  >
                    <span>v1.signer-prod.testnet</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/50 sm:flex-row sm:items-center">
            <span>MpcFirewall &bull; Non-Custodial Transaction Firewall for NEAR Agents</span>
            <span>Built on NEAR Chain Signatures, NEAR AI Cloud TEE &amp; SputnikDAO v2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
