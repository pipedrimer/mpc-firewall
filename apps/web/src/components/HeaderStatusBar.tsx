'use client';

import Link from 'next/link';
import { BookOpen, CheckCircle2, KeyRound, Layers, RefreshCw, ShieldCheck, Terminal } from 'lucide-react';

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
  firewallContractId?: string;
  firewallContractDeployed?: boolean;
  firewallCodeHash?: string;
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
    <header className="sticky top-0 z-50 border-b border-black/15 bg-white/95 backdrop-blur-md">
      {/* Responsive wrap on <md, crisp Swiss single-row on md+ */}
      <div className="mx-auto flex max-w-[1365px] flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 py-2.5 sm:px-8 md:h-[72px] md:flex-nowrap md:gap-4 md:py-0">
        {/* Left: Brand Identity */}
        <div className="order-1 flex shrink-0 items-center gap-3">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-black text-white">
            <ShieldCheck className="h-4 w-4 text-[#05DF72]" />
            <span className="absolute -right-1 -top-1 flex h-2 w-2 rounded-xs bg-[#05DF72]" />
          </div>

          <div className="flex items-center gap-3">
            <span className="font-display text-base sm:text-lg font-bold tracking-[-0.03em] text-black">
              MpcFirewall
            </span>
            <span className="hidden items-center gap-1.5 border-l border-black/15 pl-3 font-mono text-[11px] font-medium text-[#525B6C] lg:inline-flex">
              <span className="h-1.5 w-1.5 rounded-xs bg-[#00C758]" />
              {health?.mpcSignerContractId ?? 'v1.signer-prod.testnet'}
            </span>
          </div>
        </div>

        {/* Center on md+ / Full-width 2nd row on mobile: Studio vs. Protocol Mode Switcher */}
        <nav
          aria-label="Console view mode"
          className="order-3 grid w-full grid-cols-2 items-center rounded-[4px] border border-black/15 bg-[#F9F9FA] p-0.5 md:order-2 md:flex md:w-auto md:shrink-0"
        >
          <button
            type="button"
            onClick={() => onChangeViewMode('story')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-[3px] px-3 sm:px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
              viewMode === 'story'
                ? 'bg-black text-white'
                : 'text-[#525B6C] hover:text-black'
            }`}
          >
            <Layers className={`h-3.5 w-3.5 shrink-0 ${viewMode === 'story' ? 'text-[#05DF72]' : 'text-[#525B6C]'}`} />
            <span>
              <span className="hidden sm:inline">Interactive </span>
              X-Ray Studio
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChangeViewMode('protocol')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-[3px] px-3 sm:px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
              viewMode === 'protocol'
                ? 'bg-black text-white'
                : 'text-[#525B6C] hover:text-black'
            }`}
          >
            <Terminal className={`h-3.5 w-3.5 shrink-0 ${viewMode === 'protocol' ? 'text-[#05DF72]' : 'text-[#525B6C]'}`} />
            <span>Protocol Inspector</span>
          </button>
        </nav>

        {/* Right: Sharp Action Controls */}
        <div className="order-2 flex shrink-0 items-center gap-1.5 sm:gap-2 text-xs md:order-3">
          {/* Live Testnet RPC Key Button */}
          <button
            type="button"
            onClick={onCheckRpc}
            disabled={checkingRpc}
            title={
              rpc?.mpcRootPublicKey
                ? `Live NEAR Testnet Root Key (${health?.mpcSignerContractId ?? 'v1.signer-prod.testnet'}): ${rpc.mpcRootPublicKey}${rpc.firewallContractDeployed ? ` • Firewall WASM live on ${rpc.firewallContractId}` : ''}`
                : 'Query live NEAR Testnet RPC for v1.signer-prod.testnet root key & mpc-firewall.testnet state'
            }
            className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-[4px] border px-2.5 sm:px-3 py-1.5 font-medium whitespace-nowrap transition-all disabled:opacity-50 ${
              shortKey
                ? 'border-[#00C758]/50 bg-[#F0FDF4] text-[#032E15]'
                : 'border-black/15 bg-white text-black hover:border-black hover:bg-black hover:text-white'
            }`}
          >
            {shortKey ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#00A544]" />
            ) : (
              <KeyRound className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="font-mono text-[10px] sm:text-[11px]">
              {shortKey
                ? `Key: ${shortKey}…`
                : checkingRpc
                  ? 'Probing…'
                  : 'Verify Key'}
            </span>
          </button>

          {/* Docs Link */}
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-black/15 bg-white px-2.5 sm:px-3 py-1.5 font-semibold text-black whitespace-nowrap transition-all hover:border-black hover:bg-black hover:text-white"
            title="Integration & Protocol Documentation"
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#1F3CFF]" />
            <span className="text-[11px] sm:text-xs">Docs</span>
          </Link>

          {/* Reset Demo State */}
          <button
            type="button"
            onClick={onResetDemo}
            className="group inline-flex items-center gap-1 sm:gap-1.5 rounded-[4px] border border-black/15 bg-white px-2.5 sm:px-3 py-1.5 font-semibold text-black whitespace-nowrap transition-all hover:border-black hover:bg-black hover:text-white"
            title="Reset demo state"
            aria-label="Reset demo state"
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0 transition-transform duration-300 group-hover:rotate-180" />
            <span className="hidden sm:inline text-xs">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
