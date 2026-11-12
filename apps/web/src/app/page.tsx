'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FirewallChainKind, FirewallEvaluationRecord, FirewallPolicy } from '@mpc-firewall/core';
import { HeaderStatusBar, type HealthSnapshot, type NearRpcSnapshot } from '@/components/HeaderStatusBar';
import { PolicyRail } from '@/components/PolicyRail';
import { TxWorkbench, type ScenarioPresetView } from '@/components/TxWorkbench';
import { ProofInspector } from '@/components/ProofInspector';
import { VisualStoryView } from '@/components/VisualStoryView';

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

  const executeInspectPayload = useCallback(
    async (
      targetChainKind: FirewallChainKind,
      targetHex: string,
      targetIntent: string,
      resetFirst = false
    ) => {
      setInspecting(true);
      setErrorMsg(null);
      try {
        if (resetFirst) {
          const headers: Record<string, string> = {};
          if (adminToken.trim()) headers['x-admin-token'] = adminToken.trim();
          await fetch('/api/policy', { method: 'POST', headers });
        }
        const res = await fetch('/api/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chainKind: targetChainKind,
            rawUnsignedHex: targetHex,
            agentIntent: targetIntent
          })
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error?.message || 'Inspection failed');
        }
        const record: FirewallEvaluationRecord = json.data.record;
        setLatestRecord(record);
        if (json.data.dailyTokenSpentUnits !== undefined) {
          setDailySpentUnits(json.data.dailyTokenSpentUnits);
        }
        setHistory((prev) => [record, ...prev.filter((r) => r.id !== record.id)].slice(0, 15));
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Inspection error');
      } finally {
        setInspecting(false);
      }
    },
    [adminToken]
  );

  const loadBootstrap = useCallback(async () => {
    try {
      const [hRes, pRes] = await Promise.all([fetch('/api/health'), fetch('/api/presets')]);
      const hJson = await hRes.json();
      const pJson = await pRes.json();
      if (hJson.data) setHealth(hJson.data);
      if (pJson.data) {
        setPolicy(pJson.data.policy);
        setDailySpentUnits(pJson.data.dailyTokenSpentUnits ?? '0');
        const loadedHistory: FirewallEvaluationRecord[] = pJson.data.history ?? [];
        setHistory(loadedHistory);
        const loadedPresets: ScenarioPresetView[] = pJson.data.presets ?? [];
        setPresets(loadedPresets);
        if (loadedPresets.length > 0) {
          const firstPreset = loadedPresets[0];
          setSelectedPresetId(firstPreset.id);
          setChainKind(firstPreset.chainKind);
          setAgentIntent(firstPreset.agentIntent);
          setRawUnsignedHex(firstPreset.rawUnsignedHex);

          const cached = loadedHistory.find(
            (r) => r.agentIntent === firstPreset.agentIntent && !r.decision.codes.includes('ERR_REPLAY_DETECTED')
          );
          if (cached) {
            setLatestRecord(cached);
          } else {
            void executeInspectPayload(firstPreset.chainKind, firstPreset.rawUnsignedHex, firstPreset.agentIntent);
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load MpcFirewall state');
    }
  }, [executeInspectPayload]);

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

    if (viewMode === 'story') {
      const cached = history.find(
        (r) => r.agentIntent === preset.agentIntent && !r.decision.codes.includes('ERR_REPLAY_DETECTED')
      );
      if (cached) {
        setLatestRecord(cached);
      } else {
        void executeInspectPayload(preset.chainKind, preset.rawUnsignedHex, preset.agentIntent);
      }
    }
  }

  async function handleInspect() {
    const shouldResetReplayInStory =
      viewMode === 'story' &&
      history.some((r) => r.agentIntent === agentIntent && r.decision.outcome !== 'BLOCKED');
    await executeInspectPayload(chainKind, rawUnsignedHex, agentIntent, shouldResetReplayInStory);
  }

  return (
    <div className="min-h-[100dvh] bg-[#F4F5F8] text-[#0B0F17]">
      <HeaderStatusBar
        health={health}
        rpc={rpc}
        dailySpentUnits={dailySpentUnits}
        maxDailyUnits={policy?.maxDailyTokenUnits ?? '1000000000'}
        onResetDemo={handleResetDemo}
        onCheckRpc={handleProbeRpc}
        checkingRpc={checkingRpc}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
      />

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {errorMsg && (
          <div className="mb-6 rounded-xl border border-[#E11D48]/30 bg-[#E11D48]/[0.06] px-4 py-3 text-xs font-medium text-[#E11D48]">
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
          />
        ) : (
          <div className="space-y-6">
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

            {history.length > 0 && (
              <section className="rounded-xl border border-[#DCE0E8] bg-white p-5 shadow-[0_1px_2px_rgba(11,15,23,0.04)]">
                <h2 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#525B6C]">
                  Recent Firewall Audit Log
                </h2>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {history.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLatestRecord(item)}
                      className="rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] p-3 text-left text-xs transition-colors hover:border-[#0B0F17]/30 hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-[#525B6C]">{item.id}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                            item.decision.outcome === 'APPROVED_FOR_MPC_SIGN'
                              ? 'bg-[#059669]/10 text-[#059669]'
                              : item.decision.outcome === 'ESCALATE_TO_DAO'
                                ? 'bg-[#D97706]/10 text-[#D97706]'
                                : 'bg-[#E11D48]/10 text-[#E11D48]'
                          }`}
                        >
                          {item.decision.outcome}
                        </span>
                      </div>
                      <div className="mt-1.5 truncate font-medium text-[#0B0F17]">{item.agentIntent}</div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
