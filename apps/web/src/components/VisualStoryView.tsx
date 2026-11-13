'use client';

import { useState } from 'react';
import type { FirewallEvaluationRecord, FirewallPolicy } from '@mpc-firewall/core';
import type { ScenarioPresetView } from '@/components/TxWorkbench';
import {
  InteractiveXRayStage,
  type ScenarioStoryMeta
} from '@/components/InteractiveXRayStage';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
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
          recipient: 'mpc-firewall.testnet',
          refundTo: 'mpc-firewall.testnet',
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
    <div className="space-y-20 pb-16">
      {/* =====================================================================
          SECTION 1: ASYMMETRIC SPLIT HERO + 3D INTERACTIVE X-RAY STAGE
         ===================================================================== */}
      <section className="grid grid-cols-1 items-center gap-10 pt-2 lg:grid-cols-12">
        {/* Left Column: High-Impact Editorial Pitch + Color Telemetry Strip */}
        <div className="space-y-6 lg:col-span-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-3.5 py-1.5 font-mono text-[11px] font-bold tracking-wider text-[#1F3CFF] uppercase shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#1F3CFF]" />
            01 / ZERO BLIND SIGNING FOR NEAR AGENTS
          </div>

          <h1 className="text-3xl font-extrabold tracking-[-0.04em] leading-[1.04] text-[#0B0F17] sm:text-5xl xl:text-[52px]">
            Never let your AI assistant{' '}
            <span className="bg-gradient-to-r from-[#1F3CFF] via-[#2563EB] to-[#059669] bg-clip-text text-transparent">
              sign a sealed envelope.
            </span>
          </h1>

          <p className="max-w-[46ch] text-sm leading-relaxed text-[#4A5568] sm:text-lg">
            Before your AI spends money across Ethereum, Base, or Bitcoin, MpcFirewall X-rays the
            raw transaction package on NEAR and blocks hidden traps cold.
          </p>

          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3.5">
              <button
                type="button"
                onClick={onInspect}
                disabled={loading}
                className="btn-roll group inline-flex w-full sm:w-auto cursor-pointer items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#1F3CFF] to-[#1528B0] px-6 py-3.5 text-sm font-bold text-white shadow-[0_14px_30px_-8px_rgba(31,60,255,0.5)] hover:from-[#0B0F17] hover:to-[#1E293B] disabled:opacity-75"
              >
                <span className="btn-roll-inner">
                  <span>
                    {loading
                      ? `X-Raying Errand ${activeMeta.index}…`
                      : `Scan Errand ${activeMeta.index} (${activeMeta.shortLabel})`}
                  </span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </button>

              <a
                href="#scenarios"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-full border border-[#DCE2EE] bg-white px-5 py-3.5 text-sm font-bold text-[#0B0F17] shadow-2xs hover:border-[#1F3CFF] hover:text-[#1F3CFF]"
              >
                <span>Explore All 7 Scenarios</span>
                <ArrowDownRight className="h-4 w-4 text-[#1F3CFF]" />
              </a>
            </div>

            {/* Live Scan Feedback Pill */}
            {(loading || scanPulseId > 0) && (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#DCE2EE] bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-[#0B0F17] shadow-2xs">
                <span
                  className={`h-2 w-2 rounded-full ${
                    loading
                      ? 'animate-ping bg-[#1F3CFF]'
                      : record?.decision.outcome === 'BLOCKED'
                        ? 'bg-[#E11D48]'
                        : record?.decision.outcome === 'ESCALATE_TO_DAO'
                          ? 'bg-[#D97706]'
                          : 'bg-[#059669]'
                  }`}
                />
                <span className="font-mono text-[10px] sm:text-[11px]">
                  {loading
                    ? `Unpacking RLP/ABI bytes & verifying policy on NEAR…`
                    : `Scan #${scanPulseId} Complete • ${activeMeta.humanTitle} → ${record?.decision.outcome ?? 'VERIFIED'}${lastScanDurationMs ? ` (${lastScanDurationMs}ms)` : ''}`}
                </span>
              </div>
            )}
          </div>

          {/* 3-Color Telemetry Strip */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 pt-2">
            <div className="rounded-xl sm:rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF]/80 p-2 sm:p-3 text-center sm:text-left">
              <div className="font-mono text-xs sm:text-sm font-extrabold text-[#1F3CFF]">100% Open</div>
              <div className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-[#374151]">
                RLP &amp; BTC Bytes
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5]/85 p-2 sm:p-3 text-center sm:text-left">
              <div className="font-mono text-xs sm:text-sm font-extrabold text-[#059669]">$0.00 Lost</div>
              <div className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-[#065F46]">
                5 Traps Blocked
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-[#FDE68A] bg-[#FFFBEB]/90 p-2 sm:p-3 text-center sm:text-left">
              <div className="font-mono text-xs sm:text-sm font-extrabold text-[#D97706]">3 Lanes</div>
              <div className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-[#92400E]">
                Auto, Vote, Block
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 3D X-Ray Aperture & 7-Scenario Switcher */}
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
      </section>

      {/* =====================================================================
          SECTION 2: COLOR-CODED SWISS INDEX SCENARIO STRIP (01 — 07)
         ===================================================================== */}
      <section id="scenarios" className="scroll-mt-24 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-3xl font-extrabold tracking-[-0.035em] text-[#0B0F17] sm:text-4xl">
              Click any errand to X-ray what is really inside.
            </h2>
            <p className="text-base text-[#4A5568]">
              Seven real transactions built from actual Ethereum, Base, and Bitcoin bytes. Click any
              row below (or use the switcher inside the 3D X-Ray stage above).
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-[#DCE2EE] bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterBadge('ALL')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                filterBadge === 'ALL'
                  ? 'bg-[#0B0F17] text-white'
                  : 'text-[#4A5568] hover:text-[#0B0F17]'
              }`}
            >
              All 7 Errands
            </button>
            <button
              type="button"
              onClick={() => setFilterBadge('SAFE')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                filterBadge === 'SAFE'
                  ? 'bg-[#059669] text-white'
                  : 'text-[#059669] hover:bg-[#ECFDF5]'
              }`}
            >
              Safe Auto-Sign
            </button>
            <button
              type="button"
              onClick={() => setFilterBadge('DAO_ESCALATION')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                filterBadge === 'DAO_ESCALATION'
                  ? 'bg-[#D97706] text-white'
                  : 'text-[#D97706] hover:bg-[#FFFBEB]'
              }`}
            >
              Team Vote
            </button>
            <button
              type="button"
              onClick={() => setFilterBadge('ATTACK')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                filterBadge === 'ATTACK'
                  ? 'bg-[#E11D48] text-white'
                  : 'text-[#E11D48] hover:bg-[#FFF1F2]'
              }`}
            >
              Blocked Traps
            </button>
          </div>
        </div>

        <div className="divide-y divide-[#E2E8F0] overflow-hidden rounded-[26px] border border-[#DCE2EE] bg-white shadow-[0_24px_48px_-24px_rgba(11,15,23,0.1)]">
          {filteredPresets.map((preset) => {
            const active = preset.id === selectedPresetId;
            const meta = STORY_MAP[preset.id] || FALLBACK_META;
            const isSafe = preset.badge === 'SAFE';
            const isDao = preset.badge === 'DAO_ESCALATION';

            const leftStripeColor = isSafe
              ? 'border-l-[#059669]'
              : isDao
                ? 'border-l-[#D97706]'
                : 'border-l-[#E11D48]';

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`group flex w-full flex-col gap-4 border-l-4 px-6 py-4.5 text-left transition-all sm:flex-row sm:items-center sm:justify-between ${leftStripeColor} ${
                  active
                    ? 'bg-gradient-to-r from-[#EEF2FF] via-[#F8FAFC] to-white'
                    : 'bg-white hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-start gap-4 sm:items-center">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-xs font-extrabold transition-colors ${
                      active
                        ? 'bg-[#1F3CFF] text-white shadow-[0_4px_12px_rgba(31,60,255,0.35)]'
                        : isSafe
                          ? 'bg-[#ECFDF5] text-[#059669]'
                          : isDao
                            ? 'bg-[#FFFBEB] text-[#D97706]'
                            : 'bg-[#FFF1F2] text-[#E11D48]'
                    }`}
                  >
                    {meta.index}
                  </span>

                  {/* Mini Custom Illustration Thumbnail */}
                  <div className="hidden h-13 w-18 shrink-0 overflow-hidden rounded-xl border border-[#DCE2EE] bg-[#F8FAFC] p-1 sm:flex sm:items-center sm:justify-center">
                    <img
                      src={meta.illustration}
                      alt={meta.humanTitle}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-base font-extrabold tracking-tight text-[#0B0F17]">
                        {meta.humanTitle}
                      </span>
                      <span className="rounded-full border border-[#DCE2EE] bg-white px-2.5 py-0.5 font-mono text-[11px] font-medium text-[#4A5568]">
                        {meta.networkLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-[#4A5568]">{meta.plainSummary}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-bold ${
                      isSafe
                        ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
                        : isDao
                          ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]'
                          : 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48]'
                    }`}
                  >
                    {isSafe && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {isDao && <Landmark className="h-3.5 w-3.5" />}
                    {!isSafe && !isDao && <ShieldAlert className="h-3.5 w-3.5" />}
                    <span>{meta.dollarBadge}</span>
                  </span>

                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
                      active
                        ? 'border-[#1F3CFF] bg-[#1F3CFF] text-white'
                        : 'border-[#DCE2EE] bg-white text-[#0B0F17] group-hover:translate-x-0.5 group-hover:border-[#1F3CFF] group-hover:text-[#1F3CFF]'
                    }`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: SIDE-BY-SIDE ARCHITECTURAL CONSEQUENCE STAGE
         ===================================================================== */}
      <section className="space-y-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-3xl font-extrabold tracking-[-0.035em] text-[#0B0F17] sm:text-4xl">
            Why current NEAR agent locks cannot see the trap.
          </h2>
          <p className="text-base text-[#4A5568]">
            Existing NEAR Function Call Keys act like a lobby badge: they check who your AI
            assistant is, then let it walk straight up to the vault with a sealed black envelope.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Today Without MpcFirewall (Obsidian Field Card) */}
          <div className="obsidian-grid flex flex-col justify-between rounded-[26px] border border-[#1E293B] bg-[#0B0F17] p-8 text-white shadow-xl">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#F43F5E]/40 bg-[#F43F5E]/15 px-3.5 py-1 text-xs font-bold text-[#FDA4AF]">
                  <Lock className="h-3.5 w-3.5 text-[#F43F5E]" />
                  Today on NEAR (Without MpcFirewall)
                </span>
                <span className="font-mono text-xs text-white/50">Blind Signing</span>
              </div>

              <h3 className="text-2xl font-extrabold tracking-tight text-white">
                The vault stamps a 32-byte code blindfolded.
              </h3>

              <div className="overflow-hidden rounded-2xl border border-white/15 bg-white p-3">
                <img
                  src="/illustrations/blind-envelope.jpg"
                  alt="Blindfolded notary stamping a sealed black envelope"
                  className="h-48 w-full object-contain"
                />
              </div>

              <p className="text-sm leading-relaxed text-white/80">
                When your AI assistant asks <code className="text-white">v1.signer</code> to sign an
                Ethereum or Bitcoin transfer, it only sends a 32-byte hash. A $25 bill and an
                infinite wallet drain look identical from the outside.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#F43F5E]/40 bg-[#F43F5E]/20 px-4 py-3 text-sm">
              <span className="text-white/85">If your assistant is tricked:</span>
              <strong className="font-bold text-[#FDA4AF]">{activeMeta.withoutResult}</strong>
            </div>
          </div>

          {/* Right: With MpcFirewall (Tinted Emerald-Cobalt Card) */}
          <div className="flex flex-col justify-between rounded-[26px] border-2 border-[#6EE7B7] bg-gradient-to-br from-[#ECFDF5]/90 via-white to-[#EEF2FF]/90 p-8 shadow-[0_24px_48px_-24px_rgba(5,150,105,0.18)]">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#6EE7B7] bg-[#059669] px-3.5 py-1 text-xs font-bold text-white shadow-2xs">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  With MpcFirewall (Drop-In Security Gate)
                </span>
                <span className="font-mono text-xs font-semibold text-[#059669]">
                  Zero Blind Signing
                </span>
              </div>

              <h3 className="text-2xl font-extrabold tracking-tight text-[#0B0F17]">
                Every layer is opened before the stamp is touched.
              </h3>

              <div className="overflow-hidden rounded-2xl border border-[#A7F3D0] bg-white p-3 shadow-xs">
                <img
                  src="/illustrations/xray-conveyor.jpg"
                  alt="X-ray conveyor belt inspecting an open transparent box"
                  className="h-48 w-full object-contain"
                />
              </div>

              <p className="text-sm leading-relaxed text-[#374151]">
                We move the wallet&apos;s master stamp behind MpcFirewall&apos;s counter. Your
                assistant&apos;s NEAR keycard only opens our inspection window — if the package
                fails any rule, <code className="font-semibold text-[#0B0F17]">v1.signer</code> is
                never called.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#6EE7B7] bg-[#ECFDF5] px-4 py-3 text-sm">
              <span className="font-medium text-[#065F46]">Protected outcome:</span>
              <strong className="font-bold text-[#059669]">{activeMeta.withResult}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 4: 3-CELL ASYMMETRIC BENTO GRID (HOW IT FITS IN NEAR)
         ===================================================================== */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-3.5 py-1 font-mono text-[11px] font-bold tracking-wider text-[#1F3CFF] uppercase">
            02 / BUILT FOR THE NEAR AGENT ECONOMY
          </div>
          <h2 className="text-3xl font-extrabold tracking-[-0.035em] text-[#0B0F17] sm:text-4xl">
            How it plugs into your NEAR assistant in minutes.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cell 1 (7 Cols): Three Smart Spending Lanes */}
          <div className="flex flex-col justify-between rounded-[26px] border border-[#DCE2EE] bg-gradient-to-b from-white to-[#F8FAFC] p-7 shadow-[0_20px_40px_-24px_rgba(11,15,23,0.08)] lg:col-span-7">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1 text-xs font-bold text-[#059669]">
                <Landmark className="h-3.5 w-3.5" />
                3-Tier Autonomous Treasury Policy
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-[#0B0F17]">
                Company Expense Rules for Your AI Assistant
              </h3>
              <p className="text-sm leading-relaxed text-[#4A5568]">
                Routine errands under <strong>$100 USDC</strong> pass automatically. Mid-sized bills
                (<strong>$100–$500 USDC</strong>) pause and create a human team vote on{' '}
                <strong>Trezu / SputnikDAO</strong>. Scams and unlimited approvals hit a brick wall.
              </p>
            </div>

            <div className="my-5 overflow-hidden rounded-2xl border border-[#DCE2EE] bg-white p-3 shadow-2xs">
              <img
                src="/illustrations/three-lanes.jpg"
                alt="Three spending lanes: green auto-pass, amber human team vote, red blocked wall"
                className="h-52 w-full object-contain"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-bold">
              <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] py-2.5 text-[#059669]">
                &le; $100 Auto-Signed
              </div>
              <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] py-2.5 text-[#D97706]">
                $100–$500 Team Vote
              </div>
              <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2] py-2.5 text-[#E11D48]">
                Scams Blocked ($0)
              </div>
            </div>
          </div>

          {/* Cell 2 (5 Cols, Vibrant Cobalt-Indigo Surface): Private Lie Detector */}
          <div className="flex flex-col justify-between rounded-[26px] border-2 border-[#A5B4FC] bg-gradient-to-br from-[#EEF2FF] via-[#E0E7FF] to-[#DBEAFE] p-7 shadow-[0_20px_40px_-24px_rgba(31,60,255,0.18)] lg:col-span-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1F3CFF] px-3 py-1 text-xs font-bold text-white shadow-2xs">
                <Cpu className="h-3.5 w-3.5" />
                NEAR AI Cloud Confidential Enclave
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-[#0B0F17]">
                The Private AI Lie Detector
              </h3>
              <p className="text-sm leading-relaxed text-[#1E293B]">
                Before signing, a confidential check inside NEAR AI Cloud compares what your
                assistant <em>claimed</em> it was doing against what the unpacked math actually does
                — keeping your private prompts secret.
              </p>
            </div>

            <div className="my-5 overflow-hidden rounded-2xl border border-[#A5B4FC] bg-white p-3 shadow-xs">
              <img
                src="/illustrations/ai-assistant.jpg"
                alt="Polite AI assistant with a sneaky prompt-injection bug"
                className="h-48 w-full object-contain"
              />
            </div>

            <div className="rounded-xl border border-[#C7D2FE] bg-white px-4 py-2.5 text-xs font-bold text-[#1F3CFF]">
              Catches prompt-injected assistants before a single cent leaves your wallet.
            </div>
          </div>

          {/* Cell 3 (12 Cols, Deep Obsidian-to-Cobalt Architectural Banner): 3-Step Integration */}
          <div className="grid grid-cols-1 items-center gap-8 rounded-[26px] border border-[#1E293B] bg-gradient-to-r from-[#0B0F17] via-[#111827] to-[#1E1B4B] p-8 text-white shadow-xl lg:col-span-12 lg:grid-cols-12">
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-white p-3 lg:col-span-4">
              <img
                src="/illustrations/multichain-passport.jpg"
                alt="One protective shield over Bitcoin, Ethereum, and NEAR coins"
                className="h-44 w-full object-contain"
              />
            </div>

            <div className="space-y-5 lg:col-span-8">
              <div>
                <span className="inline-block rounded-full bg-[#1F3CFF]/30 px-3 py-1 font-mono text-[11px] font-bold text-[#93C5FD]">
                  ZERO WORKFLOW DISRUPTION
                </span>
                <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-white">
                  Drop Into Any Existing NEAR Agent Flow in 3 Steps
                </h3>
                <p className="mt-1 text-sm text-white/75">
                  Keep your existing AI brain, NEAR account, and Chain Signatures — just place
                  MpcFirewall in the middle.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#60A5FA]/30 bg-[#1F3CFF]/15 p-4">
                  <div className="font-mono text-xs font-extrabold text-[#60A5FA]">STEP 01</div>
                  <div className="mt-1 text-sm font-bold text-white">
                    Park the Checkbook
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/75">
                    Point your wallet&apos;s derivation path to{' '}
                    <code className="text-[#93C5FD]">mpc-firewall.testnet</code> and add your
                    assistant to <code className="text-[#93C5FD]">authorized_agents</code>.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#34D399]/30 bg-[#059669]/15 p-4">
                  <div className="font-mono text-xs font-extrabold text-[#34D399]">STEP 02</div>
                  <div className="mt-1 text-sm font-bold text-white">
                    Scope the Keycard
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/75">
                    Restrict the assistant&apos;s NEAR Function Call Key so it can only call
                    MpcFirewall — never <code className="text-[#6EE7B7]">v1.signer</code> directly.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#FBBF24]/30 bg-[#D97706]/15 p-4">
                  <div className="font-mono text-xs font-extrabold text-[#FBBF24]">STEP 03</div>
                  <div className="mt-1 text-sm font-bold text-white">
                    Send Unsealed Bytes
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/75">
                    Pass the raw unsigned transaction + plain-English reason. MpcFirewall verifies,
                    hashes on-chain, and calls <code className="text-[#FDE68A]">v1.signer</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: QUIET CRYPTOGRAPHIC PROOF DRAWER (FOR TECHNICAL JUDGES)
         ===================================================================== */}
      <section className="overflow-hidden rounded-[26px] border border-[#DCE2EE] bg-white shadow-xs">
        <button
          type="button"
          onClick={() => setShowProofDrawer((v) => !v)}
          className="flex w-full items-center justify-between px-7 py-5 text-left transition-colors hover:bg-[#F8FAFC]"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#1F3CFF]">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-[#0B0F17]">
                Technical Judge Proof: Raw RLP Disassembly, Call Tree &amp; NEAR Payloads
              </div>
              <div className="text-xs text-[#4A5568]">
                Expand to inspect byte-level AST, v1.signer cross-contract promises, SputnikDAO
                proposals, and live NEAR Intents quotes
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-1.5 text-xs font-bold text-[#1F3CFF]">
            <span>{showProofDrawer ? 'Hide Proof' : 'Inspect Proof'}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showProofDrawer ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        {showProofDrawer && record && (
          <div className="space-y-4 border-t border-[#E2E8F0] bg-[#F8FAFC] p-7 text-xs">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#DCE2EE] bg-white p-4">
                <div className="mb-2 font-mono text-[11px] font-bold text-[#0B0F17]">
                  Unwrapped Transaction AST ({record.decoded.kind.toUpperCase()})
                </div>
                <pre className="max-h-60 overflow-auto font-mono text-[11px] leading-relaxed text-[#4A5568]">
                  {JSON.stringify(record.decoded, null, 2)}
                </pre>
              </div>

              <div className="space-y-4">
                {record.mpcDispatch && (
                  <div className="rounded-2xl border border-[#A7F3D0] bg-white p-4">
                    <div className="mb-2 font-mono text-[11px] font-bold text-[#059669]">
                      Cross-Contract Promise ({record.mpcDispatch.firewallContractMethod} &rarr;{' '}
                      {record.mpcDispatch.signerContractId})
                    </div>
                    <pre className="max-h-48 overflow-auto font-mono text-[11px] text-[#0B0F17]">
                      {JSON.stringify(record.mpcDispatch, null, 2)}
                    </pre>
                  </div>
                )}

                {record.daoProposalPayload && (
                  <div className="rounded-2xl border border-[#FDE68A] bg-white p-4">
                    <div className="mb-2 font-mono text-[11px] font-bold text-[#D97706]">
                      Generated Trezu / SputnikDAO Proposal ({record.daoProposalPayload.contractId})
                    </div>
                    <pre className="max-h-48 overflow-auto font-mono text-[11px] text-[#0B0F17]">
                      {JSON.stringify(record.daoProposalPayload, null, 2)}
                    </pre>
                  </div>
                )}

                {!record.mpcDispatch && !record.daoProposalPayload && (
                  <div className="rounded-2xl border border-[#FECDD3] bg-[#FFF1F2] p-4 text-[#9F1239]">
                    <div className="font-bold">Zero Dispatch Payload Generated ($0 Signed)</div>
                    <p className="mt-1 text-xs">
                      Because MpcFirewall blocked this transaction during on-chain verification, no
                      cross-contract call was ever dispatched to <code>v1.signer-prod.testnet</code>.
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-[#DCE2EE] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#0B0F17]">
                      NEAR Intents 1Click Confidential Quote
                    </span>
                    <button
                      type="button"
                      onClick={handlePreviewIntents}
                      disabled={quoteLoading}
                      className="rounded-full bg-[#1F3CFF] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#0B0F17] disabled:opacity-50"
                    >
                      {quoteLoading ? 'Querying 1Click API…' : 'Preview Live Confidential Quote'}
                    </button>
                  </div>
                  {quoteOutput && (
                    <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-[#F4F5F8] p-3 font-mono text-[10px] text-[#4A5568]">
                      {quoteOutput}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
