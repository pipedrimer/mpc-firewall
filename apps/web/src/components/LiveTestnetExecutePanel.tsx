'use client';

import type { Bip143InputContext, FirewallChainKind, FirewallEvaluationRecord } from '@mpc-firewall/core';
import { ExternalLink, Loader2, Play, ShieldAlert, CheckCircle2, Landmark } from 'lucide-react';
import { useEffect, useState } from 'react';

interface LiveTestnetResult {
  action: string;
  contractId: string;
  method: string;
  signerAccountId: string;
  txId?: string;
  usedFreshNonce?: number;
  txHash: string;
  explorerUrl: string;
  onChainStatus: 'EXECUTED_MPC_SIGN' | 'PROPOSAL_SUBMITTED' | 'REJECTED_ON_CHAIN';
  proposalId?: number;
  returnValue?: unknown;
  failureMessage?: string | null;
  gasBurnt?: number;
  receiptCount?: number;
}

interface LiveTestnetExecutePanelProps {
  record: FirewallEvaluationRecord | null;
  presetId?: string;
  chainKind?: FirewallChainKind;
  bip143Input?: Bip143InputContext;
  compact?: boolean;
}

export function LiveTestnetExecutePanel({
  record,
  presetId,
  bip143Input,
  compact = false
}: LiveTestnetExecutePanelProps) {
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<LiveTestnetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [record?.id]);

  if (!record) return null;

  const isDao = record.decision.outcome === 'ESCALATE_TO_DAO';
  const isBlocked = record.decision.outcome === 'BLOCKED';
  const isBtc = record.decoded.kind === 'bitcoin';

  let buttonLabel = 'Execute Live on NEAR Testnet';
  if (isDao) {
    buttonLabel = 'Submit Live SputnikDAO Proposal on Testnet';
  } else if (isBlocked) {
    buttonLabel = isBtc ? 'Verify BTC Trap Rejection On-Chain' : 'Verify EVM Trap Rejection On-Chain';
  } else if (isBtc) {
    buttonLabel = 'Execute Live BIP-143 Sign on Testnet';
  } else {
    buttonLabel = 'Execute Live verify_and_sign_evm on Testnet';
  }

  async function handleExecute() {
    if (!record) return;
    setExecuting(true);
    setError(null);
    setResult(null);
    try {
      const daoProposalArgs = record.daoProposalPayload?.args as
        | { proposal?: { description?: string } }
        | undefined;
      const payload = isDao
        ? {
            action: 'dao_add_proposal' as const,
            presetId,
            proposalDescription:
              daoProposalArgs?.proposal?.description ||
              `MPC Firewall Escalation (${record.id}): ${record.agentIntent.slice(0, 180)}`
          }
        : isBtc
          ? {
              action: 'verify_and_sign_btc_bip143' as const,
              presetId,
              rawUnsignedHex: record.decoded.rawUnsignedHex,
              bip143Input
            }
          : {
              action: 'verify_and_sign_evm' as const,
              presetId,
              rawUnsignedHex: record.decoded.rawUnsignedHex,
              freshNonce: !isBlocked && presetId === 'safe-base-usdc'
            };

      const res = await fetch('/api/near/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Testnet execution failed');
      }
      setResult(json.data as LiveTestnetResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Testnet execution failed');
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-2.5 border-t border-[#E2E6EE] pt-3.5'}>
      <button
        type="button"
        onClick={handleExecute}
        disabled={executing}
        className={`flex w-full items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-colors disabled:opacity-50 ${
          isDao
            ? 'bg-[#D97706] text-white hover:bg-[#B45309]'
            : isBlocked
              ? 'border border-[#E11D48]/30 bg-[#FFF1F2] text-[#E11D48] hover:bg-[#FFE4E6]'
              : 'bg-[#1F3CFF] text-white hover:bg-[#162ECC]'
        }`}
      >
        {executing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isDao ? (
          <Landmark className="h-3.5 w-3.5" />
        ) : isBlocked ? (
          <ShieldAlert className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        <span>{executing ? 'Broadcasting to NEAR Testnet…' : buttonLabel}</span>
      </button>

      {error && (
        <div className="rounded-lg border border-[#D97706]/30 bg-[#FFFBEB] p-2.5 text-[11px] text-[#92400E]">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`rounded-lg border p-3 font-mono text-[10px] ${
            result.onChainStatus === 'REJECTED_ON_CHAIN'
              ? 'border-[#E11D48]/30 bg-[#FFF1F2]/70 text-[#881337]'
              : 'border-[#059669]/30 bg-[#ECFDF5]/80 text-[#065F46]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 font-bold">
              {result.onChainStatus === 'REJECTED_ON_CHAIN' ? (
                <ShieldAlert className="h-3.5 w-3.5 text-[#E11D48]" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
              )}
              {result.onChainStatus}
            </span>
            <a
              href={result.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-[#1F3CFF] underline"
            >
              <span>NearBlocks TX: {result.txHash.slice(0, 8)}…{result.txHash.slice(-6)}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="mt-1.5 space-y-0.5 text-[10px]">
            <div>
              {result.contractId}::{result.method} • receipts={result.receiptCount ?? 0}
              {result.proposalId !== undefined ? ` • proposal_id=${result.proposalId}` : ''}
              {result.usedFreshNonce !== undefined ? ` • evm_nonce=${result.usedFreshNonce}` : ''}
            </div>
            {result.failureMessage && (
              <div className="font-semibold text-[#E11D48]">
                Contract revert: {result.failureMessage}
                {result.failureMessage.includes('ERR_REPLAY_DETECTED') &&
                  ' (On-chain replay protection verified: this payload hash was already signed on mpc-firewall.testnet.)'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
