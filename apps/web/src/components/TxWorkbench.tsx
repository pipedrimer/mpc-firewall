'use client';

import type { Bip143InputContext, FirewallChainKind } from '@mpc-firewall/core';
import { Play, ShieldAlert, ShieldCheck, Landmark, Terminal } from 'lucide-react';

export interface ScenarioPresetView {
  id: string;
  title: string;
  badge: 'SAFE' | 'ATTACK' | 'DAO_ESCALATION';
  chainKind: FirewallChainKind;
  agentIntent: string;
  description: string;
  rawUnsignedHex: string;
  bip143Input?: Bip143InputContext;
}

interface TxWorkbenchProps {
  presets: ScenarioPresetView[];
  selectedPresetId: string;
  chainKind: FirewallChainKind;
  agentIntent: string;
  rawUnsignedHex: string;
  bip143Input?: Bip143InputContext;
  loading: boolean;
  onSelectPreset: (preset: ScenarioPresetView) => void;
  onChangeChainKind: (kind: FirewallChainKind) => void;
  onChangeIntent: (val: string) => void;
  onChangeRawHex: (val: string) => void;
  onChangeBip143Input?: (val: Bip143InputContext | undefined) => void;
  onInspect: () => void;
}

export function TxWorkbench({
  presets,
  selectedPresetId,
  chainKind,
  agentIntent,
  rawUnsignedHex,
  bip143Input,
  loading,
  onSelectPreset,
  onChangeChainKind,
  onChangeIntent,
  onChangeRawHex,
  onChangeBip143Input,
  onInspect
}: TxWorkbenchProps) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-[#DCE0E8] bg-white p-5 shadow-[0_1px_2px_rgba(11,15,23,0.04)]">
      <div className="flex items-center justify-between border-b border-[#E2E6EE] pb-3.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[#1F3CFF]" />
          <h2 className="text-sm font-bold tracking-tight text-[#0B0F17]">
            Unsigned Transaction &amp; Attack Simulator
          </h2>
        </div>
        <span className="font-mono text-[11px] text-[#525B6C]">RLP / ABI / BTC Raw Input</span>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#525B6C]">
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
                className={`flex items-start justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left text-xs transition-all ${
                  active
                    ? 'border-[#1F3CFF] bg-[#1F3CFF]/[0.04] text-[#0B0F17] shadow-[inset_2px_0_0_#1F3CFF]'
                    : 'border-[#E2E6EE] bg-[#F8F9FB] text-[#525B6C] hover:border-[#0B0F17]/30 hover:bg-white hover:text-[#0B0F17]'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#0B0F17]">{preset.title}</div>
                  <div className="mt-0.5 text-[11px] text-[#525B6C]">{preset.description}</div>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                    preset.badge === 'SAFE'
                      ? 'bg-[#059669]/10 text-[#059669]'
                      : preset.badge === 'DAO_ESCALATION'
                        ? 'bg-[#D97706]/10 text-[#D97706]'
                        : 'bg-[#E11D48]/10 text-[#E11D48]'
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

      <div className="grid grid-cols-1 gap-3.5 border-t border-[#E2E6EE] pt-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-[#525B6C]">Target Envelope:</label>
          <div className="flex rounded-lg border border-[#DCE0E8] bg-[#F4F5F8] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onChangeChainKind('evm')}
              className={`rounded-md px-2.5 py-1 font-mono font-medium transition-colors ${
                chainKind === 'evm' ? 'bg-[#0B0F17] text-white' : 'text-[#525B6C] hover:text-[#0B0F17]'
              }`}
            >
              EVM (RLP)
            </button>
            <button
              type="button"
              onClick={() => onChangeChainKind('bitcoin')}
              className={`rounded-md px-2.5 py-1 font-mono font-medium transition-colors ${
                chainKind === 'bitcoin' ? 'bg-[#0B0F17] text-white' : 'text-[#525B6C] hover:text-[#0B0F17]'
              }`}
            >
              Bitcoin (Raw)
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#525B6C]">
            2. AI Assistant Stated Intent (Audited inside NEAR AI TEE)
          </label>
          <input
            type="text"
            value={agentIntent}
            onChange={(e) => onChangeIntent(e.target.value)}
            className="w-full rounded-lg border border-[#DCE0E8] bg-[#F8F9FB] px-3 py-2 text-xs text-[#0B0F17] focus:border-[#1F3CFF] focus:bg-white focus:outline-none"
            placeholder="Describe what the AI assistant claims this foreign-chain transaction does..."
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#525B6C]">
            3. Raw Unsigned Transaction Hex (Submitted to MpcFirewall Contract)
          </label>
          <textarea
            rows={4}
            value={rawUnsignedHex}
            onChange={(e) => onChangeRawHex(e.target.value)}
            spellCheck={false}
            className="w-full rounded-lg border border-[#DCE0E8] bg-[#F8F9FB] p-3 font-mono text-[11px] leading-relaxed text-[#0B0F17] focus:border-[#1F3CFF] focus:bg-white focus:outline-none"
            placeholder="0x02f8..."
          />
        </div>

        {chainKind === 'bitcoin' && onChangeBip143Input && (
          <div className="rounded-lg border border-[#DCE0E8] bg-[#F8F9FB] p-3 text-[11px]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono font-semibold text-[#0B0F17]">
                BIP-143 SegWit Input Preimage Context
              </span>
              <button
                type="button"
                onClick={() =>
                  onChangeBip143Input(
                    bip143Input
                      ? undefined
                      : {
                          inputIndex: 0,
                          prevoutValueSats: '300000',
                          scriptCodeHex: '00141111111111111111111111111111111111111111'
                        }
                  )
                }
                className="rounded border border-[#DCE0E8] bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-[#1F3CFF] hover:border-[#1F3CFF]"
              >
                {bip143Input ? 'Clear BIP-143' : 'Enable BIP-143'}
              </button>
            </div>
            {bip143Input ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[10px] text-[#525B6C]">Input Index</span>
                  <input
                    type="number"
                    min={0}
                    value={bip143Input.inputIndex}
                    onChange={(e) =>
                      onChangeBip143Input({
                        ...bip143Input,
                        inputIndex: Math.max(0, Number.parseInt(e.target.value || '0', 10) || 0)
                      })
                    }
                    className="mt-0.5 w-full rounded border border-[#DCE0E8] bg-white px-2 py-1 font-mono text-[11px]"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-[#525B6C]">Prevout Value (sats)</span>
                  <input
                    type="text"
                    value={bip143Input.prevoutValueSats}
                    onChange={(e) =>
                      onChangeBip143Input({
                        ...bip143Input,
                        prevoutValueSats: e.target.value.replace(/\D/g, '') || '0'
                      })
                    }
                    className="mt-0.5 w-full rounded border border-[#DCE0E8] bg-white px-2 py-1 font-mono text-[11px]"
                  />
                </label>
                <label className="block sm:col-span-3">
                  <span className="text-[10px] text-[#525B6C]">ScriptCode / P2WPKH Hex</span>
                  <input
                    type="text"
                    value={bip143Input.scriptCodeHex}
                    onChange={(e) =>
                      onChangeBip143Input({
                        ...bip143Input,
                        scriptCodeHex: e.target.value.trim()
                      })
                    }
                    className="mt-0.5 w-full rounded border border-[#DCE0E8] bg-white px-2 py-1 font-mono text-[11px]"
                  />
                </label>
              </div>
            ) : (
              <p className="text-[10px] text-[#525B6C]">
                Disabled — falling back to raw double-SHA256 digest unless BIP-143 input context is supplied.
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={loading || !rawUnsignedHex.trim()}
          onClick={onInspect}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B0F17] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1F3CFF] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>{loading ? 'Decoding RLP & Evaluating Policy…' : 'Decode, Audit & Verify Before v1.signer'}</span>
        </button>
      </div>
    </section>
  );
}
