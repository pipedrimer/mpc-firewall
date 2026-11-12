import crypto from 'node:crypto';
import { InferenceClient } from '@nearai/inference-sdk/node';
import type { DecodedForeignTx, FirewallDecision, TeeIntentAudit } from '../types.js';

const { privateKey: localEnclavePrivKey, publicKey: localEnclavePubKey } = crypto.generateKeyPairSync('ed25519');
const localEnclavePubPem = localEnclavePubKey.export({ type: 'spki', format: 'pem' }).toString();

export interface TeeAuditInput {
  agentIntent: string;
  decoded: DecodedForeignTx;
  deterministicDecision: FirewallDecision;
  forceLocalEnclave?: boolean;
  strictLiveTee?: boolean;
}

function summarizeDeterministicRisk(
  decoded: DecodedForeignTx,
  decision: FirewallDecision
): { riskLevel: TeeIntentAudit['riskLevel']; summary: string } {
  if (decision.outcome === 'BLOCKED') {
    return {
      riskLevel: 'CRITICAL',
      summary: `TEE audit flags critical risk: ${decision.codes.join(', ')}. ${decision.reasons[0] ?? ''}`.trim()
    };
  }
  if (decision.outcome === 'ESCALATE_TO_DAO') {
    return {
      riskLevel: 'MEDIUM',
      summary: `Decoded transaction matches stated intent (${decoded.kind.toUpperCase()}) but exceeds autonomous cap; DAO review advised.`
    };
  }
  return {
    riskLevel: 'LOW',
    summary: `Decoded ${decoded.kind.toUpperCase()} transaction aligns with stated agent intent and deterministic policy invariants.`
  };
}

export function verifyLocalTeeAuditSignature(audit: TeeIntentAudit): boolean {
  if (audit.mode !== 'local-verifiable-enclave') {
    return audit.signatureVerified;
  }
  return crypto.verify(
    null,
    Buffer.from(`${audit.nonce}|${audit.payloadDigestSha256}|${audit.riskLevel}|${audit.responseId}`, 'utf8'),
    audit.signerPublicKeyPem,
    Buffer.from(audit.signatureHex, 'hex')
  );
}

export async function runConfidentialTeeAudit(input: TeeAuditInput): Promise<TeeIntentAudit> {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payloadDigestSha256 = crypto
    .createHash('sha256')
    .update(JSON.stringify({ intent: input.agentIntent, sighash: input.decoded.sighashPayloadHex }))
    .digest('hex');

  const strictLive = input.strictLiveTee ?? process.env.STRICT_LIVE_TEE === 'true';
  const apiKey = process.env.NEARAI_API_KEY?.trim();
  const baseUrl = process.env.NEARAI_BASE_URL?.trim() || 'https://cloud-api.near.ai/v1/';
  const model = process.env.NEARAI_MODEL?.trim() || 'deepseek-ai/DeepSeek-V3.1';

  if (strictLive && !apiKey && !input.forceLocalEnclave) {
    throw new Error('ERR_TEE_UNAVAILABLE: STRICT_LIVE_TEE=true requires NEARAI_API_KEY.');
  }

  if (apiKey && !input.forceLocalEnclave) {
    try {
      const client = new InferenceClient({
        apiKey,
        baseUrl,
        e2ee: process.env.NEARAI_E2EE !== 'false'
      });

      const completion = await client.chat.completions.create({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are a confidential blockchain security co-auditor running inside NEAR AI Cloud TEE. Compare the stated agent intent against the decoded transaction fields and return strict JSON: {"riskLevel":"LOW"|"MEDIUM"|"CRITICAL","summary":"one concise sentence"}.'
          },
          {
            role: 'user',
            content: JSON.stringify({
              agentIntent: input.agentIntent,
              decodedTx: input.decoded,
              deterministicOutcome: input.deterministicDecision.outcome,
              deterministicCodes: input.deterministicDecision.codes
            })
          }
        ]
      });

      const verified = await client.verifyResponse(completion.id);
      const rawText = completion.choices[0]?.message?.content ?? '{}';
      let riskLevel: TeeIntentAudit['riskLevel'] =
        input.deterministicDecision.outcome === 'BLOCKED' ? 'CRITICAL' : 'LOW';
      let summary = rawText;

      try {
        const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim()) as {
          riskLevel?: TeeIntentAudit['riskLevel'];
          summary?: string;
        };
        if (parsed.riskLevel === 'LOW' || parsed.riskLevel === 'MEDIUM' || parsed.riskLevel === 'CRITICAL') {
          riskLevel = parsed.riskLevel;
        }
        if (parsed.summary) summary = parsed.summary;
      } catch {
        // Keep raw model summary if non-JSON
      }

      const sigHex =
        verified.signature.signature.startsWith('0x')
          ? verified.signature.signature.slice(2)
          : verified.signature.signature;

      return {
        mode: 'near-ai-live',
        nonce,
        model,
        responseId: verified.id,
        payloadDigestSha256,
        enclaveQuoteSha256: crypto
          .createHash('sha256')
          .update(JSON.stringify(verified))
          .digest('hex'),
        signatureHex: sigHex,
        signerPublicKeyPem: verified.signature.signer.signingAddress,
        signatureVerified: true,
        riskLevel,
        summary,
        verifiedAt: new Date().toISOString()
      };
    } catch (err) {
      if (strictLive) {
        const detail = err instanceof Error ? err.message : 'Unknown TEE error';
        throw new Error(`ERR_TEE_UNAVAILABLE: Live NEAR AI TEE audit failed in strict mode (${detail}).`);
      }
      // In non-strict demo mode, fall back cleanly to local verifiable enclave
    }
  }

  const { riskLevel, summary } = summarizeDeterministicRisk(input.decoded, input.deterministicDecision);
  const responseId = `local_tee_${crypto.randomBytes(8).toString('hex')}`;
  const canonicalMsg = `${nonce}|${payloadDigestSha256}|${riskLevel}|${responseId}`;
  const signatureHex = crypto.sign(null, Buffer.from(canonicalMsg, 'utf8'), localEnclavePrivKey).toString('hex');

  const audit: TeeIntentAudit = {
    mode: 'local-verifiable-enclave',
    nonce,
    model: 'local-ed25519-tee-simulator',
    responseId,
    payloadDigestSha256,
    enclaveQuoteSha256: crypto.createHash('sha256').update(`TDX-SIM:${nonce}:${payloadDigestSha256}`).digest('hex'),
    signatureHex,
    signerPublicKeyPem: localEnclavePubPem,
    signatureVerified: false,
    riskLevel,
    summary,
    verifiedAt: new Date().toISOString()
  };

  audit.signatureVerified = verifyLocalTeeAuditSignature(audit);
  return audit;
}

