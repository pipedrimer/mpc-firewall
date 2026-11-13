import crypto from 'node:crypto';
import { ethers } from 'ethers';
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

const CHAIN_KEYWORDS: Array<{ regex: RegExp; expectedChainId: number; label: string }> = [
  { regex: /\bethereum(\s+mainnet)?\b/i, expectedChainId: 1, label: 'Ethereum Mainnet (1)' },
  { regex: /\bbase(\s+sepolia)?\b/i, expectedChainId: 8453, label: 'Base (8453)' },
  { regex: /\barbitrum\b/i, expectedChainId: 42161, label: 'Arbitrum (42161)' },
  { regex: /\boptimism\b/i, expectedChainId: 10, label: 'Optimism (10)' },
  { regex: /\bpolygon\b/i, expectedChainId: 137, label: 'Polygon (137)' }
];

function detectIntentCalldataMismatch(agentIntent: string, decoded: DecodedForeignTx): string | null {
  const intent = agentIntent.trim();

  if (decoded.kind === 'bitcoin') {
    if (/\b(ethereum|base|arbitrum|erc-?20|usdc|uniswap)\b/i.test(intent)) {
      return 'Intent references EVM/ERC-20 assets, but raw transaction bytes encode a Bitcoin UTXO transaction.';
    }
    const satsMatch = intent.match(/\b([\d,]+)\s*sats?\b/i);
    if (satsMatch) {
      const claimedSats = BigInt(satsMatch[1].replace(/,/g, ''));
      const actualSats = BigInt(decoded.totalOutputSats);
      if (actualSats > claimedSats) {
        return `Intent states ${claimedSats.toString()} sats, but raw Bitcoin outputs send ${actualSats.toString()} sats.`;
      }
    }
    return null;
  }

  // 1. Cross-chain mismatch check
  for (const entry of CHAIN_KEYWORDS) {
    if (entry.regex.test(intent)) {
      const baseSepoliaOk = entry.expectedChainId === 8453 && decoded.chainId === 84532;
      if (decoded.chainId !== entry.expectedChainId && !baseSepoliaOk) {
        return `Intent claims ${entry.label}, but RLP encodes chainId ${decoded.chainId}.`;
      }
    }
  }
  if (/\bbitcoin\b/i.test(intent)) {
    return 'Intent references Bitcoin, but raw transaction encodes an EVM transaction.';
  }

  // 2. Native ETH vs ERC-20 token contradiction
  const claimsEth = /\b(\d+(?:\.\d+)?)\s*eth\b/i.test(intent);
  const claimsUsdc = /\b(\d+(?:\.\d+)?)\s*usdc\b/i.test(intent);
  if (claimsEth && decoded.valueWei === '0' && decoded.rootCall.action !== 'NATIVE_TRANSFER') {
    return `Intent states an ETH transfer, but decoded calldata executes ${decoded.rootCall.action} with 0 native wei.`;
  }
  if (claimsUsdc && decoded.rootCall.action === 'NATIVE_TRANSFER') {
    return 'Intent states a USDC payment, but raw transaction executes a native ETH transfer with empty calldata.';
  }

  // 3. Approval / NFT handover disguised as routine payout or claim
  const hasApproval = decoded.flattenedCalls.some(
    (c) =>
      c.action === 'ERC20_APPROVE' ||
      c.action === 'ERC20_PERMIT' ||
      c.action === 'PERMIT2_APPROVE' ||
      c.action === 'PERMIT2_PERMIT' ||
      c.action === 'NFT_SET_APPROVAL_FOR_ALL'
  );
  if (hasApproval && !/\b(approv|allowance|permit|revoke)\b/i.test(intent)) {
    return 'Intent describes a non-approval action, but calldata invokes token/NFT approval authority.';
  }

  // 4. Stated USDC amount vs decoded token outflow
  const usdcMatch = intent.match(/\b(\d+(?:\.\d+)?)\s*usdc\b/i);
  if (usdcMatch) {
    const claimedFloat = Number(usdcMatch[1]);
    if (Number.isFinite(claimedFloat)) {
      const claimedUnits = BigInt(Math.round(claimedFloat * 1_000_000));
      const actualUnits = decoded.flattenedCalls.reduce(
        (acc, c) => acc + BigInt(c.tokenAmount ?? '0'),
        0n
      );
      if (actualUnits > claimedUnits * 2n || (claimedUnits > 0n && actualUnits === 0n)) {
        return `Intent states ${claimedFloat} USDC, but decoded calldata moves ${Number(actualUnits) / 1_000_000} USDC.`;
      }
    }
  }

  return null;
}

