import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decodeUnsignedBitcoinTx } from '../decoders/btcDecoder.js';
import { decodeUnsignedEvmTx } from '../decoders/evmDecoder.js';
import { runConfidentialTeeAudit } from '../integrations/nearAi.js';
import { buildDaoEscalationPayload, buildMpcDispatchPayload } from '../integrations/outlayer.js';
import { evaluateFirewallPolicy } from '../policy/firewallEngine.js';
import { getDefaultFirewallPolicy } from '../presets/scenarios.js';
import type {
  Bip143InputContext,
  FirewallChainKind,
  FirewallEvaluationRecord,
  FirewallPolicy
} from '../types.js';

interface PersistedState {
  policy: FirewallPolicy;
  dailyTokenSpentUnits: string;
  dailyNativeSpentWei: string;
  dailyBtcSatsSpent: string;
  processedDigests: string[];
  history: FirewallEvaluationRecord[];
}

export interface InspectTxInput {
  chainKind: FirewallChainKind;
  rawUnsignedHex: string;
  agentIntent: string;
  bip143Input?: Bip143InputContext;
  forceLocalEnclave?: boolean;
  strictLiveTee?: boolean;
}

function isFsPermissionError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === 'EROFS' || code === 'EACCES' || code === 'EPERM';
}

function createInitialState(): PersistedState {
  return {
    policy: getDefaultFirewallPolicy(),
    dailyTokenSpentUnits: '0',
    dailyNativeSpentWei: '0',
    dailyBtcSatsSpent: '0',
    processedDigests: [],
    history: []
  };
}

export class FirewallService {
  private dataFile: string | null;
  private memoryState: PersistedState | null = null;
  private readonly forceLocalEnclave: boolean;
  private lockChain: Promise<void> = Promise.resolve();

  constructor(options?: { dataDir?: string; forceLocalEnclave?: boolean }) {
    const isServerless = Boolean(
      process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
    );
    const requestedDir =
      options?.dataDir ||
      (!isServerless ? process.env.MPC_FIREWALL_DATA_DIR?.trim() : undefined) ||
      (isServerless
        ? path.join(os.tmpdir(), 'mpc-firewall-data')
        : path.join(process.cwd(), '.mpc-firewall-data'));

    this.dataFile = this.resolveWritableDataFile(requestedDir);
    this.forceLocalEnclave = Boolean(options?.forceLocalEnclave);
  }

