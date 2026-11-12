'use client';

import type { FirewallChainKind } from '@mpc-firewall/core';
import { Play, ShieldAlert, ShieldCheck, Landmark, Terminal } from 'lucide-react';

export interface ScenarioPresetView {
  id: string;
  title: string;
  badge: 'SAFE' | 'ATTACK' | 'DAO_ESCALATION';
  chainKind: FirewallChainKind;
  agentIntent: string;
  description: string;
  rawUnsignedHex: string;
}

interface TxWorkbenchProps {
  presets: ScenarioPresetView[];
  selectedPresetId: string;
  chainKind: FirewallChainKind;
  agentIntent: string;
  rawUnsignedHex: string;
  loading: boolean;
  onSelectPreset: (preset: ScenarioPresetView) => void;
  onChangeChainKind: (kind: FirewallChainKind) => void;
  onChangeIntent: (val: string) => void;
  onChangeRawHex: (val: string) => void;
  onInspect: () => void;
}

export function TxWorkbench({
  presets,
  selectedPresetId,
  chainKind,
  agentIntent,
  rawUnsignedHex,
  loading,
  onSelectPreset,
  onChangeChainKind,
  onChangeIntent,
  onChangeRawHex,
  onInspect
}: TxWorkbenchProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[#1e2935] bg-[#0d1217] p-4">
      <div className="flex items-center justify-between border-b border-[#1e2935] pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[#00ec97]" />
          <h2 className="text-sm font-semibold text-[#eef2f6]">Unsigned Transaction &amp; Attack Simulator</h2>
        </div>
        <span className="font-mono text-[11px] text-[#8b9bb0]">RLP / ABI / BTC Raw Input</span>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#8b9bb0]">
          1. Select Real EIP-1559 / Bitcoin Scenario (or customize below)
        </p>
        <div className="grid gap-1.5">
          {presets.map((preset) => {
            const active = preset.id === selectedPresetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs ${
                  active
                    ? 'border-[#00ec97]/60 bg-[#131a21] text-[#eef2f6]'
                    : 'border-[#1e2935] bg-[#090d11] text-[#8b9bb0] hover:border-[#2d3c4e] hover:text-[#eef2f6]'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-[#eef2f6]">{preset.title}</div>
                  <div className="mt-0.5 text-[11px] text-[#8b9bb0]">{preset.description}</div>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                    preset.badge === 'SAFE'
                      ? 'bg-[#00ec97]/15 text-[#00ec97]'
                      : preset.badge === 'DAO_ESCALATION'
                        ? 'bg-[#f59e0b]/15 text-[#f59e0b]'
                        : 'bg-[#f43f5e]/15 text-[#f43f5e]'
                  }`}
                >
                  {preset.badge === 'SAFE' && <ShieldCheck className="mr-1 inline h-3 w-3" />}
                  {preset.badge === 'ATTACK' && <ShieldAlert className="mr-1 inline h-3 w-3" />}
                  {preset.badge === 'DAO_ESCALATION' && <Landmark className="mr-1 inline h-3 w-3" />}
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-[#1e2935] pt-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-[#8b9bb0]">Target Envelope:</label>
          <div className="flex rounded-md border border-[#1e2935] bg-[#090d11] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onChangeChainKind('evm')}
              className={`rounded px-2.5 py-1 font-mono ${
                chainKind === 'evm' ? 'bg-[#1e2935] text-[#00ec97]' : 'text-[#8b9bb0]'
              }`}
            >
              EVM (RLP)
            </button>
            <button
              type="button"
              onClick={() => onChangeChainKind('bitcoin')}
              className={`rounded px-2.5 py-1 font-mono ${
                chainKind === 'bitcoin' ? 'bg-[#1e2935] text-[#f59e0b]' : 'text-[#8b9bb0]'
              }`}
            >
              Bitcoin (Raw)
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#8b9bb0]">
            2. Agent Stated Intent (Audited inside NEAR AI TEE)
          </label>
          <input
            type="text"
            value={agentIntent}
            onChange={(e) => onChangeIntent(e.target.value)}
            className="w-full rounded-lg border border-[#1e2935] bg-[#090d11] px-3 py-2 text-xs text-[#eef2f6] focus:border-[#00ec97] focus:outline-none"
            placeholder="Describe what the AI agent claims this foreign-chain transaction does..."
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#8b9bb0]">
            3. Raw Unsigned Transaction Hex (Submitted to MpcFirewall Contract)
          </label>
          <textarea
            rows={4}
            value={rawUnsignedHex}
            onChange={(e) => onChangeRawHex(e.target.value)}
            spellCheck={false}
            className="w-full rounded-lg border border-[#1e2935] bg-[#090d11] p-3 font-mono text-[11px] leading-relaxed text-[#eef2f6] focus:border-[#00ec97] focus:outline-none"
            placeholder="0x02f8..."
          />
        </div>

        <button
          type="button"
          disabled={loading || !rawUnsignedHex.trim()}
          onClick={onInspect}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00ec97] px-4 py-2.5 text-sm font-semibold text-[#070a0d] hover:bg-[#19f4a6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>{loading ? 'Decoding RLP & Evaluating Policy…' : 'Decode, Audit & Verify Before v1.signer'}</span>
        </button>
      </div>
    </section>
  );
}

