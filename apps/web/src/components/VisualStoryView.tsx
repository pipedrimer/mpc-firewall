'use client';

import { useState } from 'react';
import type { FirewallEvaluationRecord, FirewallPolicy } from '@mpc-firewall/core';
import type { ScenarioPresetView } from '@/components/TxWorkbench';
import {
  AlertOctagon,
  ArrowRight,
  Bot,
  CheckCircle2,
  Code2,
  Coins,
  Cpu,
  Eye,
  KeyRound,
  Layers,
  Lock,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Unlock,
  Zap
} from 'lucide-react';

interface VisualStoryViewProps {
  presets: ScenarioPresetView[];
  selectedPresetId: string;
  onSelectPreset: (preset: ScenarioPresetView) => void;
  record: FirewallEvaluationRecord | null;
  policy: FirewallPolicy | null;
  loading: boolean;
  onInspect: () => void;
  dailySpentUnits: string;
  onResetDemo: () => void;
  onCheckRpc: () => void;
  checkingRpc: boolean;
  rpcRootKey?: string;
}

const SCENARIO_META: Record<
  string,
  {
    icon: string;
    subtitle: string;
    tag: string;
    targetNetwork: string;
    unprotectedOutcome: string;
    financialImpact: string;
  }
> = {
  'safe-base-usdc': {
    icon: '☕',
    subtitle: 'Routine $25 vendor invoice on Base',
    tag: 'Safe Errand',
    targetNetwork: 'Base (EVM 8453)',
    unprotectedOutcome: 'Signed normally via v1.signer',
    financialImpact: '$25.00 USDC legit payment'
  },
  'attack-unlimited-approve': {
    icon: '💣',
    subtitle: 'Hidden ERC-20 approve(drainer, MaxUint256)',
    tag: 'Blank Check Scam',
    targetNetwork: 'Base (EVM 8453)',
    unprotectedOutcome: 'Hacker drains 100% of foreign wallet later',
    financialImpact: '💀 $142,500 USDC DRAINED'
  },
  'attack-nested-multicall': {
    icon: '🪆',
    subtitle: 'Multicall bundle smuggling hidden approve',
    tag: 'Trojan Nesting Doll',
    targetNetwork: 'Base Router (EVM 8453)',
    unprotectedOutcome: 'Hacker bypasses surface filters inside multicall',
    financialImpact: '💀 $142,500 USDC DRAINED'
  },
  'attack-wrong-chain': {
    icon: '⛓️',
    subtitle: 'Claims Base, but RLP encodes Ethereum Mainnet',
    tag: 'Wrong-Chain Trap',
    targetNetwork: 'Ethereum Mainnet (EVM 1)',
    unprotectedOutcome: 'Replayed on wrong chain without authorization',
    financialImpact: '💀 0.05 ETH wasted / leaked'
  },
  'attack-nft-approval': {
    icon: '🖼️',
    subtitle: 'Blanket setApprovalForAll(operator, true)',
    tag: 'NFT Sweeper Drain',
    targetNetwork: 'Base NFT (EVM 8453)',
    unprotectedOutcome: 'Thief steals entire NFT collection in one tx',
    financialImpact: '💀 100% NFTs TRANSFERRED'
  },
  'escalate-dao-250usdc': {
    icon: '🏛️',
    subtitle: 'Legit $250 invoice (> $100 auto-cap)',
    tag: 'DAO Governance',
    targetNetwork: 'Base (EVM 8453)',
    unprotectedOutcome: 'Signed autonomously without team approval',
    financialImpact: '⚠️ $250.00 spent without human sign-off'
  },
  'attack-btc-hijack': {
    icon: '₿',
    subtitle: 'Raw Bitcoin tx diverting 250,000 sats',
    tag: 'BTC Hijack',
    targetNetwork: 'Bitcoin Network',
    unprotectedOutcome: 'Bitcoin redirected to unapproved scriptPubKey',
    financialImpact: '💀 250,000 Satoshis STOLEN'
  }
};

