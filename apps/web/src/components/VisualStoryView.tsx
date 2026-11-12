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
  loading: boolean;
  onInspect: () => void;
}

const STORY_MAP: Record<string, ScenarioStoryMeta> = {
  'safe-base-usdc': {
    index: '01',
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
    humanTitle: 'The Infinite Blank Check',
    plainSummary: 'Tricked assistant hides an unlimited token approval inside a routine rebate claim.',
    assistantClaim: 'Claim routine gas rebate on Base.',
    hiddenReality: 'Unlimited power-of-attorney check (MaxUint256) to a known drainer.',
    withoutResult: 'Entire $142,500 treasury drained',
    withResult: '$0.00 lost — blocked before reaching v1.signer',
    dollarBadge: '$142,500 Saved',
    illustration: '/illustrations/blank-check.jpg',
    networkLabel: 'Base • 8453'
  },
  'attack-nested-multicall': {
    index: '03',
    humanTitle: 'The Russian Nesting Doll',
    plainSummary: 'Smuggles a wallet-draining approval inside a bundle of harmless transfers.',
    assistantClaim: 'Execute routine router batch transfer (5 USDC).',
    hiddenReality: 'Outer box transfers 5 USDC; inner nesting doll grants infinite access.',
    withoutResult: 'Surface filters fooled — $142,500 drained',
    withResult: 'Unwrapped 2 layers deep & blocked at $0.00',
    dollarBadge: '$142,500 Saved',
    illustration: '/illustrations/nesting-dolls.jpg',
    networkLabel: 'Base Router • 8453'
  },
  'attack-wrong-chain': {
    index: '04',
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
  loading,
  onInspect
}: VisualStoryViewProps) {
  const [showProofDrawer, setShowProofDrawer] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteOutput, setQuoteOutput] = useState<string | null>(null);

  const activePreset = presets.find((p) => p.id === selectedPresetId) || presets[0] || null;
  const activeMeta = (activePreset && STORY_MAP[activePreset.id]) || FALLBACK_META;

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
      <section className="grid grid-cols-1 items-center gap-10 pt-4 lg:grid-cols-12">
        {/* Left Column: Strict 4-Element Hero Stack */}
        <div className="space-y-6 lg:col-span-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#DCE0E8] bg-white px-3.5 py-1.5 font-mono text-[11px] font-semibold tracking-wider text-[#1F3CFF] uppercase">
            01 / ZERO BLIND SIGNING FOR NEAR AGENTS
          </div>

          <h1 className="text-4xl font-extrabold tracking-[-0.04em] leading-[0.98] text-[#0B0F17] sm:text-5xl xl:text-[54px]">
            Never let your AI assistant sign a sealed envelope.
          </h1>

          <p className="max-w-[46ch] text-base leading-relaxed text-[#525B6C] sm:text-lg">
            Before your AI spends money across Ethereum, Base, or Bitcoin, MpcFirewall X-rays the
            package and blocks hidden traps.
          </p>

          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <button
              type="button"
              onClick={onInspect}
              disabled={loading}
              className="btn-roll group inline-flex items-center gap-2.5 rounded-full bg-[#1F3CFF] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_30px_-8px_rgba(31,60,255,0.45)] hover:bg-[#0B0F17] disabled:opacity-50"
            >
              <span className="btn-roll-inner">
                <span>{loading ? 'Scanning Envelope…' : 'Scan Selected Errand'}</span>
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>

            <a
              href="#scenarios"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE0E8] bg-white px-5 py-3.5 text-sm font-semibold text-[#0B0F17] hover:border-[#0B0F17]"
            >
              <span>Test 7 Scenarios</span>
              <ArrowDownRight className="h-4 w-4 text-[#525B6C]" />
            </a>
          </div>
        </div>

        {/* Right Column: Interactive 3D X-Ray Aperture & Draggable Lens */}
        <div className="lg:col-span-7">
          <InteractiveXRayStage
            preset={activePreset}
            meta={activeMeta}
            record={record}
            loading={loading}
            onInspect={onInspect}
          />
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: SWISS INDEX SCENARIO STRIP (01 — 07)
         ===================================================================== */}
      <section id="scenarios" className="scroll-mt-24 space-y-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-3xl font-extrabold tracking-[-0.035em] text-[#0B0F17] sm:text-4xl">
            Click any errand to X-ray what is really inside.
          </h2>
          <p className="text-base text-[#525B6C]">
            Seven real transactions built from actual Ethereum, Base, and Bitcoin bytes. Select one
            to watch how MpcFirewall responds in milliseconds.
          </p>
        </div>

        <div className="divide-y divide-[#E2E6EE] overflow-hidden rounded-[24px] border border-[#DCE0E8] bg-white shadow-[0_20px_40px_-24px_rgba(11,15,23,0.08)]">
          {presets.map((preset) => {
            const active = preset.id === selectedPresetId;
            const meta = STORY_MAP[preset.id] || FALLBACK_META;
            const isSafe = preset.badge === 'SAFE';
            const isDao = preset.badge === 'DAO_ESCALATION';

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`group flex w-full flex-col gap-4 px-6 py-5 text-left transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  active
                    ? 'bg-[#F0F4FF]'
                    : 'bg-white hover:bg-[#FAFBFD]'
                }`}
              >
                <div className="flex items-start gap-4 sm:items-center">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold transition-colors ${
                      active
                        ? 'bg-[#1F3CFF] text-white'
                        : 'border border-[#DCE0E8] bg-[#F4F5F8] text-[#0B0F17] group-hover:border-[#0B0F17]'
                    }`}
                  >
                    {meta.index}
                  </span>

                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-base font-bold tracking-tight text-[#0B0F17]">
                        {meta.humanTitle}
                      </span>
                      <span className="rounded-full border border-[#DCE0E8] bg-white px-2.5 py-0.5 font-mono text-[11px] text-[#525B6C]">
                        {meta.networkLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-[#525B6C]">{meta.plainSummary}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold ${
                      isSafe
                        ? 'bg-[#ECFDF5] text-[#059669]'
                        : isDao
                          ? 'bg-[#FFFBEB] text-[#D97706]'
                          : 'bg-[#FFF1F2] text-[#E11D48]'
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
                        : 'border-[#DCE0E8] bg-white text-[#0B0F17] group-hover:translate-x-0.5 group-hover:border-[#0B0F17]'
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
          <p className="text-base text-[#525B6C]">
            Existing NEAR Function Call Keys act like a lobby badge: they check who your AI
            assistant is, then let it walk straight up to the vault with a sealed black envelope.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Today Without MpcFirewall (Obsidian Field Card) */}
          <div className="flex flex-col justify-between rounded-[24px] bg-[#0B0F17] p-8 text-white shadow-xl">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-xs font-semibold text-[#FB7185]">
                  <Lock className="h-3.5 w-3.5" />
                  Today on NEAR (Without MpcFirewall)
                </span>
                <span className="font-mono text-xs text-white/50">Blind Signing</span>
              </div>

              <h3 className="text-2xl font-bold tracking-tight text-white">
                The vault stamps a 32-byte code blindfolded.
              </h3>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-3">
                <img
                  src="/illustrations/blind-envelope.jpg"
                  alt="Blindfolded notary stamping a sealed black envelope"
                  className="h-48 w-full object-contain"
                />
              </div>

              <p className="text-sm leading-relaxed text-white/75">
                When your AI assistant asks <code className="text-white">v1.signer</code> to sign an
                Ethereum or Bitcoin transfer, it only sends a 32-byte hash. A $25 bill and an
                infinite wallet drain look identical from the outside.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#F43F5E]/30 bg-[#F43F5E]/15 px-4 py-3 text-sm">
              <span className="text-white/80">If your assistant is tricked:</span>
              <strong className="font-bold text-[#FB7185]">{activeMeta.withoutResult}</strong>
            </div>
          </div>

          {/* Right: With MpcFirewall (Pure Paper Card) */}
          <div className="flex flex-col justify-between rounded-[24px] border border-[#DCE0E8] bg-white p-8 shadow-[0_20px_40px_-24px_rgba(11,15,23,0.08)]">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-3.5 py-1 text-xs font-semibold text-[#059669]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  With MpcFirewall (Drop-In Security Gate)
                </span>
                <span className="font-mono text-xs text-[#525B6C]">Zero Blind Signing</span>
              </div>

              <h3 className="text-2xl font-bold tracking-tight text-[#0B0F17]">
                Every layer is opened before the stamp is touched.
              </h3>

              <div className="overflow-hidden rounded-2xl border border-[#E2E6EE] bg-[#F7F9FC] p-3">
                <img
                  src="/illustrations/xray-conveyor.jpg"
                  alt="X-ray conveyor belt inspecting an open transparent box"
                  className="h-48 w-full object-contain"
                />
              </div>

              <p className="text-sm leading-relaxed text-[#525B6C]">
                We move the wallet&apos;s master stamp behind MpcFirewall&apos;s counter. Your
                assistant&apos;s NEAR keycard only opens our inspection window — if the package
                fails any rule, <code className="text-[#0B0F17]">v1.signer</code> is never called.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-sm">
              <span className="text-[#065F46]">Protected outcome:</span>
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
          <div className="inline-flex items-center gap-2 rounded-full border border-[#DCE0E8] bg-white px-3.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-[#1F3CFF] uppercase">
            02 / BUILT FOR THE NEAR AGENT ECONOMY
          </div>
          <h2 className="text-3xl font-extrabold tracking-[-0.035em] text-[#0B0F17] sm:text-4xl">
            How it plugs into your NEAR assistant in minutes.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cell 1 (7 Cols): Three Smart Spending Lanes */}
          <div className="flex flex-col justify-between rounded-[24px] border border-[#DCE0E8] bg-white p-7 lg:col-span-7">
            <div className="space-y-3">
              <h3 className="text-xl font-bold tracking-tight text-[#0B0F17]">
                Company Expense Rules for Your AI Assistant
              </h3>
              <p className="text-sm leading-relaxed text-[#525B6C]">
                Routine errands under <strong>$100 USDC</strong> pass automatically. Mid-sized bills
                (<strong>$100–$500 USDC</strong>) pause and create a human team vote on{' '}
                <strong>Trezu / SputnikDAO</strong>. Scams and unlimited approvals hit a brick wall.
              </p>
            </div>

            <div className="my-5 overflow-hidden rounded-2xl border border-[#E2E6EE] bg-[#F7F9FC] p-3">
              <img
                src="/illustrations/three-lanes.jpg"
                alt="Three spending lanes: green auto-pass, amber human team vote, red blocked wall"
                className="h-52 w-full object-contain"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-semibold">
              <div className="rounded-xl bg-[#ECFDF5] py-2 text-[#059669]">
                &le; $100 Auto-Signed
              </div>
              <div className="rounded-xl bg-[#FFFBEB] py-2 text-[#D97706]">
                $100–$500 Team Vote
              </div>
              <div className="rounded-xl bg-[#FFF1F2] py-2 text-[#E11D48]">
                Scams Blocked ($0)
              </div>
            </div>
          </div>

          {/* Cell 2 (5 Cols, Cobalt Tinted Surface): Private Lie Detector */}
          <div className="flex flex-col justify-between rounded-[24px] border border-[#C7D2FE] bg-[#EEF2FF] p-7 lg:col-span-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1F3CFF]">
                <Cpu className="h-3.5 w-3.5" />
                NEAR AI Cloud Confidential Enclave
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#0B0F17]">
                The Private AI Lie Detector
              </h3>
              <p className="text-sm leading-relaxed text-[#374151]">
                Before signing, a confidential check inside NEAR AI Cloud compares what your
                assistant <em>claimed</em> it was doing against what the unpacked math actually does
                — keeping your private prompts secret.
              </p>
            </div>

            <div className="my-5 overflow-hidden rounded-2xl border border-[#C7D2FE] bg-white p-3">
              <img
                src="/illustrations/ai-assistant.jpg"
                alt="Polite AI assistant with a sneaky prompt-injection bug"
                className="h-48 w-full object-contain"
              />
            </div>

            <div className="rounded-xl bg-white px-4 py-2.5 text-xs font-medium text-[#0B0F17]">
              Catches prompt-injected assistants before a single cent leaves your wallet.
            </div>
          </div>

          {/* Cell 3 (12 Cols): 3-Step Drop-In Integration */}
          <div className="grid grid-cols-1 items-center gap-8 rounded-[24px] border border-[#DCE0E8] bg-white p-7 lg:col-span-12 lg:grid-cols-12">
            <div className="overflow-hidden rounded-2xl border border-[#E2E6EE] bg-[#F7F9FC] p-3 lg:col-span-4">
              <img
                src="/illustrations/multichain-passport.jpg"
                alt="One protective shield over Bitcoin, Ethereum, and NEAR coins"
                className="h-44 w-full object-contain"
              />
            </div>

            <div className="space-y-5 lg:col-span-8">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-[#0B0F17]">
                  Drop Into Any Existing NEAR Agent Flow in 3 Steps
                </h3>
                <p className="mt-1 text-sm text-[#525B6C]">
                  Keep your existing AI brain, NEAR account, and Chain Signatures — just place
                  MpcFirewall in the middle.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E6E9F0] bg-[#FAFBFD] p-4">
                  <div className="font-mono text-xs font-bold text-[#1F3CFF]">STEP 01</div>
                  <div className="mt-1 text-sm font-bold text-[#0B0F17]">
                    Park the Checkbook
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#525B6C]">
                    Point your wallet&apos;s derivation path to <code className="text-[#0B0F17]">mpc-firewall.testnet</code> and add your assistant to <code className="text-[#0B0F17]">authorized_agents</code>.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E6E9F0] bg-[#FAFBFD] p-4">
                  <div className="font-mono text-xs font-bold text-[#1F3CFF]">STEP 02</div>
                  <div className="mt-1 text-sm font-bold text-[#0B0F17]">
                    Scope the Keycard
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#525B6C]">
                    Restrict the assistant&apos;s NEAR Function Call Key so it can only call MpcFirewall — never <code className="text-[#0B0F17]">v1.signer</code> directly.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E6E9F0] bg-[#FAFBFD] p-4">
                  <div className="font-mono text-xs font-bold text-[#1F3CFF]">STEP 03</div>
                  <div className="mt-1 text-sm font-bold text-[#0B0F17]">
                    Send Unsealed Bytes
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#525B6C]">
                    Pass the raw unsigned transaction + plain-English reason. MpcFirewall verifies, hashes on-chain, and calls <code className="text-[#0B0F17]">v1.signer</code>.
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
      <section className="overflow-hidden rounded-[24px] border border-[#DCE0E8] bg-white">
        <button
          type="button"
          onClick={() => setShowProofDrawer((v) => !v)}
          className="flex w-full items-center justify-between px-7 py-5 text-left transition-colors hover:bg-[#FAFBFD]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F5F8] text-[#0B0F17]">
              <Code2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#0B0F17]">
                Technical Judge Proof: Raw RLP Disassembly, Call Tree &amp; NEAR Payloads
              </div>
              <div className="text-xs text-[#525B6C]">
                Expand to inspect byte-level AST, v1.signer cross-contract promises, SputnikDAO proposals, and live NEAR Intents quotes
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE0E8] bg-[#FAFBFD] px-3.5 py-1.5 text-xs font-semibold text-[#0B0F17]">
            <span>{showProofDrawer ? 'Hide Proof' : 'Inspect Proof'}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showProofDrawer ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        {showProofDrawer && record && (
          <div className="space-y-4 border-t border-[#E2E6EE] bg-[#FAFBFD] p-7 text-xs">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#DCE0E8] bg-white p-4">
                <div className="mb-2 font-mono text-[11px] font-bold text-[#0B0F17]">
                  Unwrapped Transaction AST ({record.decoded.kind.toUpperCase()})
                </div>
                <pre className="max-h-60 overflow-auto font-mono text-[11px] leading-relaxed text-[#525B6C]">
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

                <div className="rounded-2xl border border-[#DCE0E8] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#0B0F17]">
                      NEAR Intents 1Click Confidential Quote
                    </span>
                    <button
                      type="button"
                      onClick={handlePreviewIntents}
                      disabled={quoteLoading}
                      className="rounded-full bg-[#0B0F17] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1F3CFF] disabled:opacity-50"
                    >
                      {quoteLoading ? 'Querying 1Click API…' : 'Preview Live Confidential Quote'}
                    </button>
                  </div>
                  {quoteOutput && (
                    <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-[#F4F5F8] p-3 font-mono text-[10px] text-[#525B6C]">
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