  private resolveWritableDataFile(preferredDir: string): string | null {
    const candidates = [preferredDir, path.join(os.tmpdir(), 'mpc-firewall-data')];
    for (const dir of candidates) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        const probe = path.join(dir, `.probe.${process.pid}.${crypto.randomBytes(3).toString('hex')}`);
        fs.writeFileSync(probe, 'ok', 'utf8');
        fs.unlinkSync(probe);
        return path.join(dir, 'state.json');
      } catch (err) {
        if (!isFsPermissionError(err)) {
          // Unexpected error; continue trying tmpdir or memory fallback
        }
      }
    }
    this.memoryState = createInitialState();
    return null;
  }

  private async withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    let release!: () => void;
    const prev = this.lockChain;
    this.lockChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private readState(): PersistedState {
    if (!this.dataFile) {
      if (!this.memoryState) this.memoryState = createInitialState();
      return this.memoryState;
    }
    if (!fs.existsSync(this.dataFile)) {
      const initial = createInitialState();
      this.writeState(initial);
      return initial;
    }
    const raw = fs.readFileSync(this.dataFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      policy: { ...getDefaultFirewallPolicy(), ...(parsed.policy ?? {}) },
      dailyTokenSpentUnits: parsed.dailyTokenSpentUnits ?? '0',
      dailyNativeSpentWei: parsed.dailyNativeSpentWei ?? '0',
      dailyBtcSatsSpent: parsed.dailyBtcSatsSpent ?? '0',
      processedDigests: parsed.processedDigests ?? [],
      history: parsed.history ?? []
    };
  }

  private writeState(state: PersistedState): void {
    this.memoryState = state;
    if (!this.dataFile) return;
    try {
      const tmpFile = `${this.dataFile}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tmpFile, this.dataFile);
    } catch (err) {
      if (isFsPermissionError(err)) {
        // Degrade cleanly to in-memory persistence if runtime turns read-only
        this.dataFile = null;
        return;
      }
      throw err;
    }
  }

  getPolicy(): FirewallPolicy {
    return this.readState().policy;
  }

  updatePolicy(patch: Partial<FirewallPolicy>): FirewallPolicy {
    const state = this.readState();
    state.policy = { ...state.policy, ...patch };
    this.writeState(state);
    return state.policy;
  }

  getHistory(): FirewallEvaluationRecord[] {
    return this.readState().history;
  }

  getDailyTokenSpentUnits(): string {
    return this.readState().dailyTokenSpentUnits;
  }

  getDailyNativeSpentWei(): string {
    return this.readState().dailyNativeSpentWei;
  }

  getDailyBtcSatsSpent(): string {
    return this.readState().dailyBtcSatsSpent;
  }

  resetDemoState(): PersistedState {
    const fresh = createInitialState();
    this.writeState(fresh);
    return fresh;
  }

  async inspectAndDispatch(input: InspectTxInput): Promise<FirewallEvaluationRecord> {
    return this.withLock(async () => {
      const state = this.readState();
      const policy = state.policy;

      const decoded =
        input.chainKind === 'evm'
          ? decodeUnsignedEvmTx(input.rawUnsignedHex)
          : decodeUnsignedBitcoinTx(input.rawUnsignedHex, input.bip143Input);

      let decision = evaluateFirewallPolicy(
        decoded,
        policy,
        state.dailyTokenSpentUnits,
        state.dailyNativeSpentWei,
        state.dailyBtcSatsSpent
      );

      if (state.processedDigests.includes(decoded.sighashPayloadHex)) {
        decision = {
          outcome: 'BLOCKED',
          codes: ['ERR_REPLAY_DETECTED'],
          reasons: [
            `Payload digest ${decoded.sighashPayloadHex} was already dispatched or escalated; replay rejected.`
          ],
          evaluatedAt: new Date().toISOString()
        };
      }

      let teeAudit;
      if (policy.requireTeeRiskCheck) {
        try {
          teeAudit = await runConfidentialTeeAudit({
            agentIntent: input.agentIntent,
            decoded,
            deterministicDecision: decision,
            forceLocalEnclave: this.forceLocalEnclave || input.forceLocalEnclave,
            strictLiveTee: input.strictLiveTee
          });
          if (teeAudit.riskLevel === 'CRITICAL' && decision.outcome !== 'BLOCKED') {
            decision = {
              outcome: 'BLOCKED',
              codes: [...decision.codes, 'ERR_TEE_CRITICAL_RISK'],
              reasons: [
                ...decision.reasons,
                `NEAR AI TEE Audit flagged CRITICAL intent mismatch: ${teeAudit.summary}`
              ],
              evaluatedAt: new Date().toISOString()
            };
          }
        } catch (err) {
          // Fail closed when strict live TEE verification is required and unavailable
          decision = {
            outcome: 'BLOCKED',
            codes: ['ERR_TEE_UNAVAILABLE'],
            reasons: [
              err instanceof Error ? err.message : 'ERR_TEE_UNAVAILABLE: Confidential TEE check failed.'
            ],
            evaluatedAt: new Date().toISOString()
          };
        }
      }

      const id = `fw_${crypto.randomBytes(6).toString('hex')}`;
      const record: FirewallEvaluationRecord = {
        id,
        createdAt: new Date().toISOString(),
        agentIntent: input.agentIntent,
        decoded,
        decision,
        teeAudit
      };

      if (decision.outcome === 'APPROVED_FOR_MPC_SIGN') {
        record.mpcDispatch = buildMpcDispatchPayload(decoded, policy);
        state.processedDigests = [decoded.sighashPayloadHex, ...state.processedDigests].slice(0, 500);

        if (decoded.kind === 'evm') {
          const addedTokens = decoded.flattenedCalls.reduce((sum, call) => {
            if (
              call.action === 'ERC20_TRANSFER' ||
              call.action === 'ERC20_TRANSFER_FROM' ||
              call.action === 'ERC20_APPROVE' ||
              call.action === 'ERC20_PERMIT'
            ) {
              return sum + BigInt(call.tokenAmount ?? '0');
            }
            return sum;
          }, 0n);
          const maxGasFeeWei = BigInt(decoded.gasLimit || '0') * BigInt(decoded.maxFeePerGas || '0');
          state.dailyTokenSpentUnits = (BigInt(state.dailyTokenSpentUnits) + addedTokens).toString();
          state.dailyNativeSpentWei = (
            BigInt(state.dailyNativeSpentWei) + BigInt(decoded.valueWei) + maxGasFeeWei
          ).toString();
        } else if (decoded.kind === 'bitcoin') {
          state.dailyBtcSatsSpent = (
            BigInt(state.dailyBtcSatsSpent) + BigInt(decoded.totalOutputSats)
          ).toString();
        }
      } else if (decision.outcome === 'ESCALATE_TO_DAO') {
        state.processedDigests = [decoded.sighashPayloadHex, ...state.processedDigests].slice(0, 500);
        record.daoProposalPayload = buildDaoEscalationPayload(id, decoded, policy, input.agentIntent);
      }

      state.history = [record, ...state.history].slice(0, 30);
      this.writeState(state);
      return record;
    });
  }
}
