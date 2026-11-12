'use client';

import { KeyRound, Layers, RefreshCw, ShieldCheck, Terminal } from 'lucide-react';

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

  return (
    <header className="sticky top-0 z-50 border-b border-[#DCE2EE] bg-white/90 backdrop-blur-xl shadow-[0_10px_30px_-15px_rgba(11,15,23,0.07)]">
      {/* Top Optical Spectrum Accent Line */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#1F3CFF] via-[#059669] to-[#D97706]" />

      <div className="mx-auto flex min-h-[72px] max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-2.5">
        {/* Left: Brand Identity & Active Signer Target */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1F3CFF] via-[#1528B0] to-[#0B0F17] text-white shadow-[0_6px_18px_-3px_rgba(31,60,255,0.45)]">
            <ShieldCheck className="h-5 w-5 text-white" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-white bg-[#059669]" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-base font-extrabold tracking-tight text-[#0B0F17]">
                MpcFirewall
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#065F46] sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
                {health?.mpcSignerContractId ?? 'v1.signer-prod.testnet'}
              </span>
            </div>
            <p className="hidden text-[11px] font-medium text-[#525B6C] sm:block">
              On-Chain X-Ray Gate for NEAR AI Assistants
            </p>
          </div>
        </div>

        {/* Center: Studio vs. Protocol Mode Switcher */}
        <nav
          aria-label="Console view mode"
          className="flex items-center rounded-full border border-[#DCE2EE] bg-[#F2F4F9] p-1 shadow-inner"
        >
          <button
            type="button"
            onClick={() => onChangeViewMode('story')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
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
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              viewMode === 'protocol'
                ? 'bg-gradient-to-r from-[#0B0F17] to-[#1E293B] text-white shadow-[0_4px_12px_rgba(11,15,23,0.18)]'
                : 'text-[#525B6C] hover:text-[#0B0F17]'
            }`}
          >
            <Terminal className={`h-3.5 w-3.5 ${viewMode === 'protocol' ? 'text-[#34D399]' : 'text-[#525B6C]'}`} />
            <span>Protocol Inspector</span>
          </button>
        </nav>

        {/* Right: Visual Allowance Meter + Live RPC Probe + Reset */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* Visual Allowance Meter Pill */}
          <div className="hidden items-center gap-3 rounded-full border border-[#DCE2EE] bg-[#F8FAFC] px-3.5 py-1.5 tabular-nums xl:flex">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#525B6C]">Auto Budget:</span>
                <span className="font-mono text-xs font-bold text-[#0B0F17]">
                  {formatUsdcShort(dailySpentUnits)}
                </span>
                <span className="text-[11px] text-[#525B6C]">
                  / {formatUsdcShort(maxDailyUnits)} USDC
                </span>
              </div>
              <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#059669] to-[#1F3CFF] transition-all duration-500"
                  style={{ width: `${spentNum === 0 ? 0 : spentPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Live Testnet RPC Key Probe */}
          <button
            type="button"
            onClick={onCheckRpc}
            disabled={checkingRpc}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-3.5 py-2 font-semibold text-[#1F3CFF] transition-all hover:bg-[#1F3CFF] hover:text-white hover:shadow-[0_6px_16px_-4px_rgba(31,60,255,0.4)] disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span className="font-mono text-[11px]">
              {rpc?.mpcRootPublicKey
                ? `MPC Key: ${rpc.mpcRootPublicKey.slice(0, 14)}…`
                : checkingRpc
                  ? 'Probing Testnet…'
                  : 'Verify Live MPC Key'}
            </span>
          </button>

          {/* Reset Demo State */}
          <button
            type="button"
            onClick={onResetDemo}
            className="group inline-flex items-center gap-1.5 rounded-full border border-[#DCE2EE] bg-white px-3.5 py-2 font-semibold text-[#0B0F17] transition-all hover:border-[#0B0F17] hover:bg-[#0B0F17] hover:text-white"
            title="Reset demo state and daily budget"
          >
            <RefreshCw className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-180" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
