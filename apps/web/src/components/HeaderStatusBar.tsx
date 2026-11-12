'use client';

import { KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';

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
  return (
    <header className="sticky top-0 z-40 h-[68px] border-b border-[#E2E6EE] bg-[#F4F5F8]/90 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between gap-4 px-5">
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B0F17] text-white">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold tracking-tight text-[#0B0F17]">
              MpcFirewall
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-[#DCE0E8] bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#525B6C] md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
              {health?.mpcSignerContractId ?? 'v1.signer-prod.testnet'}
            </span>
          </div>
        </div>

        {/* Center View Mode Switcher */}
        <nav
          aria-label="Console view mode"
          className="flex items-center rounded-full border border-[#DCE0E8] bg-white p-1 shadow-xs"
        >
          <button
            type="button"
            onClick={() => onChangeViewMode('story')}
            className={`rounded-full px-4 py-1 text-xs font-semibold transition-all ${
              viewMode === 'story'
                ? 'bg-[#0B0F17] text-white'
                : 'text-[#525B6C] hover:text-[#0B0F17]'
            }`}
          >
            Interactive X-Ray Studio
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('protocol')}
            className={`rounded-full px-4 py-1 text-xs font-semibold transition-all ${
              viewMode === 'protocol'
                ? 'bg-[#0B0F17] text-white'
                : 'text-[#525B6C] hover:text-[#0B0F17]'
            }`}
          >
            Protocol Inspector
          </button>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2 text-xs">
          <div className="hidden items-center gap-2 rounded-full border border-[#DCE0E8] bg-white px-3.5 py-1.5 tabular-nums lg:flex">
            <span className="text-[#525B6C]">Daily Allowance:</span>
            <span className="font-semibold text-[#0B0F17]">
              {formatUsdcShort(dailySpentUnits)} / {formatUsdcShort(maxDailyUnits)} USDC
            </span>
          </div>

          <button
            type="button"
            onClick={onCheckRpc}
            disabled={checkingRpc}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE0E8] bg-white px-3.5 py-1.5 font-medium text-[#0B0F17] hover:border-[#1F3CFF] hover:text-[#1F3CFF] disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#1F3CFF]" />
            <span className="font-mono text-[11px]">
              {rpc?.mpcRootPublicKey
                ? `MPC Key: ${rpc.mpcRootPublicKey.slice(0, 14)}…`
                : checkingRpc
                  ? 'Probing RPC…'
                  : 'Probe v1.signer-prod.testnet'}
            </span>
          </button>

          <button
            type="button"
            onClick={onResetDemo}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE0E8] bg-white px-3 py-1.5 font-medium text-[#525B6C] hover:border-[#0B0F17] hover:text-[#0B0F17]"
            title="Reset demo state and daily budget"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset State</span>
          </button>
        </div>
      </div>
    </header>
  );
}