export function VisualStoryView({
  presets,
  selectedPresetId,
  onSelectPreset,
  record,
  policy,
  loading,
  onInspect,
  dailySpentUnits,
  onResetDemo,
  onCheckRpc,
  checkingRpc,
  rpcRootKey
}: VisualStoryViewProps) {
  const [showDeepProof, setShowDeepProof] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteOutput, setQuoteOutput] = useState<string | null>(null);

  const activePreset = presets.find((p) => p.id === selectedPresetId) || presets[0] || null;
  const meta = (activePreset && SCENARIO_META[activePreset.id]) || {
    icon: '⚡',
    subtitle: activePreset?.description || 'Simulate AI assistant transactions',
    tag: activePreset?.badge || 'SCENARIO',
    targetNetwork: activePreset?.chainKind === 'bitcoin' ? 'Bitcoin' : 'Base (EVM)',
    unprotectedOutcome: 'Blindly stamped by v1.signer',
    financialImpact: 'Unknown financial risk'
  };

  const spentUsdc = Number(dailySpentUnits || '0') / 1_000_000;
  const maxUsdc = Number(policy?.maxDailyTokenUnits || '1000000000') / 1_000_000;
  const spentPct = Math.min(100, Math.round((spentUsdc / (maxUsdc || 1)) * 100));

  const outcome = record?.decision.outcome;
  const isBlocked = outcome === 'BLOCKED';
  const isApproved = outcome === 'APPROVED_FOR_MPC_SIGN';
  const isEscalated = outcome === 'ESCALATE_TO_DAO';

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
    <div className="space-y-6">
      {/* Top Hero Banner & Quick Stats */}
      <section className="relative overflow-hidden rounded-2xl border border-[#1e2935] bg-gradient-to-br from-[#0d1217] via-[#101720] to-[#0a0e12] p-5 shadow-2xl">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#00ec97]/40 bg-[#00ec97]/10 text-[#00ec97] shadow-[0_0_20px_rgba(0,236,151,0.25)]">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#eef2f6]">
                  AI Assistant Security Operations
                </h1>
                <span className="rounded-full border border-[#00ec97]/40 bg-[#00ec97]/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#00ec97]">
                  Zero Blind Signing Active
                </span>
              </div>
              <p className="mt-1 text-xs text-[#8b9bb0]">
                Airport X-ray inspection gateway protecting NEAR Chain Signatures (
                <code className="text-[#00ec97]">v1.signer</code>) from prompt-injected AI agent transactions.
              </p>
            </div>
          </div>

          {/* Quick interactive controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live RPC Probe */}
            <button
              type="button"
              onClick={onCheckRpc}
              disabled={checkingRpc}
              className="flex items-center gap-1.5 rounded-xl border border-[#1e2935] bg-[#131a21] px-3 py-2 text-xs text-[#eef2f6] shadow-sm hover:border-[#00ec97]/60 hover:text-[#00ec97]"
            >
              <KeyRound className="h-4 w-4 text-[#00ec97]" />
              <span className="font-mono">
                {rpcRootKey
                  ? `MPC Root Key: ${rpcRootKey.slice(0, 12)}…`
                  : checkingRpc
                    ? 'Probing NEAR RPC…'
                    : 'Probe v1.signer-prod.testnet'}
              </span>
            </button>

            {/* Daily spend readout */}
            <div className="flex items-center gap-2.5 rounded-xl border border-[#1e2935] bg-[#131a21] px-3 py-2 text-xs">
              <Coins className="h-4 w-4 text-[#f59e0b]" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8b9bb0]">Daily Assistant Spend</div>
                <div className="font-mono font-semibold text-[#eef2f6]">
                  {spentUsdc.toFixed(2)} / {maxUsdc.toFixed(2)} USDC
                </div>
              </div>
              <div className="h-2 w-16 overflow-hidden rounded-full bg-[#1e2935]">
                <div
                  className="h-full bg-gradient-to-r from-[#00ec97] to-[#10b981] transition-all duration-300"
                  style={{ width: `${spentPct}%` }}
                />
              </div>
            </div>

            {/* Reset */}
            <button
              type="button"
              onClick={onResetDemo}
              className="flex items-center gap-1.5 rounded-xl border border-[#1e2935] bg-[#131a21] px-3 py-2 text-xs text-[#8b9bb0] hover:border-[#2e3d4f] hover:text-[#eef2f6]"
              title="Reset daily spend and replay cache"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset State</span>
            </button>
          </div>
        </div>
      </section>

      {/* STEP 1: ONE-CLICK SCENARIO SELECTOR (3D CARDS) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00ec97]/15 font-mono text-xs font-bold text-[#00ec97]">
              1
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#eef2f6]">
              Select AI Assistant Action &amp; Attack Sandbox
            </h2>
          </div>
          <span className="text-xs text-[#8b9bb0]">Click any scenario to simulate live</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {presets.map((preset) => {
            const active = preset.id === selectedPresetId;
            const pMeta = SCENARIO_META[preset.id] || {
              icon: '⚡',
              subtitle: preset.description,
              tag: preset.badge
            };
            const isSafe = preset.badge === 'SAFE';
            const isDao = preset.badge === 'DAO_ESCALATION';

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`card-3d relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                  active
                    ? isSafe
                      ? 'border-[#00ec97] bg-gradient-to-b from-[#00ec97]/15 to-[#0d1217] shadow-[0_12px_30px_-10px_rgba(0,236,151,0.3)]'
                      : isDao
                        ? 'border-[#f59e0b] bg-gradient-to-b from-[#f59e0b]/15 to-[#0d1217] shadow-[0_12px_30px_-10px_rgba(245,158,11,0.3)]'
                        : 'border-[#f43f5e] bg-gradient-to-b from-[#f43f5e]/15 to-[#0d1217] shadow-[0_12px_30px_-10px_rgba(244,63,94,0.3)]'
                    : 'border-[#1e2935] bg-[#0d1217] hover:border-[#2e3d4f]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-2xl">{pMeta.icon}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                        isSafe
                          ? 'bg-[#00ec97]/15 text-[#00ec97]'
                          : isDao
                            ? 'bg-[#f59e0b]/15 text-[#f59e0b]'
                            : 'bg-[#f43f5e]/15 text-[#f43f5e]'
                      }`}
                    >
                      {preset.badge}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-[#eef2f6]">{preset.title.replace(/^\d+\.\s*/, '')}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] text-[#8b9bb0]">{pMeta.subtitle}</div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#1e2935]/60 pt-2 text-[10px]">
                  <span className="font-mono text-[#8b9bb0]">{preset.chainKind.toUpperCase()}</span>
                  <span
                    className={`font-semibold ${
                      active ? 'text-[#eef2f6]' : 'text-[#8b9bb0] group-hover:text-[#eef2f6]'
                    }`}
                  >
                    {active ? '● Selected' : 'Select →'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* STEP 2: THE 3D AIRPORT X-RAY INSPECTION BELT */}
      <section className="relative rounded-2xl border border-[#1e2935] bg-[#0d1217] p-5 shadow-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#1e2935] pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00ec97]/15 font-mono text-xs font-bold text-[#00ec97]">
              2
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#eef2f6]">
              Live Airport X-Ray Inspection Belt
            </h2>
          </div>

          {/* Big Action Button */}
          <button
            type="button"
            disabled={loading}
            onClick={onInspect}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00ec97] to-[#10b981] px-5 py-2.5 text-xs font-bold text-[#070a0d] shadow-[0_0_25px_rgba(0,236,151,0.35)] hover:from-[#19f4a6] hover:to-[#22c55e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{loading ? 'X-Raying Bytes & Evaluating Policy…' : 'Run Inspection & Intercept Attacks'}</span>
          </button>
        </div>

        {/* The 4 Inspection Gates (Horizontal Pipeline) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {/* Gate 1: AI Assistant Intent */}
          <div className="glass-panel relative flex flex-col justify-between rounded-xl p-3.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-[#8b9bb0]">GATE 1</span>
                <Bot className="h-4 w-4 text-[#00ec97]" />
              </div>
              <div className="mt-2 text-xs font-bold text-[#eef2f6]">AI Assistant Intent</div>
              <div className="mt-1 rounded border border-[#1e2935] bg-[#090d11] p-2 font-mono text-[11px] text-[#eef2f6]">
                &ldquo;{activePreset?.agentIntent || 'Select or inspect a transaction below…'}&rdquo;
              </div>
            </div>
            <div className="mt-2 text-[10px] text-[#8b9bb0]">Target: {meta.targetNetwork}</div>
          </div>

          {/* Gate 2: On-Chain RLP / ABI Unwrapper */}
          <div className="glass-panel relative flex flex-col justify-between rounded-xl p-3.5">
            {loading && <div className="animate-xray-scan absolute inset-x-0 h-1 bg-[#00ec97]" />}
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-[#8b9bb0]">GATE 2</span>
                <Layers className="h-4 w-4 text-[#2563eb]" />
              </div>
              <div className="mt-2 text-xs font-bold text-[#eef2f6]">On-Chain X-Ray Decoder</div>
              <div className="mt-1 text-[11px] text-[#8b9bb0]">
                Unwraps raw transaction bytes &amp; recursive <code className="text-[#eef2f6]">multicall</code> trees
                up to depth 3 in Rust Wasm.
              </div>
            </div>
            <div className="mt-2 font-mono text-[10px] text-[#00ec97]">
              {record ? `Decoded ${record.decoded.kind.toUpperCase()} Bytes` : 'Awaiting inspection…'}
            </div>
          </div>

          {/* Gate 3: NEAR AI Cloud TEE Audit */}
          <div className="glass-panel relative flex flex-col justify-between rounded-xl p-3.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-[#8b9bb0]">GATE 3</span>
                <Cpu className="h-4 w-4 text-[#7c3aed]" />
              </div>
              <div className="mt-2 text-xs font-bold text-[#eef2f6]">Private TEE Lie Detector</div>
              <div className="mt-1 text-[11px] text-[#8b9bb0]">
                Confidential audit compares stated assistant reason against decoded math without leaking prompts.
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 font-mono text-[10px] text-[#7c3aed]">
              <Sparkles className="h-3 w-3" />
              <span>{record?.teeAudit?.signatureVerified ? 'TEE Sig Verified' : 'Ed25519 Enclave'}</span>
            </div>
          </div>

          {/* Gate 4: Spend Caps & Vault Stamp */}
          <div className="glass-panel relative flex flex-col justify-between rounded-xl p-3.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-[#8b9bb0]">GATE 4</span>
                <Lock className="h-4 w-4 text-[#f59e0b]" />
              </div>
              <div className="mt-2 text-xs font-bold text-[#eef2f6]">Policy &amp; Vault Stamp</div>
              <div className="mt-1 text-[11px] text-[#8b9bb0]">
                Auto-approves &le; $100 USDC, escalates &le; $500 to SputnikDAO, and blocks unlimited approvals cold.
              </div>
            </div>
            <div className="mt-2 font-mono text-[10px]">
              {outcome ? (
                <span
                  className={
                    isApproved ? 'text-[#00ec97]' : isEscalated ? 'text-[#f59e0b]' : 'font-bold text-[#f43f5e]'
                  }
                >
                  {outcome}
                </span>
              ) : (
                <span className="text-[#8b9bb0]">Ready to stamp</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* STEP 3: SHOCK-VALUE SIDE-BY-SIDE OUTCOME (WITHOUT VS WITH MPCFIREWALL) */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00ec97]/15 font-mono text-xs font-bold text-[#00ec97]">
            3
          </span>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#eef2f6]">
            The Verdict: What Happened to Your Treasury?
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Card A: Without MpcFirewall (Current NEAR Chain Signatures) */}
          <div className="relative overflow-hidden rounded-2xl border border-[#f43f5e]/40 bg-gradient-to-b from-[#f43f5e]/10 to-[#0d1217] p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#f43f5e]/30 pb-3">
              <div className="flex items-center gap-2">
                <Unlock className="h-5 w-5 text-[#f43f5e]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#f43f5e]">
                  Without MpcFirewall (Blind Signing)
                </span>
              </div>
              <span className="rounded bg-[#f43f5e]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#f43f5e]">
                UNPROTECTED
              </span>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="text-[#8b9bb0]">What NEAR validators &amp; Function Call Keys saw:</span>
                <div className="mt-1 break-all rounded border border-[#1e2935] bg-[#090d11] p-2 font-mono text-[11px] text-[#f59e0b]">
                  {record?.decoded.sighashPayloadHex || '0x7a2d40fdb3a173f09524c6f82439f4edba352f082853f4db0d6c01dd7e63cf55'}
                </div>
                <div className="mt-1 text-[11px] text-[#8b9bb0]">
                  An opaque 32-byte hash. Neither NEAR keys nor humans could tell what check was inside.
                </div>
              </div>

              <div className="rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/15 p-3">
                <div className="flex items-center gap-2 font-bold text-[#fecdd3]">
                  <TrendingDown className="h-4 w-4 text-[#f43f5e]" />
                  <span>Unprotected Outcome:</span>
                </div>
                <div className="mt-1 font-semibold text-[#fecdd3]">{meta.unprotectedOutcome}</div>
                <div className="mt-1 text-base font-bold text-[#f43f5e]">{meta.financialImpact}</div>
              </div>
            </div>
          </div>

          {/* Card B: With MpcFirewall (Zero-Blind-Signing) */}
          <div
            className={`relative overflow-hidden rounded-2xl border p-5 shadow-lg transition-all ${
              isApproved
                ? 'border-[#00ec97]/60 bg-gradient-to-b from-[#00ec97]/15 to-[#0d1217] shadow-[0_10px_35px_-10px_rgba(0,236,151,0.25)]'
                : isEscalated
                  ? 'border-[#f59e0b]/60 bg-gradient-to-b from-[#f59e0b]/15 to-[#0d1217] shadow-[0_10px_35px_-10px_rgba(245,158,11,0.25)]'
                  : 'border-[#00ec97]/40 bg-gradient-to-b from-[#00ec97]/10 to-[#0d1217]'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#00ec97]/30 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#00ec97]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#00ec97]">
                  With MpcFirewall (Protected Flow)
                </span>
              </div>
              <span className="rounded bg-[#00ec97]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#00ec97]">
                ZERO BLIND SIGNING
              </span>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              {record ? (
                <>
                  <div
                    className={`rounded-xl border p-3 ${
                      isApproved
                        ? 'border-[#00ec97]/40 bg-[#00ec97]/15'
                        : isEscalated
                          ? 'border-[#f59e0b]/40 bg-[#f59e0b]/15'
                          : 'border-[#00ec97]/40 bg-[#00ec97]/15'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#eef2f6]">{record.decision.outcome}</span>
                      <span className="rounded bg-[#070a0d] px-2 py-0.5 font-mono text-[10px] text-[#00ec97]">
                        {isBlocked ? '🛡️ INTERCEPTED AT $0' : isApproved ? '✅ SIGNED' : '🏛️ ESCALATED'}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-[#eef2f6]">
                      {record.decision.reasons.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-[#1e2935] bg-[#090d11] p-3 text-xs text-[#8b9bb0]">
                    <span className="font-semibold text-[#eef2f6]">Protected Treasury Impact:</span>
                    <div className="mt-1 text-sm font-bold text-[#00ec97]">
                      {isBlocked
                        ? '🛡️ $0.00 Lost — Malicious Signature Blocked Before v1.signer'
                        : isApproved
                          ? '✅ $25.00 USDC Authorized & Stamped Safely'
                          : '🏛️ Paused — Sent to Trezu / SputnikDAO Multisig Proposal'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[#8b9bb0]">
                  <p>Click &ldquo;Run Inspection &amp; Intercept Attacks&rdquo; above to watch the firewall evaluate this transaction.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* COLLAPSIBLE DEEP PROTOCOL PROOF (FOR TECHNICAL JUDGES) */}
      <section className="rounded-xl border border-[#1e2935] bg-[#0d1217] p-4">
        <button
          type="button"
          onClick={() => setShowDeepProof((prev) => !prev)}
          className="flex w-full items-center justify-between text-left text-xs font-semibold text-[#eef2f6] hover:text-[#00ec97]"
        >
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-[#00ec97]" />
            <span>Deep Cryptographic Disassembly &amp; On-Chain Verification Proof</span>
          </div>
          <span className="font-mono text-[11px] text-[#8b9bb0]">
            {showDeepProof ? 'Hide Details ▲' : 'Show Details ▼'}
          </span>
        </button>

        {showDeepProof && record && (
          <div className="mt-4 space-y-3 border-t border-[#1e2935] pt-4 text-xs">
            {/* Decoded AST Hierarchy */}
            <div className="rounded-lg border border-[#1e2935] bg-[#090d11] p-3">
              <div className="mb-2 font-mono text-[11px] font-semibold text-[#00ec97]">
                Decoded Transaction Structure &amp; Unwrapped Call Tree
              </div>
              <pre className="max-h-60 overflow-auto font-mono text-[10px] leading-relaxed text-[#8b9bb0]">
                {JSON.stringify(record.decoded, null, 2)}
              </pre>
            </div>

            {/* Cross-Contract Dispatch or DAO Proposal */}
            {record.mpcDispatch && (
              <div className="rounded-lg border border-[#00ec97]/30 bg-[#090d11] p-3">
                <div className="mb-1 font-mono text-[11px] font-semibold text-[#00ec97]">
                  Authorized Cross-Contract Promise: {record.mpcDispatch.firewallContractMethod} &rarr;{' '}
                  {record.mpcDispatch.signerContractId}
                </div>
                <pre className="max-h-40 overflow-auto font-mono text-[10px] text-[#eef2f6]">
                  {JSON.stringify(record.mpcDispatch, null, 2)}
                </pre>
              </div>
            )}

            {record.daoProposalPayload && (
              <div className="rounded-lg border border-[#f59e0b]/30 bg-[#090d11] p-3">
                <div className="mb-1 font-mono text-[11px] font-semibold text-[#f59e0b]">
                  Generated SputnikDAO / Trezu Multisig Proposal ({record.daoProposalPayload.contractId})
                </div>
                <pre className="max-h-40 overflow-auto font-mono text-[10px] text-[#eef2f6]">
                  {JSON.stringify(record.daoProposalPayload, null, 2)}
                </pre>
              </div>
            )}

            {/* NEAR Intents Quote */}
            <div className="border-t border-[#1e2935] pt-3">
              <button
                type="button"
                onClick={handlePreviewIntents}
                disabled={quoteLoading}
                className="flex items-center gap-2 rounded-lg border border-[#1e2935] bg-[#131a21] px-3 py-2 text-xs text-[#eef2f6] hover:border-[#00ec97]"
              >
                <Zap className="h-3.5 w-3.5 text-[#00ec97]" />
                <span>
                  {quoteLoading
                    ? 'Querying 1Click API…'
                    : 'Preview Confidential Intents Treasury Refuel Quote (confidentiality: advanced)'}
                </span>
              </button>
              {quoteOutput && (
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-[#1e2935] bg-[#090d11] p-2.5 font-mono text-[10px] text-[#8b9bb0]">
                  {quoteOutput}
                </pre>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
