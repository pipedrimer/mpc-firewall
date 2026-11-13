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
  ChevronDown,
  Code2,
  Cpu,
  Landmark,
  Lock,
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
    networkLabel: 'Base • Chain 8453'
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
    networkLabel: 'Base • Chain 8453'
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
    tag: 'EVM // 8453',
    summary: 'Full EIP-1559 RLP, ERC-20 transfer/approve caps, and nested router calldata X-ray.'
  },
  {
    name: 'Ethereum & Sepolia',
    tag: 'EVM // 1 & 11155111',
    summary: 'Prevents silent chain-ID swaps, drainer approvals, and blanket NFT sweeps.'
  },
  {
    name: 'Arbitrum One',
    tag: 'L2 // 42161',
    summary: 'Enforces exact network allowlists and per-call spend budgets across L2 routes.'
  },
  {
    name: 'Bitcoin SegWit',
    tag: 'UTXO // BIP-143',
    summary: 'Inspects raw SegWit inputs, satoshi values, and output scripts inside Rust WASM.'
  },
  {
    name: 'Chain Signatures',
    tag: 'v1.signer-prod.testnet',
    summary: 'Deterministic pre-signing gate — unsafe payloads never trigger MPC threshold shares.'
  },
  {
    name: 'NEAR AI Cloud TEE',
    tag: 'CONFIDENTIAL ENCLAVE',
    summary: 'Compares natural-language agent intent against unpacked raw calldata semantics.'
  },
  {
    name: 'NEAR Intents 1Click',
    tag: 'CONFIDENTIAL SWAP API',
    summary: 'Supports verifiable confidential swap quotes alongside firewall inspection.'
  },
  {
    name: 'SputnikDAO / Trezu',
    tag: 'HUMAN MULTISIG LANE',
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
          BAND 1: SWISS HARDWARE HERO + LIVE 3D TRANSACTION X-RAY
         ===================================================================== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1365px] px-4 pt-10 pb-16 sm:px-8 lg:pt-14 lg:pb-24">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Left Column: Stark Architectural Headline + Mechanical NEAR Action Controls */}
            <div className="space-y-7 pt-2 lg:col-span-5">
              <h1 className="font-display text-4xl font-bold tracking-[-0.04em] leading-[0.98] text-black sm:text-5xl xl:text-[58px]">
                Never let your AI assistant sign a{' '}
                <span className="inline-block bg-[#05DF72] px-2 pb-0.5 text-black">
                  sealed envelope.
                </span>
              </h1>

              <p className="max-w-[44ch] text-base leading-relaxed text-[#374151] sm:text-[18px]">
                Before autonomous agents spend on Ethereum, Base, or Bitcoin, MpcFirewall unpacks
                raw calldata on NEAR and blocks drainer traps before Chain Signatures touches your
                key.
              </p>

              {/* Signature Mechanical NEAR-Style Action Control */}
              <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={onInspect}
                  disabled={loading}
                  className="group inline-flex items-center justify-between gap-4 rounded-[4px] bg-black p-1.5 pl-5 text-left text-sm font-semibold text-white transition-all hover:bg-[#141923] disabled:opacity-75"
                >
                  <span>
                    {loading
                      ? `X-Raying Errand ${activeMeta.index}…`
                      : `Scan Errand ${activeMeta.index} (${activeMeta.shortLabel})`}
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] bg-[#05DF72] text-black transition-transform group-hover:translate-x-0.5">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </button>
              </div>
            </div>

            {/* Right Column: Precision Hardware X-Ray Stage */}
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
          BAND 2: "WHAT IS MPCFIREWALL?" + CONTINUOUS ARCHITECTURAL LEDGER
         ===================================================================== */}
      <section className="border-t border-black/15 bg-[#F9F9FA]">
        <div className="mx-auto max-w-[1365px] px-4 py-20 sm:px-8 lg:py-24">
          <div className="grid grid-cols-1 gap-8 border-b border-black/15 pb-12 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-5">
              <h2 className="font-display text-3xl font-bold tracking-[-0.035em] leading-[1.04] text-black sm:text-4xl lg:text-[44px]">
                What is MpcFirewall?
              </h2>
            </div>

            <div className="lg:col-span-7">
              <p className="text-base leading-relaxed text-[#2D3748] sm:text-lg">
                Standard NEAR Function Call Keys check <em>who</em> called a contract, then send a
                blind 32-byte digest straight to{' '}
                <code className="border border-black/10 bg-white px-1.5 py-0.5 font-mono text-sm font-semibold text-black">
                  v1.signer
                </code>
                . MpcFirewall unwraps EVM calldata, nested multicalls, and Bitcoin outputs inside a
                NEAR Rust contract before any signature exists.
              </p>
            </div>
          </div>

          {/* Interactive 7-Scenario Console Ledger */}
          <div id="scenarios" className="mt-14 scroll-mt-24 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <h3 className="font-display text-2xl font-bold tracking-[-0.03em] text-black sm:text-3xl">
                Select a live errand to inspect its bytes.
              </h3>

              <div className="flex flex-wrap border border-black/15 bg-white">
                {[
                  { id: 'ALL', label: 'All (7)' },
                  { id: 'SAFE', label: 'Auto-Approved' },
                  { id: 'DAO_ESCALATION', label: 'Team Vote' },
                  { id: 'ATTACK', label: 'Blocked' }
                ].map((tab, idx) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setFilterBadge(tab.id as 'ALL' | 'SAFE' | 'DAO_ESCALATION' | 'ATTACK')
                    }
                    className={`px-3.5 py-2 font-mono text-[11px] font-semibold uppercase transition-colors ${
                      idx > 0 ? 'border-l border-black/15' : ''
                    } ${
                      filterBadge === tab.id
                        ? 'bg-black text-[#05DF72]'
                        : 'text-[#525B6C] hover:bg-[#F9F9FA] hover:text-black'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Flush Ruled Ledger Table */}
            <div className="divide-y divide-black/15 border border-black/15 bg-white">
              {filteredPresets.map((preset) => {
                const meta = STORY_MAP[preset.id] || FALLBACK_META;
                const isSelected = preset.id === activePreset?.id;

                const statusLabel =
                  preset.badge === 'SAFE'
                    ? { dot: 'bg-[#00C758]', text: 'text-[#008138]', label: 'AUTO-APPROVED' }
                    : preset.badge === 'DAO_ESCALATION'
                      ? { dot: 'bg-[#D97706]', text: 'text-[#B45309]', label: 'TEAM VOTE' }
                      : { dot: 'bg-[#E11D48]', text: 'text-[#BE123C]', label: 'TRAP BLOCKED' };

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(preset)}
                    className={`group relative grid w-full grid-cols-1 items-center gap-3 px-5 py-4 text-left transition-colors sm:px-6 md:grid-cols-12 md:gap-4 ${
                      isSelected
                        ? 'bg-[#F0FDF4]/55'
                        : 'hover:bg-[#F9F9FA]'
                    }`}
                  >
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-1 bg-black"
                      />
                    )}

                    <div className="flex items-baseline gap-4 md:col-span-4">
                      <span
                        className={`font-mono text-xs font-bold ${
                          isSelected ? 'text-black' : 'text-[#718096]'
                        }`}
                      >
                        /{meta.index}
                      </span>
                      <div>
                        <div className="font-display text-lg font-bold text-black">
                          {meta.humanTitle}
                        </div>
                        <div className="font-mono text-[11px] text-[#525B6C]">
                          {meta.networkLabel}
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-[#4A5568] md:col-span-5">{meta.plainSummary}</div>

                    <div className="flex items-center justify-between gap-4 md:col-span-3 md:justify-end">
                      <div className="text-left md:text-right">
                        <div
                          className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold ${statusLabel.text}`}
                        >
                          <span className={`h-2 w-2 rounded-xs ${statusLabel.dot}`} />
                          <span>{statusLabel.label}</span>
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-[#525B6C]">
                          {meta.dollarBadge}
                        </div>
                      </div>

                      <ArrowUpRight
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          isSelected
                            ? 'text-black'
                            : 'text-[#94A3B8] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-black'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BAND 3: "THE MPCFIREWALL STACK" (DIPTYCH + ALTERNATING CHAPTERS)
         ===================================================================== */}
      <section className="border-t border-black/15 bg-white">
        <div className="mx-auto max-w-[1365px] px-4 py-20 sm:px-8 lg:py-28">
          <div className="max-w-3xl space-y-3">
            <h2 className="font-display text-3xl font-bold tracking-[-0.035em] leading-[1.04] text-black sm:text-4xl lg:text-[48px]">
              How it prevents blind signing
            </h2>
            <p className="text-base leading-relaxed text-[#4A5568] sm:text-lg">
              Deterministic transaction parsing, programmatic treasury routing, and confidential
              semantic co-auditing before Chain Signatures computes a threshold share.
            </p>
          </div>

          {/* Flush 50/50 Architectural Diptych: Blind Signing vs X-Ray */}
          <div className="mt-14 grid grid-cols-1 border border-black/20 lg:grid-cols-2 lg:divide-x lg:divide-black/20">
            {/* Left Side: Blind Hash */}
            <div className="flex flex-col justify-between bg-[#070A0F] p-8 text-white sm:p-10">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/15 pb-4 font-mono text-xs">
                  <span className="inline-flex items-center gap-2 font-bold text-[#FDA4AF]">
                    <Lock className="h-3.5 w-3.5 text-[#F43F5E]" />
                    WITHOUT MPCFIREWALL
                  </span>
                  <span className="text-white/50">32-BYTE BLIND HASH</span>
                </div>

                <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  The vault signs a sealed envelope blindfolded.
                </h3>

                <div className="border border-white/15 bg-white p-3">
                  <img
                    src="/illustrations/blind-envelope.jpg"
                    alt="Blindfolded notary stamping a sealed black envelope"
                    className="h-44 w-full object-contain"
                  />
                </div>

                <p className="text-sm leading-relaxed text-white/75">
                  When an AI assistant calls <code className="text-white">v1.signer</code>{' '}
                  directly, MPC nodes see only a hash. A routine $25 server payment and an infinite
                  wallet drain look identical.
                </p>
              </div>

              <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/15 pt-4 font-mono text-xs">
                <span className="text-white/60">UNPROTECTED OUTCOME</span>
                <strong className="text-right text-[#FDA4AF]">{activeMeta.withoutResult}</strong>
              </div>
            </div>

            {/* Right Side: Verified Byte X-Ray */}
            <div className="flex flex-col justify-between bg-white p-8 sm:p-10">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-black/15 pb-4 font-mono text-xs">
                  <span className="inline-flex items-center gap-2 font-bold text-[#008138]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#00A544]" />
                    WITH MPCFIREWALL
                  </span>
                  <span className="font-semibold text-black">BYTE-LEVEL X-RAY GATE</span>
                </div>

                <h3 className="font-display text-2xl font-bold tracking-tight text-black sm:text-3xl">
                  Every byte is unwrapped before signing.
                </h3>

                <div className="border border-black/15 bg-[#F9F9FA] p-3">
                  <img
                    src="/illustrations/xray-conveyor.jpg"
                    alt="X-ray conveyor belt inspecting an open transparent box"
                    className="h-44 w-full object-contain"
                  />
                </div>

                <p className="text-sm leading-relaxed text-[#374151]">
                  Scope your agent&apos;s Function Call Key strictly to{' '}
                  <code className="border border-black/10 bg-[#F9F9FA] px-1 py-0.5 font-mono text-xs font-semibold text-black">
                    mpc-firewall.testnet
                  </code>
                  . Failed inspections stop on NEAR before{' '}
                  <code className="font-semibold text-black">v1.signer</code> is ever called.
                </p>
              </div>

              <div className="mt-8 flex items-center justify-between gap-4 border-t border-black/15 pt-4 font-mono text-xs">
                <span className="text-[#525B6C]">FIREWALL OUTCOME</span>
                <strong className="text-right text-[#008138]">{activeMeta.withResult}</strong>
              </div>
            </div>
          </div>

          {/* Alternating Stack Chapters (NEAR.org AlternatingTextAndImageRows cadence) */}
          <div className="mt-20 space-y-20 border-t border-black/15 pt-16">
            {/* Chapter 01: 3-Lane Autonomous Treasury */}
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
              <div className="space-y-5 lg:col-span-6">
                <div className="inline-flex items-center gap-2 font-mono text-xs font-bold tracking-wider text-[#008138] uppercase">
                  <Landmark className="h-4 w-4" />
                  LAYER 01 // 3-LANE AUTONOMOUS TREASURY
                </div>
                <h3 className="font-display text-3xl font-bold tracking-[-0.03em] text-black">
                  Programmatic spending lanes tailored for agents.
                </h3>
                <p className="text-base leading-relaxed text-[#4A5568]">
                  Low-risk vendor bills settle seamlessly without blocking your workflow, while high
                  or abnormal transfers automatically escalate for human review or get stopped on
                  the spot.
                </p>

                <div className="divide-y divide-black/15 border border-black/15 font-mono text-xs">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-black">LANE 1 // AUTO-SIGNED</span>
                    <span className="font-semibold text-[#008138]">&le; $100 USDC</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-black">LANE 2 // SPUTNIKDAO VOTE</span>
                    <span className="font-semibold text-[#B45309]">$100 – $500 USDC</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-bold text-black">LANE 3 // HARD BLOCKED</span>
                    <span className="font-semibold text-[#BE123C]">MaxUint256 &amp; Traps ($0)</span>
                  </div>
                </div>
              </div>

              <div className="border border-black/15 bg-[#F9F9FA] p-4 lg:col-span-6">
                <img
                  src="/illustrations/three-lanes.jpg"
                  alt="Three spending lanes: green auto-pass, amber human team vote, red blocked wall"
                  className="h-64 w-full bg-white object-contain p-3"
                />
              </div>
            </div>

            {/* Chapter 02 (Reversed Layout): NEAR AI Cloud TEE Co-Audit */}
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
              <div className="order-2 border border-black/15 bg-[#EEF2FF] p-4 lg:order-1 lg:col-span-6">
                <img
                  src="/illustrations/ai-assistant.jpg"
                  alt="Polite AI assistant with a sneaky prompt-injection bug"
                  className="h-64 w-full bg-white object-contain p-3"
                />
              </div>

              <div className="order-1 space-y-5 lg:order-2 lg:col-span-6">
                <div className="inline-flex items-center gap-2 font-mono text-xs font-bold tracking-wider text-[#1F3CFF] uppercase">
                  <Cpu className="h-4 w-4" />
                  LAYER 02 // NEAR AI CLOUD TEE CO-AUDIT
                </div>
                <h3 className="font-display text-3xl font-bold tracking-[-0.03em] text-black">
                  Semantic lie detector inside confidential hardware.
                </h3>
                <p className="text-base leading-relaxed text-[#4A5568]">
                  Deterministic rules stop known exploits cleanly—while confidential compute in
                  NEAR AI Cloud cross-checks what your assistant <em>claimed</em> in English against
                  what the unpacked raw bytes actually execute.
                </p>
                <div className="pt-1">
                  <Link
                    href="/docs/features"
                    className="group inline-flex items-center gap-2 border-b-2 border-black pb-1 font-mono text-xs font-bold text-black transition-colors hover:border-[#1F3CFF] hover:text-[#1F3CFF]"
                  >
                    <span>READ HOW DETERMINISTIC WASM + TEE WORK TOGETHER</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BAND 5: FLUSH 1PX RULED ECOSYSTEM MATRIX (WARM CREAM CANVAS)
         ===================================================================== */}
      <section className="border-y border-black/15 bg-[#F2F1E9]">
        <div className="mx-auto max-w-[1365px] px-4 py-16 sm:px-8 lg:py-20">
          <h2 className="max-w-2xl font-display text-3xl font-bold tracking-[-0.035em] text-black sm:text-4xl">
            Supported chains and NEAR primitives
          </h2>

          {/* Flush gap-px hairline grid */}
          <div className="mt-10 grid grid-cols-1 gap-px border border-black/15 bg-black/15 sm:grid-cols-2 lg:grid-cols-4">
            {ECOSYSTEM_INTEGRATIONS.map((item) => (
              <div
                key={item.name}
                className="flex flex-col justify-between bg-white p-6"
              >
                <div>
                  <span className="font-mono text-[10px] font-bold tracking-wider text-[#1F3CFF] uppercase">
                    {item.tag}
                  </span>
                  <h3 className="mt-2 font-display text-lg font-bold text-black">{item.name}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#4A5568]">{item.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          BAND 6: 3-STEP INTEGRATION MATRIX + CRYPTOGRAPHIC PROOF DRAWER
         ===================================================================== */}
      <section id="live-proofs" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-[1365px] space-y-12 px-4 py-16 sm:px-8 lg:py-20">
          <div className="flex flex-col gap-6 border-b border-black/15 pb-8 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-2xl font-display text-3xl font-bold tracking-[-0.035em] text-black sm:text-4xl">
              Drop into any NEAR agent flow in 3 steps
            </h2>

            <Link
              href="/docs/quickstart"
              className="group inline-flex items-center gap-3 self-start rounded-[4px] bg-black px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-[#1F3CFF] lg:self-auto"
            >
              <span>Open Integration Guide</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#05DF72] group-hover:text-white" />
            </Link>
          </div>

          {/* Flush 3-Column Hairline Grid */}
          <div className="grid grid-cols-1 gap-px border border-black/15 bg-black/15 md:grid-cols-3">
            <Link
              href="/docs/on-chain"
              className="group flex flex-col justify-between bg-[#F9F9FA] p-7 transition-colors hover:bg-white"
            >
              <div>
                <div className="font-display text-3xl font-bold text-[#1F3CFF]">01</div>
                <h3 className="mt-4 font-display text-xl font-bold text-black">
                  Park the Checkbook
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4A5568]">
                  Derive your agent treasury address under{' '}
                  <code className="font-mono text-xs font-semibold text-black">
                    mpc-firewall.testnet
                  </code>{' '}
                  and add your agent account.
                </p>
              </div>
              <div className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs font-bold text-black group-hover:text-[#1F3CFF]">
                <span>ON-CHAIN INTEGRATION</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <Link
              href="/docs/contract"
              className="group flex flex-col justify-between bg-[#F9F9FA] p-7 transition-colors hover:bg-white"
            >
              <div>
                <div className="font-display text-3xl font-bold text-[#00A544]">02</div>
                <h3 className="mt-4 font-display text-xl font-bold text-black">
                  Scope the Function Key
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4A5568]">
                  Restrict your assistant&apos;s Function Call Key to our contract receiver so it can
                  never bypass <code className="font-mono text-xs font-semibold text-black">v1.signer</code>.
                </p>
              </div>
              <div className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs font-bold text-black group-hover:text-[#00A544]">
                <span>RUST CONTRACT SPECS</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <Link
              href="/docs/sdk"
              className="group flex flex-col justify-between bg-[#F9F9FA] p-7 transition-colors hover:bg-white"
            >
              <div>
                <div className="font-display text-3xl font-bold text-[#D97706]">03</div>
                <h3 className="mt-4 font-display text-xl font-bold text-black">
                  Send Unsealed Bytes
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4A5568]">
                  Submit raw unsigned EVM RLP or Bitcoin SegWit hex plus plain-English intent via
                  HTTP API, TypeScript SDK, or RPC.
                </p>
              </div>
              <div className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs font-bold text-black group-hover:text-[#D97706]">
                <span>SDK &amp; AGENT TOOLS</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          </div>

          {/* Live On NEAR Testnet: Labeled Deployed Contracts & Proof Links */}
          <div id="deployed-contracts" className="scroll-mt-24 space-y-3">
            <div className="flex items-center font-mono text-[11px] font-bold tracking-wider text-black uppercase">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-xs bg-[#00C758]" />
                LIVE ON NEAR TESTNET
              </span>
            </div>

            <div className="grid grid-cols-1 gap-px border border-black/15 bg-black/15 md:grid-cols-3">
              <a
                href="https://testnet.nearblocks.io/address/mpc-firewall.testnet"
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col justify-between bg-[#F9F9FA] p-5 transition-colors hover:bg-white"
              >
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] font-bold tracking-wider text-[#525B6C] uppercase">
                    <span>Firewall Policy Contract</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-black transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <div className="mt-2 font-mono text-sm font-bold text-black">
                    mpc-firewall.testnet
                  </div>
                  <p className="mt-1.5 text-xs text-[#4A5568]">
                    Rust WASM verifier that inspects raw EVM &amp; Bitcoin payloads before calling
                    MPC.
                  </p>
                </div>
              </a>

              <a
                href="https://testnet.nearblocks.io/txns/9CMZemnkejMCCJHeUXHBtHp4A49T71aLyjoBBQ98ZxVN"
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col justify-between bg-[#F9F9FA] p-5 transition-colors hover:bg-white"
              >
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] font-bold tracking-wider text-[#008138] uppercase">
                    <span>Verified MPC Signature Proof TX</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-black transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <div className="mt-2 font-mono text-sm font-bold text-black">
                    9CMZem…8ZxVN
                  </div>
                  <p className="mt-1.5 text-xs text-[#4A5568]">
                    Live cross-contract signature receipt issued through{' '}
                    <code>v1.signer-prod.testnet</code>.
                  </p>
                </div>
              </a>

              <a
                href="https://testnet.nearblocks.io/address/mpc-firewall-council.sputnikv2.testnet"
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col justify-between bg-[#F9F9FA] p-5 transition-colors hover:bg-white"
              >
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] font-bold tracking-wider text-[#B45309] uppercase">
                    <span>Escalation Council DAO</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-black transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <div className="mt-2 font-mono text-sm font-bold text-black">
                    mpc-firewall-council.sputnikv2.testnet
                  </div>
                  <p className="mt-1.5 text-xs text-[#4A5568]">
                    Human governance multisig receiving mid-sized ($100–$500) escalations.
                  </p>
                </div>
              </a>
            </div>
          </div>

          {/* Crisp Hardware Proof Drawer & Live Execution Panel */}
          <div className="border border-black/20 bg-white">
            <button
              type="button"
              onClick={() => setShowProofDrawer((v) => !v)}
              className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-[#F9F9FA] sm:px-7"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-black text-[#05DF72]">
                  <Code2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="font-display text-base font-bold text-black">
                    Cryptographic Proof Drawer // Raw AST, v1.signer Promises &amp; DAO Payloads
                  </div>
                  <div className="font-mono text-[11px] text-[#525B6C]">
                    Byte disassembly, SputnikDAO proposals &amp; NEAR Intents 1Click quotes
                  </div>
                </div>
              </div>

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-black/20 bg-[#F9F9FA] px-3.5 py-2 font-mono text-[11px] font-bold text-black uppercase">
                <span>{showProofDrawer ? 'Hide' : 'Inspect'}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showProofDrawer ? 'rotate-180' : ''}`}
                />
              </span>
            </button>

            {record && (
              <div className="border-t border-black/15 bg-[#F9F9FA] p-4 sm:p-6">
                <LiveTestnetExecutePanel
                  record={record}
                  presetId={activePreset?.id}
                  bip143Input={activePreset?.bip143Input}
                  compact
                />
              </div>
            )}

            {showProofDrawer && record && (
              <div className="space-y-4 border-t border-black/15 bg-white p-6 text-xs sm:p-7">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="border border-black/15 bg-[#F9F9FA] p-4">
                    <div className="mb-2 font-mono text-[11px] font-bold text-black">
                      UNWRAPPED TRANSACTION AST ({record.decoded.kind.toUpperCase()})
                    </div>
                    <pre className="max-h-60 overflow-auto font-mono text-[11px] leading-relaxed text-[#374151]">
                      {JSON.stringify(record.decoded, null, 2)}
                    </pre>
                  </div>

                  <div className="space-y-4">
                    {record.mpcDispatch && (
                      <div className="border border-[#00C758]/50 bg-[#F0FDF4]/50 p-4">
                        <div className="mb-2 font-mono text-[11px] font-bold text-[#008138]">
                          CROSS-CONTRACT PROMISE ({record.mpcDispatch.firewallContractMethod} &rarr;{' '}
                          {record.mpcDispatch.signerContractId})
                        </div>
                        <pre className="max-h-48 overflow-auto font-mono text-[11px] text-black">
                          {JSON.stringify(record.mpcDispatch, null, 2)}
                        </pre>
                      </div>
                    )}

                    {record.daoProposalPayload && (
                      <div className="border border-[#D97706]/50 bg-[#FFFBEB]/60 p-4">
                        <div className="mb-2 font-mono text-[11px] font-bold text-[#B45309]">
                          SPUTNIKDAO PROPOSAL ({record.daoProposalPayload.contractId})
                        </div>
                        <pre className="max-h-48 overflow-auto font-mono text-[11px] text-black">
                          {JSON.stringify(record.daoProposalPayload, null, 2)}
                        </pre>
                      </div>
                    )}

                    {!record.mpcDispatch && !record.daoProposalPayload && (
                      <div className="border border-[#E11D48]/40 bg-[#FFF1F2] p-4 text-[#9F1239]">
                        <div className="font-mono text-[11px] font-bold uppercase">
                          Zero Dispatch Payload Generated ($0 Signed)
                        </div>
                        <p className="mt-1.5 text-xs">
                          MpcFirewall halted this payload during on-chain verification. No
                          cross-contract promise reached <code>v1.signer-prod.testnet</code>.
                        </p>
                      </div>
                    )}

                    <div className="border border-black/15 bg-[#F9F9FA] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-black uppercase">
                          NEAR Intents 1Click Confidential Quote
                        </span>
                        <button
                          type="button"
                          onClick={handlePreviewIntents}
                          disabled={quoteLoading}
                          className="rounded-[4px] bg-black px-3.5 py-1.5 font-mono text-[11px] font-bold text-white hover:bg-[#1F3CFF] disabled:opacity-50"
                        >
                          {quoteLoading ? 'Querying…' : 'Preview Confidential Quote'}
                        </button>
                      </div>
                      {quoteOutput && (
                        <pre className="mt-3 max-h-40 overflow-auto border border-black/10 bg-white p-3 font-mono text-[10px] text-[#374151]">
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
          BAND 7: MATTE BLACK ARCHITECTURAL FOOTER
         ===================================================================== */}
      <footer className="border-t border-white/15 bg-black text-white">
        <div className="mx-auto max-w-[1365px] px-4 py-16 sm:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="space-y-4 md:col-span-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#05DF72] text-black">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span className="font-display text-lg font-bold tracking-tight text-white">
                  MpcFirewall
                </span>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-white/65">
                Pre-signing EVM &amp; Bitcoin policy verification for NEAR Chain Signatures agents.
              </p>
            </div>

            <div className="space-y-3 md:col-span-2">
              <h3 className="font-mono text-[11px] font-bold tracking-wider text-white/50 uppercase">
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
              <h3 className="font-mono text-[11px] font-bold tracking-wider text-white/50 uppercase">
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
              <h3 className="font-mono text-[11px] font-bold tracking-wider text-white/50 uppercase">
                Testnet Contracts
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
        </div>
      </footer>
    </div>
  );
}
