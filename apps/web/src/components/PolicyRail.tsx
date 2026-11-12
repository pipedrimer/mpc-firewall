'use client';

import type { FirewallPolicy } from '@mpc-firewall/core';
import { Lock, Settings2 } from 'lucide-react';

interface PolicyRailProps {
  policy: FirewallPolicy | null;
  saving: boolean;
  adminAuthEnabled: boolean;
  adminToken: string;
  onChangeAdminToken: (val: string) => void;
  onToggleRule: (patch: Partial<FirewallPolicy>) => void;
}

function formatUnits6(units: string): string {
  return `${(Number(units || '0') / 1_000_000).toLocaleString()} USDC`;
}

export function PolicyRail({
  policy,
  saving,
  adminAuthEnabled,
  adminToken,
  onChangeAdminToken,
  onToggleRule
}: PolicyRailProps) {
  if (!policy) {
    return (
      <aside className="rounded-xl border border-[#1e2935] bg-[#0d1217] p-4">
        <p className="text-xs text-[#8b9bb0]">Loading firewall policy…</p>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-[#1e2935] bg-[#0d1217] p-4">
      <div className="flex items-center justify-between border-b border-[#1e2935] pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[#00ec97]" />
          <h2 className="text-sm font-semibold text-[#eef2f6]">On-Chain Policy Gate</h2>
        </div>
        {saving && <span className="font-mono text-[10px] text-[#00ec97]">SAVING…</span>}
      </div>

      <div className="rounded-lg border border-[#1e2935] bg-[#131a21] p-3 text-xs">
        <div className="mb-1.5 flex items-center gap-1.5 font-medium text-[#eef2f6]">
          <Lock className="h-3.5 w-3.5 text-[#00ec97]" />
          <span>Why Function Call Keys Aren&apos;t Enough</span>
        </div>
        <p className="leading-relaxed text-[#8b9bb0]">
          NEAR Function Call Keys cannot inspect the 32-byte hash sent to{' '}
          <code className="font-mono text-[#eef2f6]">{policy.mpcSignerContractId}</code>.{' '}
          <code className="font-mono text-[#00ec97]">{policy.firewallContractId}</code> owns path{' '}
          <code className="font-mono text-[#eef2f6]">{policy.derivationPath}</code> and parses raw RLP + ABI bytes
          before computing <code className="font-mono text-[#eef2f6]">keccak256</code>.
        </p>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between rounded-lg border border-[#1e2935] bg-[#090d11] px-3 py-2">
          <span className="text-[#8b9bb0]">Allowed EVM Chain IDs</span>
          <span className="font-mono text-[#eef2f6]">{policy.allowedChainIds.join(', ')}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[#1e2935] bg-[#090d11] px-3 py-2">
          <span className="text-[#8b9bb0]">Autonomous Token Cap</span>
          <span className="font-mono tabular-nums text-[#00ec97]">{formatUnits6(policy.autoApproveTokenUnits)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[#1e2935] bg-[#090d11] px-3 py-2">
          <span className="text-[#8b9bb0]">Hard Max Token Cap</span>
          <span className="font-mono tabular-nums text-[#eef2f6]">{formatUnits6(policy.maxTokenAmountUnits)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[#1e2935] bg-[#090d11] px-3 py-2">
          <span className="text-[#8b9bb0]">Max Bitcoin Output</span>
          <span className="font-mono tabular-nums text-[#eef2f6]">{Number(policy.maxBtcOutputSats).toLocaleString()} sats</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[#1e2935] bg-[#090d11] px-3 py-2">
          <span className="text-[#8b9bb0]">Trezu / SputnikDAO</span>
          <span className="max-w-[165px] truncate font-mono text-[#f59e0b]" title={policy.daoAccount}>
            {policy.daoAccount}
          </span>
        </div>
      </div>

      <div className="space-y-2 border-t border-[#1e2935] pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#8b9bb0]">Active Security Switches</p>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#1e2935] bg-[#131a21] px-3 py-2 text-xs">
          <span className="text-[#eef2f6]">Block Unlimited Approvals</span>
          <input
            type="checkbox"
            checked={!policy.allowUnlimitedApprovals}
            onChange={(e) => onToggleRule({ allowUnlimitedApprovals: !e.target.checked })}
            className="h-4 w-4 accent-[#00ec97]"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#1e2935] bg-[#131a21] px-3 py-2 text-xs">
          <span className="text-[#eef2f6]">Block NFT setApprovalForAll</span>
          <input
            type="checkbox"
            checked={!policy.allowSetApprovalForAll}
            onChange={(e) => onToggleRule({ allowSetApprovalForAll: !e.target.checked })}
            className="h-4 w-4 accent-[#00ec97]"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#1e2935] bg-[#131a21] px-3 py-2 text-xs">
          <span className="text-[#eef2f6]">Strict Known ABI Selectors</span>
          <input
            type="checkbox"
            checked={!policy.allowUnknownSelectors}
            onChange={(e) => onToggleRule({ allowUnknownSelectors: !e.target.checked })}
            className="h-4 w-4 accent-[#00ec97]"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#1e2935] bg-[#131a21] px-3 py-2 text-xs">
          <span className="text-[#eef2f6]">NEAR AI TEE Risk Co-Audit</span>
          <input
            type="checkbox"
            checked={policy.requireTeeRiskCheck}
            onChange={(e) => onToggleRule({ requireTeeRiskCheck: e.target.checked })}
            className="h-4 w-4 accent-[#00ec97]"
          />
        </label>

        {adminAuthEnabled && (
          <div className="pt-2">
            <label className="mb-1 block text-[11px] font-medium text-[#f59e0b]">
              Admin Token Required (x-admin-token)
            </label>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => onChangeAdminToken(e.target.value)}
              placeholder="Enter MPC_FIREWALL_ADMIN_TOKEN…"
              className="w-full rounded-lg border border-[#f59e0b]/40 bg-[#090d11] px-2.5 py-1.5 font-mono text-xs text-[#eef2f6] focus:border-[#00ec97] focus:outline-none"
            />
          </div>
        )}
      </div>
    </aside>
  );
}

