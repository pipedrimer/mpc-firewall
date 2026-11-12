'use client';

import { CheckCircle2, KeyRound, Layers, RefreshCw, ShieldCheck, Terminal } from 'lucide-react';

export interface HealthSnapshot {
  nearNetworkId: string;
  mpcSignerContractId: string;
  firewallContractId: string;
  nearAiMode: string;
  strictLiveTee?: boolean;
  adminAuthEnabled?: boolean;
}

export interface NearRpcSnapshot {
  ok: boolean;
  exists: boolean;
  mpcRootPublicKey?: string;
  error?: string;
}

interface HeaderStatusBarProps {
  health: HealthSnapshot | null;
  rpc: NearRpcSnapshot | null;
  dailySpentUnits: string;
  maxDailyUnits: string;
  viewMode: 'story' | 'protocol';
  onChangeViewMode: (mode: 'story' | 'protocol') => void;
  onResetDemo: () => void;
  onCheckRpc: () => void;
  checkingRpc: boolean;
}

function formatUsdcShort(units: string): string {
  const n = Number(units || '0') / 1_000_000;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function HeaderStatusBar({
  health,
  rpc,
  dailySpentUnits,
  maxDailyUnits,
  viewMode,
  onChangeViewMode,
  onResetDemo,
  onCheckRpc,
  checkingRpc
}: HeaderStatusBarProps) {
  const spentNum = Number(dailySpentUnits || '0');
  const maxNum = Math.max(1, Number(maxDailyUnits || '1000000000'));
  const spentPct = Math.min(100, Math.max(4, Math.round((spentNum / maxNum) * 100)));

  const shortKey = rpc?.mpcRootPublicKey
    ? rpc.mpcRootPublicKey.replace('secp256k1:', '').slice(0, 6)
    : null;

  return (
    <header className="sticky top-0 z-50 border-b border-[#DCE2EE] bg-white/92 backdrop-blur-xl shadow-[0_10px_30px_-15px_rgba(11,15,23,0.07)]">
      {/* Top Optical Spectrum Accent Line */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#1F3CFF] via-[#059669] to-[#D97706]" />

      {/* Strict single-line non-wrapping container */}
      <div className="mx-auto flex h-[66px] max-w-[1400px] flex-nowrap items-center justify-between gap-3 px-5 whitespace-nowrap">
        {/* Left: Brand Identity */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1F3CFF] via-[#1528B0] to-[#0B0F17] text-white shadow-[0_6px_16px_-3px_rgba(31,60,255,0.45)]">
            <ShieldCheck className="h-4.5 w-4.5 text-white" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-white bg-[#059669]" />
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-base font-extrabold tracking-tight text-[#0B0F17]">
              MpcFirewall
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#065F46] xl:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
              {health?.mpcSignerContractId ?? 'v1.signer-prod.testnet'}
            </span>
          </div>
        </div>

        {/* Center: Studio vs. Protocol Mode Switcher */}
        <nav
          aria-label="Console view mode"
          className="flex shrink-0 items-center rounded-full border border-[#DCE2EE] bg-[#F2F4F9] p-1 shadow-inner"
        >
          <button
            type="button"
            onClick={() => onChangeViewMode('story')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
              viewMode === 'story'
                ? 'bg-gradient-to-r from-[#0B0F17] to-[#1E293B] text-white shadow-[0_4px_12px_rgba(11,15,23,0.18)]'
                : 'text-[#525B6C] hover:text-[#0B0F17]'
            }`}
          >
            <Layers className={`h-3.5 w-3.5 ${viewMode === 'story' ? 'text-[#60A5FA]' : 'text-[#525B6C]'}`} />
            <span>Interactive X-Ray Studio</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeViewMode('protocol')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
              viewMode === 'protocol'
                ? 'bg-gradient-to-r from-[#0B0F17] to-[#1E293B] text-white shadow-[0_4px_12px_rgba(11,15,23,0.18)]'
                : 'text-[#525B6C] hover:text-[#0B0F17]'
            }`}
          >
            <Terminal className={`h-3.5 w-3.5 ${viewMode === 'protocol' ? 'text-[#34D399]' : 'text-[#525B6C]'}`} />
            <span>Protocol Inspector</span>
          </button>
        </nav>

        {/* Right: Single-Row Telemetry & Actions (Never Wraps) */}
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {/* Today's AI Spend Cap Pill */}
          <div
            className="hidden items-center gap-2.5 rounded-full border border-[#DCE2EE] bg-[#F8FAFC] px-3 py-1.5 tabular-nums lg:flex"
            title="Daily cumulative spending limit for your AI assistant ($1,000/day max so it cannot drain your wallet via many small transfers)"
          >
            <span className="text-[11px] font-medium text-[#525B6C]">Today&apos;s AI Spend:</span>
            <span className="font-mono text-xs font-bold text-[#0B0F17]">
              {formatUsdcShort(dailySpentUnits)} / {formatUsdcShort(maxDailyUnits)}
            </span>
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#E2E8F0]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#059669] to-[#1F3CFF] transition-all duration-500"
                style={{ width: `${spentNum === 0 ? 0 : spentPct}%` }}
              />
            </div>
          </div>

          {/* Fixed-Width Live Testnet RPC Key Button (Never expands or wraps header) */}
          <button
            type="button"
            onClick={onCheckRpc}
            disabled={checkingRpc}
            title={
              rpc?.mpcRootPublicKey
                ? `Live NEAR Testnet Root Key (${health?.mpcSignerContractId ?? 'v1.signer-prod.testnet'}): ${rpc.mpcRootPublicKey}`
                : 'Query live NEAR Testnet RPC for v1.signer-prod.testnet root public key'
            }
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold transition-all disabled:opacity-50 ${
              shortKey
                ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                : 'border-[#C7D2FE] bg-[#EEF2FF] text-[#1F3CFF] hover:bg-[#1F3CFF] hover:text-white'
            }`}
          >
            {shortKey ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
            ) : (
              <KeyRound className="h-3.5 w-3.5" />
            )}
            <span className="font-mono text-[11px]">
              {shortKey
                ? `Key: ${shortKey}…`
                : checkingRpc
                  ? 'Probing…'
                  : 'Verify MPC Key'}
            </span>
          </button>

          {/* Reset Demo State */}
          <button
            type="button"
            onClick={onResetDemo}
            className="group inline-flex items-center gap-1.5 rounded-full border border-[#DCE2EE] bg-white px-3 py-1.5 font-semibold text-[#0B0F17] transition-all hover:border-[#0B0F17] hover:bg-[#0B0F17] hover:text-white"
            title="Reset daily AI spend counter ($0) and replay history"
          >
            <RefreshCw className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-180" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
