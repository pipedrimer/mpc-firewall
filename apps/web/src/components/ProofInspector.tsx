'use client';

import type { EvmDecodedCall, FirewallEvaluationRecord } from '@mpc-firewall/core';
import { AlertOctagon, ArrowRightLeft, CheckCircle2, Cpu, EyeOff, Landmark } from 'lucide-react';
import { useState } from 'react';

interface ProofInspectorProps {
  record: FirewallEvaluationRecord | null;
}

function CallNode({ call }: { call: EvmDecodedCall }) {
  return (
    <div className="rounded-lg border border-[#DCE0E8] bg-white p-2.5 font-mono text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[#0B0F17]">
          depth={call.depth} • {call.action}
        </span>
        <span className="rounded bg-[#F4F5F8] px-1.5 py-0.5 text-[#525B6C]">selector {call.selector}</span>
      </div>
      <div className="mt-1.5 space-y-0.5 text-[11px] text-[#525B6C]">
        {call.recipient && (
          <div>
            recipient: <span className="text-[#0B0F17]">{call.recipient}</span>
          </div>
        )}
        {call.spenderOrOperator && (
          <div>
            spender/operator: <span className="text-[#0B0F17]">{call.spenderOrOperator}</span>
          </div>
        )}
        {call.tokenAmount && (
          <div>
            amount (base units): <span className="font-semibold text-[#D97706]">{call.tokenAmount}</span>
          </div>
        )}
        {call.approvedBool !== undefined && (
          <div>
            approved: <span className="font-semibold text-[#E11D48]">{String(call.approvedBool)}</span>
          </div>
        )}
      </div>
      {call.nestedCalls.length > 0 && (
        <div className="mt-2 space-y-2 border-l-2 border-[#1F3CFF]/40 pl-3">
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
          recipient: 'mpc-firewall.near',
          refundTo: 'mpc-firewall.near',
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
      <aside className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DCE0E8] bg-white p-8 text-center">
        <EyeOff className="mb-3 h-8 w-8 text-[#525B6C]" />
        <h3 className="text-sm font-bold text-[#0B0F17]">No Transaction Inspected Yet</h3>
        <p className="mt-1 max-w-xs text-xs text-[#525B6C]">
          Run any preset scenario or paste raw unsigned EVM/Bitcoin hex on the left to inspect the RLP decode, ABI
          calldata tree, TEE audit, and MPC dispatch decision.
        </p>
      </aside>
    );
  }

  const { decision, decoded, teeAudit, mpcDispatch, daoProposalPayload } = record;

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-[#DCE0E8] bg-white p-5 shadow-[0_1px_2px_rgba(11,15,23,0.04)]">
      {/* Verdict Banner */}
      <div
        className={`rounded-lg border p-3.5 ${
          decision.outcome === 'APPROVED_FOR_MPC_SIGN'
            ? 'border-[#059669]/30 bg-[#059669]/[0.06]'
            : decision.outcome === 'ESCALATE_TO_DAO'
              ? 'border-[#D97706]/30 bg-[#D97706]/[0.06]'
              : 'border-[#E11D48]/30 bg-[#E11D48]/[0.06]'
        }`}
      >
        <div className="flex items-center gap-2">
          {decision.outcome === 'APPROVED_FOR_MPC_SIGN' && <CheckCircle2 className="h-5 w-5 text-[#059669]" />}
          {decision.outcome === 'ESCALATE_TO_DAO' && <Landmark className="h-5 w-5 text-[#D97706]" />}
          {decision.outcome === 'BLOCKED' && <AlertOctagon className="h-5 w-5 text-[#E11D48]" />}
          <span className="font-mono text-xs font-bold tracking-wide text-[#0B0F17]">{decision.outcome}</span>
        </div>
        <ul className="mt-2 space-y-1 text-xs text-[#0B0F17]">
          {decision.reasons.map((r, i) => (
            <li key={i}>• {r}</li>
          ))}
        </ul>
        {decision.codes.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {decision.codes.map((c) => (
              <span
                key={c}
                className="rounded border border-[#DCE0E8] bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-[#0B0F17]"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Blind-Sign Comparison */}
      <div className="rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] p-3.5 text-xs">
        <div className="font-semibold text-[#0B0F17]">What v1.signer Alone Sees vs. MpcFirewall</div>
        <div className="mt-1.5 font-mono text-[11px] text-[#525B6C]">
          Opaque 32B Digest: <span className="break-all font-medium text-[#1F3CFF]">{decoded.sighashPayloadHex}</span>
        </div>
        {decoded.kind === 'evm' ? (
          <div className="mt-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-[#525B6C]">
              <div>
                type: <span className="text-[#0B0F17]">{decoded.txType}</span>
              </div>
              <div>
                chainId: <span className="text-[#0B0F17]">{decoded.chainId}</span>
              </div>
              <div className="col-span-2 truncate">
                to: <span className="text-[#0B0F17]">{decoded.to}</span>
              </div>
              <div className="col-span-2">
                valueWei: <span className="text-[#0B0F17]">{decoded.valueWei}</span>
              </div>
            </div>
            <CallNode call={decoded.rootCall} />
          </div>
        ) : (
          <div className="mt-2.5 space-y-1.5 font-mono text-[11px]">
            <div className="text-[#525B6C]">
              version={decoded.version} • segwit={String(decoded.isSegwit)} • totalSats=
              <span className="font-semibold text-[#D97706]">{decoded.totalOutputSats}</span>
            </div>
            {decoded.outputs.map((o) => (
              <div key={o.index} className="rounded border border-[#DCE0E8] bg-white p-2 text-[#525B6C]">
                out[{o.index}] {o.scriptType} • <span className="font-semibold text-[#0B0F17]">{o.valueSats} sats</span>
                <div className="truncate text-[10px]">script: {o.scriptPubKeyHex}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TEE Co-Audit */}
      {teeAudit && (
        <div className="rounded-lg border border-[#E2E6EE] bg-[#F8F9FB] p-3.5 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-[#0B0F17]">
              <Cpu className="h-3.5 w-3.5 text-[#1F3CFF]" />
              <span>NEAR AI TEE Intent Audit</span>
            </div>
            <span className="rounded bg-[#059669]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#059669]">
              {teeAudit.signatureVerified ? 'SIG VERIFIED' : 'UNVERIFIED'}
            </span>
          </div>
          <p className="mt-1.5 text-[#525B6C]">{teeAudit.summary}</p>
          <div className="mt-2 font-mono text-[10px] text-[#525B6C]">
            mode={teeAudit.mode} • risk={teeAudit.riskLevel} • nonce={teeAudit.nonce.slice(0, 12)}…
          </div>
        </div>
      )}

      {/* Dispatch OR DAO Proposal Payload */}
      {mpcDispatch && (
        <div className="rounded-lg border border-[#059669]/30 bg-[#059669]/[0.04] p-3.5">
          <div className="mb-1.5 font-mono text-[11px] font-semibold text-[#059669]">
            Authorized Cross-Contract Dispatch ({mpcDispatch.firewallContractMethod} → {mpcDispatch.signerContractId})
          </div>
          <pre className="max-h-40 overflow-auto font-mono text-[10px] text-[#0B0F17]">
            {JSON.stringify(mpcDispatch, null, 2)}
          </pre>
        </div>
      )}

      {daoProposalPayload && (
        <div className="rounded-lg border border-[#D97706]/30 bg-[#D97706]/[0.04] p-3.5">
          <div className="mb-1.5 font-mono text-[11px] font-semibold text-[#D97706]">
            Generated Trezu / SputnikDAO Multisig Proposal ({daoProposalPayload.contractId})
          </div>
          <pre className="max-h-40 overflow-auto font-mono text-[10px] text-[#0B0F17]">
            {JSON.stringify(daoProposalPayload, null, 2)}
          </pre>
        </div>
      )}

      {/* Live NEAR Intents Confidential Quote Check */}
      <div className="border-t border-[#E2E6EE] pt-3.5">
        <button
          type="button"
          onClick={handlePreviewIntents}
          disabled={quoteLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#DCE0E8] bg-[#F8F9FB] px-3 py-2.5 text-xs font-semibold text-[#0B0F17] transition-colors hover:border-[#0B0F17]/40 hover:bg-white disabled:opacity-50"
        >
          <ArrowRightLeft className="h-3.5 w-3.5 text-[#1F3CFF]" />
          <span>{quoteLoading ? 'Querying 1Click API…' : 'Preview Confidential Intents Treasury Refuel Quote'}</span>
        </button>
          {quoteOutput && (
          <pre className="mt-2 max-h-44 overflow-auto rounded-lg border border-[#DCE0E8] bg-[#F8F9FB] p-2.5 font-mono text-[10px] text-[#525B6C]">
            {quoteOutput}
          </pre>
        )}
      </div>

      {/* Live NEAR Testnet Deployment & Chain Signatures Proofs */}
      <div className="rounded-lg border border-[#DCE0E8] bg-[#F8F9FB] p-3 text-[11px]">
        <div className="font-semibold text-[#0B0F17]">Live NEAR Testnet Contract Proofs</div>
        <div className="mt-1.5 space-y-1 font-mono text-[10px] text-[#525B6C]">
          <div>
            Contract:{' '}
            <a
              href="https://testnet.nearblocks.io/address/mpc-firewall.testnet"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#1F3CFF] underline"
            >
              mpc-firewall.testnet
            </a>
          </div>
          <div>
            Deploy + Init TX:{' '}
            <a
              href="https://testnet.nearblocks.io/txns/3B94S9sB92jABvy2rYt4sZXiD4Rri47v3RpULScY3XQs"
              target="_blank"
              rel="noreferrer"
              className="text-[#1F3CFF] underline"
            >
              3B94S9…Y3XQs
            </a>
          </div>
          <div>
            Live MPC Secp256k1 Sign TX:{' '}
            <a
              href="https://testnet.nearblocks.io/txns/9CMZemnkejMCCJHeUXHBtHp4A49T71aLyjoBBQ98ZxVN"
              target="_blank"
              rel="noreferrer"
              className="text-[#059669] underline"
            >
              9CMZem…8ZxVN
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
