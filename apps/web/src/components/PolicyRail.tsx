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
      <aside className="rounded-xl border border-[#DCE0E8] bg-white p-5 shadow-[0_1px_2px_rgba(11,15,23,0.04)]">
        <p className="text-xs text-[#525B6C]">Loading firewall policy…</p>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-5 rounded-xl border border-[#DCE0E8] bg-white p-5 shadow-[0_1px_2px_rgba(11,15,23,0.04)]">
      <div className="flex items-center justify-between border-b border-[#E2E6EE] pb-3.5">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[#1F3CFF]" />
          <h2 className="text-sm font-bold tracking-tight text-[#0B0F17]">On-Chain Policy Gate</h2>
        </div>
        {saving && <span className="font-mono text-[10px] font-semibold text-[#1F3CFF]">SAVING…</span>}
      </div>

      <div className="rounded-lg border border-[#E2E6EE] bg-[#F4F5F8] p-3.5 text-xs">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-[#0B0F17]">
          <Lock className="h-3.5 w-3.5 text-[#1F3CFF]" />
          <span>Why Function Call Keys Aren&apos;t Enough</span>
        </div>
        <p className="leading-relaxed text-[#525B6C]">
          NEAR Function Call Keys cannot inspect the 32-byte hash sent to{' '}
          <code className="font-mono text-[#0B0F17]">{policy.mpcSignerContractId}</code>.{' '}
          <code className="font-mono font-semibold text-[#1F3CFF]">{policy.firewallContractId}</code> owns path{' '}
          <code className="font-mono text-[#0B0F17]">{policy.derivationPath}</code> and parses raw RLP + ABI bytes
          before computing <code className="font-mono text-[#0B0F17]">keccak256</code>.
        </p>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] px-3 py-2.5">
          <span className="text-[#525B6C]">Allowed EVM Chain IDs</span>
          <span className="font-mono font-medium text-[#0B0F17]">{policy.allowedChainIds.join(', ')}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] px-3 py-2.5">
          <span className="text-[#525B6C]">Autonomous Token Cap</span>
          <span className="font-mono font-semibold tabular-nums text-[#059669]">
            {formatUnits6(policy.autoApproveTokenUnits)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] px-3 py-2.5">
          <span className="text-[#525B6C]">Hard Max Token Cap</span>
          <span className="font-mono font-medium tabular-nums text-[#0B0F17]">
            {formatUnits6(policy.maxTokenAmountUnits)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] px-3 py-2.5">
          <span className="text-[#525B6C]">Max Bitcoin Output</span>
          <span className="font-mono font-medium tabular-nums text-[#0B0F17]">
            {Number(policy.maxBtcOutputSats).toLocaleString()} sats
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] px-3 py-2.5">
          <span className="text-[#525B6C]">Trezu / SputnikDAO</span>
          <span className="max-w-[165px] truncate font-mono font-medium text-[#D97706]" title={policy.daoAccount}>
            {policy.daoAccount}
          </span>
        </div>
      </div>

      <div className="space-y-2 border-t border-[#E2E6EE] pt-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#525B6C]">
          Active Security Switches
        </p>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] px-3 py-2.5 text-xs transition-colors hover:border-[#0B0F17]/30">
          <span className="font-medium text-[#0B0F17]">Block Unlimited Approvals</span>
          <input
            type="checkbox"
            checked={!policy.allowUnlimitedApprovals}
            onChange={(e) => onToggleRule({ allowUnlimitedApprovals: !e.target.checked })}
            className="h-4 w-4 accent-[#1F3CFF]"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] px-3 py-2.5 text-xs transition-colors hover:border-[#0B0F17]/30">
          <span className="font-medium text-[#0B0F17]">Block NFT setApprovalForAll</span>
          <input
            type="checkbox"
            checked={!policy.allowSetApprovalForAll}
            onChange={(e) => onToggleRule({ allowSetApprovalForAll: !e.target.checked })}
            className="h-4 w-4 accent-[#1F3CFF]"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] px-3 py-2.5 text-xs transition-colors hover:border-[#0B0F17]/30">
          <span className="font-medium text-[#0B0F17]">Strict Known ABI Selectors</span>
          <input
            type="checkbox"
            checked={!policy.allowUnknownSelectors}
            onChange={(e) => onToggleRule({ allowUnknownSelectors: !e.target.checked })}
            className="h-4 w-4 accent-[#1F3CFF]"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] px-3 py-2.5 text-xs transition-colors hover:border-[#0B0F17]/30">
          <span className="font-medium text-[#0B0F17]">NEAR AI TEE Risk Co-Audit</span>
          <input
            type="checkbox"
            checked={policy.requireTeeRiskCheck}
            onChange={(e) => onToggleRule({ requireTeeRiskCheck: e.target.checked })}
            className="h-4 w-4 accent-[#1F3CFF]"
          />
        </label>

        {adminAuthEnabled && (
          <div className="pt-2">
            <label className="mb-1 block text-[11px] font-semibold text-[#D97706]">
              Admin Token Required (x-admin-token)
            </label>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => onChangeAdminToken(e.target.value)}
              placeholder="Enter MPC_FIREWALL_ADMIN_TOKEN…"
              className="w-full rounded-lg border border-[#D97706]/40 bg-white px-2.5 py-1.5 font-mono text-xs text-[#0B0F17] focus:border-[#1F3CFF] focus:outline-none"
            />
          </div>
        )}
      </div>
    </aside>
  );
}
