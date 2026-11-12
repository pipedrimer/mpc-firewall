'use client';

import type { EvmDecodedCall, FirewallEvaluationRecord } from '@mpc-firewall/core';
import { AlertOctagon, ArrowRightLeft, CheckCircle2, Cpu, EyeOff, Landmark } from 'lucide-react';
import { useState } from 'react';

interface ProofInspectorProps {
  record: FirewallEvaluationRecord | null;
}

function CallNode({ call }: { call: EvmDecodedCall }) {
  return (
    <div className="rounded-md border border-[#1e2935] bg-[#090d11] p-2.5 font-mono text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[#eef2f6]">
          depth={call.depth} • {call.action}
        </span>
        <span className="rounded bg-[#131a21] px-1.5 py-0.5 text-[#8b9bb0]">selector {call.selector}</span>
      </div>
      <div className="mt-1.5 space-y-0.5 text-[11px] text-[#8b9bb0]">
        {call.recipient && (
          <div>
            recipient: <span className="text-[#eef2f6]">{call.recipient}</span>
          </div>
        )}
        {call.spenderOrOperator && (
          <div>
            spender/operator: <span className="text-[#eef2f6]">{call.spenderOrOperator}</span>
          </div>
        )}
        {call.tokenAmount && (
          <div>
            amount (base units): <span className="text-[#f59e0b]">{call.tokenAmount}</span>
          </div>
        )}
        {call.approvedBool !== undefined && (
          <div>
            approved: <span className="text-[#f43f5e]">{String(call.approvedBool)}</span>
          </div>
        )}
      </div>
      {call.nestedCalls.length > 0 && (
        <div className="mt-2 space-y-2 border-l-2 border-[#f59e0b]/40 pl-3">
          {call.nestedCalls.map((child, idx) => (
            <CallNode key={`${child.selector}-${idx}`} call={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProofInspector({ record }: ProofInspectorProps) {
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteOutput, setQuoteOutput] = useState<string | null>(null);

  async function handlePreviewIntents() {
    setQuoteLoading(true);
    setQuoteOutput(null);
    try {
      const res = await fetch('/api/intents/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originAsset: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
          destinationAsset: 'nep141:wrap.near',
          amount: '25000000',
          recipient: 'mpc-firewall.testnet',
          refundTo: 'mpc-firewall.testnet',
          confidentiality: 'advanced'
        })
      });
      const json = await res.json();
      setQuoteOutput(JSON.stringify(json.data ?? json, null, 2));
    } catch (err) {
      setQuoteOutput(err instanceof Error ? err.message : 'Quote request failed');
    } finally {
      setQuoteLoading(false);
    }
  }

  if (!record) {
    return (
      <aside className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1e2935] bg-[#0d1217] p-8 text-center">
        <EyeOff className="mb-3 h-8 w-8 text-[#8b9bb0]" />
        <h3 className="text-sm font-semibold text-[#eef2f6]">No Transaction Inspected Yet</h3>
        <p className="mt-1 max-w-xs text-xs text-[#8b9bb0]">
          Run any preset scenario or paste raw unsigned EVM/Bitcoin hex on the left to inspect the RLP decode, ABI
          calldata tree, TEE audit, and MPC dispatch decision.
        </p>
      </aside>
    );
  }

  const { decision, decoded, teeAudit, mpcDispatch, daoProposalPayload } = record;

  return (
    <aside className="flex flex-col gap-3.5 rounded-xl border border-[#1e2935] bg-[#0d1217] p-4">
      {/* Verdict Banner */}
      <div
        className={`rounded-lg border p-3.5 ${
          decision.outcome === 'APPROVED_FOR_MPC_SIGN'
            ? 'border-[#00ec97]/40 bg-[#00ec97]/10'
            : decision.outcome === 'ESCALATE_TO_DAO'
              ? 'border-[#f59e0b]/40 bg-[#f59e0b]/10'
              : 'border-[#f43f5e]/40 bg-[#f43f5e]/10'
        }`}
      >
        <div className="flex items-center gap-2">
          {decision.outcome === 'APPROVED_FOR_MPC_SIGN' && <CheckCircle2 className="h-5 w-5 text-[#00ec97]" />}
          {decision.outcome === 'ESCALATE_TO_DAO' && <Landmark className="h-5 w-5 text-[#f59e0b]" />}
          {decision.outcome === 'BLOCKED' && <AlertOctagon className="h-5 w-5 text-[#f43f5e]" />}
          <span className="font-mono text-xs font-bold tracking-wide text-[#eef2f6]">{decision.outcome}</span>
        </div>
        <ul className="mt-2 space-y-1 text-xs text-[#eef2f6]">
          {decision.reasons.map((r, i) => (
            <li key={i}>• {r}</li>
          ))}
        </ul>
        {decision.codes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {decision.codes.map((c) => (
              <span
                key={c}
                className="rounded bg-[#070a0d]/80 px-1.5 py-0.5 font-mono text-[10px] text-[#eef2f6]"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Blind-Sign Comparison */}
      <div className="rounded-lg border border-[#1e2935] bg-[#131a21] p-3 text-xs">
        <div className="font-medium text-[#eef2f6]">What v1.signer Alone Sees vs. MpcFirewall</div>
        <div className="mt-1.5 font-mono text-[11px] text-[#8b9bb0]">
          Opaque 32B Digest: <span className="break-all text-[#f59e0b]">{decoded.sighashPayloadHex}</span>
        </div>
        {decoded.kind === 'evm' ? (
          <div className="mt-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-[#8b9bb0]">
              <div>
                type: <span className="text-[#eef2f6]">{decoded.txType}</span>
              </div>
              <div>
                chainId: <span className="text-[#eef2f6]">{decoded.chainId}</span>
              </div>
              <div className="col-span-2 truncate">
                to: <span className="text-[#eef2f6]">{decoded.to}</span>
              </div>
              <div className="col-span-2">
                valueWei: <span className="text-[#eef2f6]">{decoded.valueWei}</span>
              </div>
            </div>
            <CallNode call={decoded.rootCall} />
          </div>
        ) : (
          <div className="mt-2 space-y-1.5 font-mono text-[11px]">
            <div className="text-[#8b9bb0]">
              version={decoded.version} • segwit={String(decoded.isSegwit)} • totalSats=
              <span className="text-[#f59e0b]">{decoded.totalOutputSats}</span>
            </div>
            {decoded.outputs.map((o) => (
              <div key={o.index} className="rounded border border-[#1e2935] bg-[#090d11] p-2 text-[#8b9bb0]">
                out[{o.index}] {o.scriptType} • <span className="text-[#eef2f6]">{o.valueSats} sats</span>
                <div className="truncate text-[10px]">script: {o.scriptPubKeyHex}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TEE Co-Audit */}
      {teeAudit && (
        <div className="rounded-lg border border-[#1e2935] bg-[#131a21] p-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium text-[#eef2f6]">
              <Cpu className="h-3.5 w-3.5 text-[#00ec97]" />
              <span>NEAR AI TEE Intent Audit</span>
            </div>
            <span className="rounded bg-[#00ec97]/15 px-1.5 py-0.5 font-mono text-[10px] text-[#00ec97]">
              {teeAudit.signatureVerified ? 'SIG VERIFIED' : 'UNVERIFIED'}
            </span>
          </div>
          <p className="mt-1.5 text-[#8b9bb0]">{teeAudit.summary}</p>
          <div className="mt-2 font-mono text-[10px] text-[#8b9bb0]">
            mode={teeAudit.mode} • risk={teeAudit.riskLevel} • nonce={teeAudit.nonce.slice(0, 12)}…
          </div>
        </div>
      )}

      {/* Dispatch OR DAO Proposal Payload */}
      {mpcDispatch && (
        <div className="rounded-lg border border-[#00ec97]/30 bg-[#090d11] p-3">
          <div className="mb-1.5 font-mono text-[11px] font-semibold text-[#00ec97]">
            Authorized Cross-Contract Dispatch ({mpcDispatch.firewallContractMethod} → {mpcDispatch.signerContractId})
          </div>
          <pre className="max-h-40 overflow-auto font-mono text-[10px] text-[#eef2f6]">
            {JSON.stringify(mpcDispatch, null, 2)}
          </pre>
        </div>
      )}

      {daoProposalPayload && (
        <div className="rounded-lg border border-[#f59e0b]/30 bg-[#090d11] p-3">
          <div className="mb-1.5 font-mono text-[11px] font-semibold text-[#f59e0b]">
            Generated Trezu / SputnikDAO Multisig Proposal ({daoProposalPayload.contractId})
          </div>
          <pre className="max-h-40 overflow-auto font-mono text-[10px] text-[#eef2f6]">
            {JSON.stringify(daoProposalPayload, null, 2)}
          </pre>
        </div>
      )}

      {/* Live NEAR Intents Confidential Quote Check */}
      <div className="border-t border-[#1e2935] pt-3">
        <button
          type="button"
          onClick={handlePreviewIntents}
          disabled={quoteLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#1e2935] bg-[#131a21] px-3 py-2 text-xs font-medium text-[#eef2f6] hover:border-[#00ec97]/50 disabled:opacity-50"
        >
          <ArrowRightLeft className="h-3.5 w-3.5 text-[#00ec97]" />
          <span>{quoteLoading ? 'Querying 1Click API…' : 'Preview Confidential Intents Treasury Refuel Quote'}</span>
        </button>
        {quoteOutput && (
          <pre className="mt-2 max-h-44 overflow-auto rounded-lg border border-[#1e2935] bg-[#090d11] p-2.5 font-mono text-[10px] text-[#8b9bb0]">
            {quoteOutput}
          </pre>
        )}
      </div>
    </aside>
  );
}

