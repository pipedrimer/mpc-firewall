'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FirewallChainKind, FirewallEvaluationRecord, FirewallPolicy } from '@mpc-firewall/core';
import { HeaderStatusBar, type HealthSnapshot, type NearRpcSnapshot } from '@/components/HeaderStatusBar';
import { PolicyRail } from '@/components/PolicyRail';
import { TxWorkbench, type ScenarioPresetView } from '@/components/TxWorkbench';
import { ProofInspector } from '@/components/ProofInspector';
import { VisualStoryView } from '@/components/VisualStoryView';
import { Sparkles, Terminal } from 'lucide-react';

export default function HomePage() {
  const [viewMode, setViewMode] = useState<'story' | 'protocol'>('story');
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [rpc, setRpc] = useState<NearRpcSnapshot | null>(null);
  const [checkingRpc, setCheckingRpc] = useState(false);

  const [policy, setPolicy] = useState<FirewallPolicy | null>(null);
  const [dailySpentUnits, setDailySpentUnits] = useState('0');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [adminToken, setAdminToken] = useState('');

  const [presets, setPresets] = useState<ScenarioPresetView[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [chainKind, setChainKind] = useState<FirewallChainKind>('evm');
  const [agentIntent, setAgentIntent] = useState('');
  const [rawUnsignedHex, setRawUnsignedHex] = useState('');

  const [inspecting, setInspecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [latestRecord, setLatestRecord] = useState<FirewallEvaluationRecord | null>(null);
  const [history, setHistory] = useState<FirewallEvaluationRecord[]>([]);

  const loadBootstrap = useCallback(async () => {
    try {
      const [hRes, pRes] = await Promise.all([fetch('/api/health'), fetch('/api/presets')]);
      const hJson = await hRes.json();
      const pJson = await pRes.json();
      if (hJson.data) setHealth(hJson.data);
      if (pJson.data) {
        setPolicy(pJson.data.policy);
        setDailySpentUnits(pJson.data.dailyTokenSpentUnits ?? '0');
        setHistory(pJson.data.history ?? []);
        if (pJson.data.history?.length) {
          setLatestRecord(pJson.data.history[0]);
        }
        const loadedPresets: ScenarioPresetView[] = pJson.data.presets ?? [];
        setPresets(loadedPresets);
        if (loadedPresets.length > 0) {
          setSelectedPresetId(loadedPresets[0].id);
          setChainKind(loadedPresets[0].chainKind);
          setAgentIntent(loadedPresets[0].agentIntent);
          setRawUnsignedHex(loadedPresets[0].rawUnsignedHex);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load MpcFirewall state');
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  async function handleProbeRpc() {
    setCheckingRpc(true);
    try {
      const res = await fetch('/api/near/account');
      const json = await res.json();
      if (json.data) setRpc(json.data);
    } catch {
      // Ignore transient RPC error
    } finally {
      setCheckingRpc(false);
    }
  }

  async function handleTogglePolicy(patch: Partial<FirewallPolicy>) {
    setSavingPolicy(true);
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken.trim()) headers['x-admin-token'] = adminToken.trim();
      const res = await fetch('/api/policy', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Policy update failed');
      setPolicy(json.data.policy);
      setDailySpentUnits(json.data.dailyTokenSpentUnits ?? '0');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update policy');
    } finally {
      setSavingPolicy(false);
    }
  }

  async function handleResetDemo() {
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = {};
      if (adminToken.trim()) headers['x-admin-token'] = adminToken.trim();
      const res = await fetch('/api/policy', { method: 'POST', headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Reset failed');
      if (json.data) {
        setPolicy(json.data.policy);
        setDailySpentUnits(json.data.dailyTokenSpentUnits ?? '0');
        setHistory(json.data.history ?? []);
        setLatestRecord(null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reset demo state');
    }
  }

  function handleSelectPreset(preset: ScenarioPresetView) {
    setSelectedPresetId(preset.id);
    setChainKind(preset.chainKind);
    setAgentIntent(preset.agentIntent);
    setRawUnsignedHex(preset.rawUnsignedHex);
    setErrorMsg(null);
  }

  async function handleInspect() {
    setInspecting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainKind, rawUnsignedHex, agentIntent })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Inspection failed');
      }
      const record: FirewallEvaluationRecord = json.data.record;
      setLatestRecord(record);
      setDailySpentUnits(json.data.dailyTokenSpentUnits ?? dailySpentUnits);
      setHistory((prev) => [record, ...prev].slice(0, 15));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Inspection error');
    } finally {
      setInspecting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070a0d] text-[#eef2f6]">
      <HeaderStatusBar
        health={health}
        rpc={rpc}
        dailySpentUnits={dailySpentUnits}
        maxDailyUnits={policy?.maxDailyTokenUnits ?? '1000000000'}
        onResetDemo={handleResetDemo}
        onCheckRpc={handleProbeRpc}
        checkingRpc={checkingRpc}
      />

      <main className="mx-auto max-w-[1440px] px-5 py-5">
        {/* Mode Switcher Banner */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1e2935] bg-[#0d1217] p-2.5 shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8b9bb0] ml-2">
              Console View:
            </span>
            <div className="flex rounded-xl border border-[#1e2935] bg-[#090d11] p-1">
              <button
                type="button"
                onClick={() => setViewMode('story')}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === 'story'
                    ? 'bg-gradient-to-r from-[#00ec97] to-[#10b981] text-[#070a0d] shadow-[0_0_15px_rgba(0,236,151,0.35)]'
                    : 'text-[#8b9bb0] hover:text-[#eef2f6]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Visual Story &amp; Attack Simulator</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('protocol')}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === 'protocol'
                    ? 'bg-[#1e2935] text-[#00ec97] shadow-sm'
                    : 'text-[#8b9bb0] hover:text-[#eef2f6]'
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Deep Protocol &amp; Policy Inspector</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-[#8b9bb0] mr-2 hidden sm:block">
            {viewMode === 'story'
              ? '✨ Recommended for Hackathon Demo Video & Executive Presentation'
              : '🔬 Low-Level RLP Byte Disassembly & SputnikDAO Proposals'}
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-[#f43f5e]/40 bg-[#f43f5e]/10 px-4 py-2.5 text-xs text-[#fecdd3]">
            {errorMsg}
          </div>
        )}

        {viewMode === 'story' ? (
          <VisualStoryView
            presets={presets}
            selectedPresetId={selectedPresetId}
            onSelectPreset={handleSelectPreset}
            record={latestRecord}
            policy={policy}
            loading={inspecting}
            onInspect={handleInspect}
            dailySpentUnits={dailySpentUnits}
            onResetDemo={handleResetDemo}
            onCheckRpc={handleProbeRpc}
            checkingRpc={checkingRpc}
            rpcRootKey={rpc?.mpcRootPublicKey}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <PolicyRail
                policy={policy}
                saving={savingPolicy}
                adminAuthEnabled={Boolean(health?.adminAuthEnabled)}
                adminToken={adminToken}
                onChangeAdminToken={setAdminToken}
                onToggleRule={handleTogglePolicy}
              />
            </div>

            <div className="lg:col-span-5">
              <TxWorkbench
                presets={presets}
                selectedPresetId={selectedPresetId}
                chainKind={chainKind}
                agentIntent={agentIntent}
                rawUnsignedHex={rawUnsignedHex}
                loading={inspecting}
                onSelectPreset={handleSelectPreset}
                onChangeChainKind={setChainKind}
                onChangeIntent={setAgentIntent}
                onChangeRawHex={setRawUnsignedHex}
                onInspect={handleInspect}
              />
            </div>

            <div className="lg:col-span-4">
              <ProofInspector record={latestRecord} />
            </div>
          </div>
        )}

        {history.length > 0 && (
          <section className="mt-5 rounded-xl border border-[#1e2935] bg-[#0d1217] p-4">
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#8b9bb0]">
              Recent Firewall Audit Log
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {history.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLatestRecord(item)}
                  className="rounded-lg border border-[#1e2935] bg-[#090d11] p-2.5 text-left text-xs hover:border-[#2e3d4f]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-[#8b9bb0]">{item.id}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                        item.decision.outcome === 'APPROVED_FOR_MPC_SIGN'
                          ? 'bg-[#00ec97]/15 text-[#00ec97]'
                          : item.decision.outcome === 'ESCALATE_TO_DAO'
                            ? 'bg-[#f59e0b]/15 text-[#f59e0b]'
                            : 'bg-[#f43f5e]/15 text-[#f43f5e]'
                      }`}
                    >
                      {item.decision.outcome}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[#eef2f6]">{item.agentIntent}</div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
