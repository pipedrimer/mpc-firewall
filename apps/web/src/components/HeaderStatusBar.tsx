'use client';

import { RefreshCw, ShieldAlert, ShieldCheck, Cpu, KeyRound } from 'lucide-react';

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
  onResetDemo: () => void;
  onCheckRpc: () => void;
  checkingRpc: boolean;
}

function formatUsdcUnits(units: string): string {
  const n = Number(units || '0') / 1_000_000;
  return `${n.toFixed(2)} USDC`;
}

export function HeaderStatusBar({
  health,
  rpc,
  dailySpentUnits,
  maxDailyUnits,
  onResetDemo,
  onCheckRpc,
  checkingRpc
}: HeaderStatusBarProps) {
  return (
    <header className="border-b border-[#1e2935] bg-[#0d1217]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#00ec97]/30 bg-[#00ec97]/10 text-[#00ec97]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-[#eef2f6]">MpcFirewall</h1>
              <span className="rounded border border-[#00ec97]/30 bg-[#00ec97]/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[#00ec97]">
                Zero Blind Signing
              </span>
            </div>
            <p className="text-xs text-[#8b9bb0]">
              On-chain RLP, ABI calldata &amp; Bitcoin decoder protecting NEAR Chain Signatures (
              <code className="font-mono text-[#eef2f6]">v1.signer</code>)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 rounded-md border border-[#1e2935] bg-[#131a21] px-2.5 py-1.5">
            <Cpu className="h-3.5 w-3.5 text-[#00ec97]" />
            <span className="text-[#8b9bb0]">TEE Audit:</span>
            <span className="font-mono text-[#eef2f6]">
              {health?.nearAiMode === 'near-ai-live' ? 'NEAR AI LIVE' : 'LOCAL ED25519 ENCLAVE'}
              {health?.strictLiveTee ? ' (STRICT)' : ''}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-md border border-[#1e2935] bg-[#131a21] px-2.5 py-1.5 tabular-nums">
            <ShieldAlert className="h-3.5 w-3.5 text-[#f59e0b]" />
            <span className="text-[#8b9bb0]">Daily Spend:</span>
            <span className="font-mono text-[#eef2f6]">
              {formatUsdcUnits(dailySpentUnits)} / {formatUsdcUnits(maxDailyUnits)}
            </span>
          </div>

          <button
            type="button"
            onClick={onCheckRpc}
            disabled={checkingRpc}
            className="flex items-center gap-1.5 rounded-md border border-[#1e2935] bg-[#131a21] px-2.5 py-1.5 text-[#eef2f6] hover:border-[#00ec97]/50 disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#00ec97]" />
            <span className="font-mono">
              {rpc?.mpcRootPublicKey
                ? `MPC Key: ${rpc.mpcRootPublicKey.slice(0, 14)}…`
                : checkingRpc
                  ? 'Checking NEAR RPC…'
                  : `Probe ${health?.mpcSignerContractId ?? 'v1.signer-prod.testnet'}`}
            </span>
          </button>

          <button
            type="button"
            onClick={onResetDemo}
            className="flex items-center gap-1.5 rounded-md border border-[#1e2935] bg-[#131a21] px-2.5 py-1.5 text-[#8b9bb0] hover:border-[#2e3d4f] hover:text-[#eef2f6]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset State</span>
          </button>
        </div>
      </div>
    </header>
  );
}

