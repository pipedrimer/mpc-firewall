'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Bip143InputContext,
  FirewallChainKind,
  FirewallEvaluationRecord,
  FirewallPolicy
} from '@mpc-firewall/core';
import { HeaderStatusBar, type HealthSnapshot, type NearRpcSnapshot } from '@/components/HeaderStatusBar';
import { PolicyRail } from '@/components/PolicyRail';
import { TxWorkbench, type ScenarioPresetView } from '@/components/TxWorkbench';
import { ProofInspector } from '@/components/ProofInspector';
import { VisualStoryView } from '@/components/VisualStoryView';

interface HomeConsoleProps {
  initialPresets: ScenarioPresetView[];
  initialPolicy: FirewallPolicy;
}

export function HomeConsole({ initialPresets, initialPolicy }: HomeConsoleProps) {
  const firstInitial = initialPresets[0];
  const [viewMode, setViewMode] = useState<'story' | 'protocol'>('story');
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [rpc, setRpc] = useState<NearRpcSnapshot | null>(null);
  const [checkingRpc, setCheckingRpc] = useState(false);

  const [policy, setPolicy] = useState<FirewallPolicy | null>(initialPolicy);
  const [dailySpentUnits, setDailySpentUnits] = useState('0');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [adminToken, setAdminToken] = useState('');

  const [presets, setPresets] = useState<ScenarioPresetView[]>(initialPresets);
  const [selectedPresetId, setSelectedPresetId] = useState(firstInitial?.id ?? '');
  const [chainKind, setChainKind] = useState<FirewallChainKind>(firstInitial?.chainKind ?? 'evm');
  const [agentIntent, setAgentIntent] = useState(firstInitial?.agentIntent ?? '');
  const [rawUnsignedHex, setRawUnsignedHex] = useState(firstInitial?.rawUnsignedHex ?? '');
  const [bip143Input, setBip143Input] = useState<Bip143InputContext | undefined>(
    firstInitial?.bip143Input
  );
  const [isTamperedSimulation, setIsTamperedSimulation] = useState(false);
  const userInteractedRef = useRef(false);

  const [inspecting, setInspecting] = useState(false);
  const [scanPulseId, setScanPulseId] = useState(0);
  const [lastScanDurationMs, setLastScanDurationMs] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [latestRecord, setLatestRecord] = useState<FirewallEvaluationRecord | null>(null);
  const [history, setHistory] = useState<FirewallEvaluationRecord[]>([]);

  const executeInspectPayload = useCallback(
    async (
      targetChainKind: FirewallChainKind,
      targetHex: string,
      targetIntent: string,
      resetFirst = false,
      animateSweep = true,
      targetBip143Input?: Bip143InputContext
    ) => {
      setInspecting(true);
      setErrorMsg(null);
      if (animateSweep) {
        setScanPulseId((n) => n + 1);
      }
      const startPerf = performance.now();
      try {
        if (resetFirst) {
          const headers: Record<string, string> = {};
          if (adminToken.trim()) headers['x-admin-token'] = adminToken.trim();
          await fetch('/api/policy', { method: 'POST', headers });
        }
        const [res] = await Promise.all([
          fetch('/api/inspect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chainKind: targetChainKind,
              rawUnsignedHex: targetHex,
              agentIntent: targetIntent,
              ...(targetBip143Input ? { bip143Input: targetBip143Input } : {})
            })
          }),
          animateSweep ? new Promise((r) => setTimeout(r, 380)) : Promise.resolve()
        ]);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error?.message || 'Inspection failed');
        }
        const record: FirewallEvaluationRecord = json.data.record;
        setLatestRecord(record);
        setLastScanDurationMs(Math.max(8, Math.round(performance.now() - startPerf)));
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
        if (loadedPresets.length > 0) {
          setPresets(loadedPresets);
        }
        if (!userInteractedRef.current && loadedPresets.length > 0) {
          const firstPreset = loadedPresets[0];
          setSelectedPresetId(firstPreset.id);
          setChainKind(firstPreset.chainKind);
          setAgentIntent(firstPreset.agentIntent);
          setRawUnsignedHex(firstPreset.rawUnsignedHex);
          setBip143Input(firstPreset.bip143Input);

          const cached = loadedHistory.find(
            (r) => r.agentIntent === firstPreset.agentIntent && !r.decision.codes.includes('ERR_REPLAY_DETECTED')
          );
          if (cached) {
            setLatestRecord(cached);
          } else {
            void executeInspectPayload(
              firstPreset.chainKind,
              firstPreset.rawUnsignedHex,
              firstPreset.agentIntent,
              false,
              false,
              firstPreset.bip143Input
            );
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
    userInteractedRef.current = true;
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

      // In Story mode, immediately re-scan the current transaction against the updated policy
      // so judges can watch the verdict flip live!
      if (viewMode === 'story' && rawUnsignedHex.trim()) {
        await executeInspectPayload(chainKind, rawUnsignedHex, agentIntent, false, true);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update policy');
    } finally {
      setSavingPolicy(false);
    }
  }

  async function handleResetDemo() {
    userInteractedRef.current = true;
    setErrorMsg(null);
    setIsTamperedSimulation(false);
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
        const currentPreset = presets.find((p) => p.id === selectedPresetId) || presets[0];
        if (currentPreset) {
          setChainKind(currentPreset.chainKind);
          setAgentIntent(currentPreset.agentIntent);
          setRawUnsignedHex(currentPreset.rawUnsignedHex);
          setBip143Input(currentPreset.bip143Input);
          await executeInspectPayload(
            currentPreset.chainKind,
            currentPreset.rawUnsignedHex,
            currentPreset.agentIntent,
            false,
            true,
            currentPreset.bip143Input
          );
        } else {
          setLatestRecord(null);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reset demo state');
    }
  }

  function handleSelectPreset(preset: ScenarioPresetView) {
    userInteractedRef.current = true;
    setSelectedPresetId(preset.id);
    setChainKind(preset.chainKind);
    setAgentIntent(preset.agentIntent);
    setRawUnsignedHex(preset.rawUnsignedHex);
    setBip143Input(preset.bip143Input);
    setIsTamperedSimulation(false);
    setErrorMsg(null);

    if (viewMode === 'story') {
      void executeInspectPayload(
        preset.chainKind,
        preset.rawUnsignedHex,
        preset.agentIntent,
        false,
        true,
        preset.bip143Input
      );
    }
  }

  async function handleTamperCurrentErrand(injectTrap: boolean) {
    userInteractedRef.current = true;
    const safePreset = presets.find((p) => p.id === 'safe-base-usdc') || presets[0];
    const trapPreset = presets.find((p) => p.id === 'attack-nested-multicall') || presets[1];
    if (!safePreset || !trapPreset) return;

    setSelectedPresetId(safePreset.id);
    setChainKind('evm');
    setAgentIntent(safePreset.agentIntent);

    if (injectTrap) {
      // Keep the AI Assistant's innocent $25 Server Bill claim, but swap the raw bytes
      // with a poisoned nested multicall containing an unlimited approval!
      setIsTamperedSimulation(true);
      setRawUnsignedHex(trapPreset.rawUnsignedHex);
      await executeInspectPayload('evm', trapPreset.rawUnsignedHex, safePreset.agentIntent, false, true);
    } else {
      setIsTamperedSimulation(false);
      setRawUnsignedHex(safePreset.rawUnsignedHex);
      await executeInspectPayload('evm', safePreset.rawUnsignedHex, safePreset.agentIntent, true, true);
    }
  }

  async function handleInspect() {
    userInteractedRef.current = true;
    let targetKind = chainKind;
    let targetHex = rawUnsignedHex;
    let targetIntent = agentIntent;

    if (!targetHex.trim()) {
      try {
        const pRes = await fetch('/api/presets');
        const pJson = await pRes.json();
        const loadedPresets: ScenarioPresetView[] = pJson.data?.presets ?? [];
        if (loadedPresets.length > 0) {
          setPresets(loadedPresets);
          const first = loadedPresets[0];
          setSelectedPresetId(first.id);
          setChainKind(first.chainKind);
          setAgentIntent(first.agentIntent);
          setRawUnsignedHex(first.rawUnsignedHex);
          setBip143Input(first.bip143Input);
          targetKind = first.chainKind;
          targetHex = first.rawUnsignedHex;
          targetIntent = first.agentIntent;
        }
      } catch {
        // Handled by executeInspectPayload
      }
    }

    const matchedPreset = presets.find((p) => p.id === selectedPresetId && p.rawUnsignedHex === targetHex);
    const activeBip143 = targetKind === 'bitcoin' ? (bip143Input ?? matchedPreset?.bip143Input) : undefined;
    const shouldResetReplayInStory = viewMode === 'story' && !isTamperedSimulation;
    await executeInspectPayload(
      targetKind,
      targetHex,
      targetIntent,
      shouldResetReplayInStory,
      true,
      activeBip143
    );
  }

  return (
    <div className="min-h-[100dvh] text-[#0B0F17]">
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

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 lg:py-11">
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
            savingPolicy={savingPolicy}
            onTogglePolicy={handleTogglePolicy}
            onResetPolicy={handleResetDemo}
            isTamperedSimulation={isTamperedSimulation}
            onTamperSimulation={handleTamperCurrentErrand}
            loading={inspecting}
            scanPulseId={scanPulseId}
            lastScanDurationMs={lastScanDurationMs}
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
                  bip143Input={bip143Input}
                  loading={inspecting}
                  onSelectPreset={handleSelectPreset}
                  onChangeChainKind={setChainKind}
                  onChangeIntent={setAgentIntent}
                  onChangeRawHex={setRawUnsignedHex}
                  onChangeBip143Input={setBip143Input}
                  onInspect={handleInspect}
                />
              </div>

              <div className="lg:col-span-4">
                <ProofInspector
                  record={latestRecord}
                  presetId={selectedPresetId}
                  bip143Input={chainKind === 'bitcoin' ? bip143Input : undefined}
                />
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