function summarizeDeterministicRisk(
  agentIntent: string,
  decoded: DecodedForeignTx,
  decision: FirewallDecision
): { riskLevel: TeeIntentAudit['riskLevel']; summary: string } {
  if (decision.outcome === 'BLOCKED') {
    return {
      riskLevel: 'CRITICAL',
      summary: `TEE audit flags critical risk: ${decision.codes.join(', ')}. ${decision.reasons[0] ?? ''}`.trim()
    };
  }

  const mismatch = detectIntentCalldataMismatch(agentIntent, decoded);
  if (mismatch) {
    return {
      riskLevel: 'CRITICAL',
      summary: `Intent vs. decoded calldata mismatch detected: ${mismatch}`
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
  const baseUrl = (process.env.NEARAI_BASE_URL?.trim() || 'https://cloud-api.near.ai/v1').replace(/\/+$/, '');
  const model = process.env.NEARAI_MODEL?.trim() || 'Qwen/Qwen3.6-35B-A3B-FP8';

  const applyMismatchFloor = (
    riskLevel: TeeIntentAudit['riskLevel'],
    summary: string
  ): { riskLevel: TeeIntentAudit['riskLevel']; summary: string } => {
    if (input.deterministicDecision.outcome === 'BLOCKED') {
      return { riskLevel: 'CRITICAL', summary };
    }
    const mismatch = detectIntentCalldataMismatch(input.agentIntent, input.decoded);
    if (mismatch) {
      return {
        riskLevel: 'CRITICAL',
        summary: `Intent vs. decoded calldata mismatch detected: ${mismatch}`
      };
    }
    return { riskLevel, summary };
  };

  const parseModelAudit = (rawText: string): { riskLevel: TeeIntentAudit['riskLevel']; summary: string } => {
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
    return applyMismatchFloor(riskLevel, summary);
  };

  if (strictLive && !apiKey && !input.forceLocalEnclave) {
    throw new Error('ERR_TEE_UNAVAILABLE: STRICT_LIVE_TEE=true requires NEARAI_API_KEY.');
  }

  if (apiKey && !input.forceLocalEnclave) {
    const messages = [
      {
        role: 'system' as const,
        content:
          'You are a confidential blockchain security co-auditor running inside NEAR AI Cloud TEE. Compare the stated agent intent against the decoded transaction fields (remembering ERC-20 USDC uses 6 decimals, so 25000000 = 25 USDC and 250000000 = 250 USDC, and any address in ESCALATE_TO_DAO or APPROVED_FOR_MPC_SIGN already passed policy allowlists—do not guess protocol names for vendor addresses like 0x1111...1111). Return strict JSON: {"riskLevel":"LOW"|"MEDIUM"|"CRITICAL","summary":"one concise sentence"}. Use "CRITICAL" only when deterministicOutcome is "BLOCKED" or stated intent contradicts the decoded chain, asset, recipient/action, or amount; use "MEDIUM" when deterministicOutcome is "ESCALATE_TO_DAO" and intent matches; use "LOW" when approved and intent matches.'
      },
      {
        role: 'user' as const,
        content: JSON.stringify({
          agentIntent: input.agentIntent,
          decodedTx: input.decoded,
          deterministicOutcome: input.deterministicDecision.outcome,
          deterministicCodes: input.deterministicDecision.codes
        })
      }
    ];

    try {
      const client = new InferenceClient({
        apiKey,
        baseUrl,
        e2ee: process.env.NEARAI_E2EE !== 'false'
      });

      const completion = await client.chat.completions.create({
        model,
        temperature: 0,
        messages
      });

      const verified = await client.verifyResponse(completion.id);
      const rawText = completion.choices[0]?.message?.content ?? '{}';
      const { riskLevel, summary } = parseModelAudit(rawText);

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
    } catch (sdkErr) {
      // If SDK preflight hits transient Intel PCS DNS or 1-2s NVIDIA NRAS clock-skew,
      // execute directly against NEAR AI Cloud provider_tee REST API and verify ECDSA hashes.
      try {
        const reqBody = JSON.stringify({ model, temperature: 0, messages });
        const reqSha256 = crypto.createHash('sha256').update(reqBody).digest('hex');

        const chatRes = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: reqBody,
          signal: AbortSignal.timeout(15000)
        });
        if (!chatRes.ok) {
          throw new Error(`NEAR AI Cloud HTTP ${chatRes.status}`);
        }

        const rawResp = await chatRes.text();
        const respSha256 = crypto.createHash('sha256').update(rawResp).digest('hex');
        const completion = JSON.parse(rawResp) as {
          id?: string;
          choices?: Array<{ message?: { content?: string } }>;
        };
        if (!completion.id) {
          throw new Error('Missing completion id from NEAR AI Cloud');
        }

        const sigRes = await fetch(
          `${baseUrl}/signature/${encodeURIComponent(completion.id)}?model=${encodeURIComponent(model)}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000)
          }
        );
        if (!sigRes.ok) {
          throw new Error(`NEAR AI Signature HTTP ${sigRes.status}`);
        }
        const sig = (await sigRes.json()) as {
          text: string;
          signature: string;
          signing_address: string;
          signing_algo?: string;
          signature_kind?: string;
        };

        const expectedText = `${model}:${reqSha256}:${respSha256}`;
        const recovered = ethers.verifyMessage(sig.text, sig.signature).toLowerCase();
        const sigVerified =
          sig.text === expectedText && recovered === sig.signing_address.toLowerCase();
        if (!sigVerified) {
          throw new Error('NEAR AI TEE signature verification failed');
        }

        const rawText = completion.choices?.[0]?.message?.content ?? '{}';
        const { riskLevel, summary } = parseModelAudit(rawText);

        return {
          mode: 'near-ai-live',
          nonce,
          model,
          responseId: completion.id,
          payloadDigestSha256,
          enclaveQuoteSha256: crypto
            .createHash('sha256')
            .update(JSON.stringify(sig))
            .digest('hex'),
          signatureHex: sig.signature.startsWith('0x') ? sig.signature.slice(2) : sig.signature,
          signerPublicKeyPem: sig.signing_address,
          signatureVerified: true,
          riskLevel,
          summary,
          verifiedAt: new Date().toISOString()
        };
      } catch (restErr) {
        if (strictLive) {
          const detail = restErr instanceof Error ? restErr.message : String(sdkErr);
          throw new Error(`ERR_TEE_UNAVAILABLE: Live NEAR AI TEE audit failed in strict mode (${detail}).`);
        }
        // In non-strict demo mode, fall back cleanly to local verifiable enclave
      }
    }
  }

  const { riskLevel, summary } = summarizeDeterministicRisk(
    input.agentIntent,
    input.decoded,
    input.deterministicDecision
  );
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

