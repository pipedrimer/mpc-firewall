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

export function HeaderStatusBar({
  health,
  rpc,
  viewMode,
  onChangeViewMode,
  onResetDemo,
  onCheckRpc,
  checkingRpc
}: HeaderStatusBarProps) {
  const shortKey = rpc?.mpcRootPublicKey
    ? rpc.mpcRootPublicKey.replace('secp256k1:', '').slice(0, 6)
    : null;

  return (
    <header className="sticky top-0 z-50 border-b border-[#DCE2EE] bg-white/92 backdrop-blur-xl shadow-[0_10px_30px_-15px_rgba(11,15,23,0.07)]">
      {/* Top Optical Spectrum Accent Line */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#1F3CFF] via-[#059669] to-[#D97706]" />

      {/* Responsive single-line container with smooth horizontal scroll fallback */}
      <div className="mx-auto flex h-[62px] sm:h-[66px] max-w-[1400px] flex-nowrap items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 whitespace-nowrap overflow-x-auto no-scrollbar">
        {/* Left: Brand Identity */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1F3CFF] via-[#1528B0] to-[#0B0F17] text-white shadow-[0_6px_16px_-3px_rgba(31,60,255,0.45)]">
            <ShieldCheck className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-white" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-white bg-[#059669]" />
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-extrabold tracking-tight text-[#0B0F17]">
              MpcFirewall
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#065F46] lg:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
              {health?.mpcSignerContractId ?? 'v1.signer-prod.testnet'}
            </span>
          </div>
        </div>

        {/* Center: Studio vs. Protocol Mode Switcher */}
        <nav
          aria-label="Console view mode"
          className="flex shrink-0 items-center rounded-full border border-[#DCE2EE] bg-[#F2F4F9] p-0.5 sm:p-1 shadow-inner"
        >
          <button
            type="button"
            onClick={() => onChangeViewMode('story')}
            className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs font-bold transition-all ${
              viewMode === 'story'
                ? 'bg-gradient-to-r from-[#0B0F17] to-[#1E293B] text-white shadow-[0_4px_12px_rgba(11,15,23,0.18)]'
                : 'text-[#525B6C] hover:text-[#0B0F17]'
            }`}
          >
            <Layers className={`h-3.5 w-3.5 ${viewMode === 'story' ? 'text-[#60A5FA]' : 'text-[#525B6C]'}`} />
            <span>
              <span className="hidden sm:inline">Interactive </span>
              X-Ray
              <span className="hidden md:inline"> Studio</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChangeViewMode('protocol')}
            className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs font-bold transition-all ${
              viewMode === 'protocol'
                ? 'bg-gradient-to-r from-[#0B0F17] to-[#1E293B] text-white shadow-[0_4px_12px_rgba(11,15,23,0.18)]'
                : 'text-[#525B6C] hover:text-[#0B0F17]'
            }`}
          >
            <Terminal className={`h-3.5 w-3.5 ${viewMode === 'protocol' ? 'text-[#34D399]' : 'text-[#525B6C]'}`} />
            <span>
              <span className="hidden sm:inline">Protocol </span>
              Inspector
            </span>
          </button>
        </nav>

        {/* Right: Clean Action Buttons Only */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 text-xs">
          {/* Live Testnet RPC Key Button */}
          <button
            type="button"
            onClick={onCheckRpc}
            disabled={checkingRpc}
            title={
              rpc?.mpcRootPublicKey
                ? `Live NEAR Testnet Root Key (${health?.mpcSignerContractId ?? 'v1.signer-prod.testnet'}): ${rpc.mpcRootPublicKey}`
                : 'Query live NEAR Testnet RPC for v1.signer-prod.testnet root public key'
            }
            className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full border px-2.5 sm:px-3.5 py-1 sm:py-1.5 font-semibold transition-all disabled:opacity-50 ${
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
            <span className="font-mono text-[10px] sm:text-[11px]">
              {shortKey
                ? `Key: ${shortKey}…`
                : checkingRpc
                  ? 'Probing…'
                  : 'Verify Key'}
            </span>
          </button>

          {/* Reset Demo State */}
          <button
            type="button"
            onClick={onResetDemo}
            className="group inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-[#DCE2EE] bg-white px-2.5 sm:px-3.5 py-1 sm:py-1.5 font-semibold text-[#0B0F17] transition-all hover:border-[#0B0F17] hover:bg-[#0B0F17] hover:text-white"
            title="Reset demo state"
          >
            <RefreshCw className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-180" />
            <span className="hidden xs:inline text-[11px] sm:text-xs">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
