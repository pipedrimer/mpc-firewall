import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { decodeUnsignedBitcoinTx } from '../decoders/btcDecoder.js';
import { decodeUnsignedEvmTx } from '../decoders/evmDecoder.js';
import { runConfidentialTeeAudit } from '../integrations/nearAi.js';
import { buildDaoEscalationPayload, buildMpcDispatchPayload } from '../integrations/outlayer.js';
import { evaluateFirewallPolicy } from '../policy/firewallEngine.js';
import { getDefaultFirewallPolicy } from '../presets/scenarios.js';
import type {
  FirewallChainKind,
  FirewallEvaluationRecord,
  FirewallPolicy
} from '../types.js';

interface PersistedState {
  policy: FirewallPolicy;
  dailyTokenSpentUnits: string;
  dailyNativeSpentWei: string;
  processedDigests: string[];
  history: FirewallEvaluationRecord[];
}

export interface InspectTxInput {
  chainKind: FirewallChainKind;
  rawUnsignedHex: string;
  agentIntent: string;
  forceLocalEnclave?: boolean;
  strictLiveTee?: boolean;
}

export class FirewallService {
  private readonly dataFile: string;
  private readonly forceLocalEnclave: boolean;
  private lockChain: Promise<void> = Promise.resolve();

  constructor(options?: { dataDir?: string; forceLocalEnclave?: boolean }) {
    const dir =
      options?.dataDir ||
      process.env.MPC_FIREWALL_DATA_DIR ||
      path.join(process.cwd(), '.mpc-firewall-data');
    fs.mkdirSync(dir, { recursive: true });
    this.dataFile = path.join(dir, 'state.json');
    this.forceLocalEnclave = Boolean(options?.forceLocalEnclave);
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
    if (!fs.existsSync(this.dataFile)) {
      const initial: PersistedState = {
        policy: getDefaultFirewallPolicy(),
        dailyTokenSpentUnits: '0',
        dailyNativeSpentWei: '0',
        processedDigests: [],
        history: []
      };
      this.writeState(initial);
      return initial;
    }
    const raw = fs.readFileSync(this.dataFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      policy: { ...getDefaultFirewallPolicy(), ...(parsed.policy ?? {}) },
      dailyTokenSpentUnits: parsed.dailyTokenSpentUnits ?? '0',
      dailyNativeSpentWei: parsed.dailyNativeSpentWei ?? '0',
      processedDigests: parsed.processedDigests ?? [],
      history: parsed.history ?? []
    };
  }

  private writeState(state: PersistedState): void {
    const tmpFile = `${this.dataFile}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpFile, this.dataFile);
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

  resetDemoState(): PersistedState {
    const fresh: PersistedState = {
      policy: getDefaultFirewallPolicy(),
      dailyTokenSpentUnits: '0',
      dailyNativeSpentWei: '0',
      processedDigests: [],
      history: []
    };
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
          : decodeUnsignedBitcoinTx(input.rawUnsignedHex);

      let decision = evaluateFirewallPolicy(
        decoded,
        policy,
        state.dailyTokenSpentUnits,
        state.dailyNativeSpentWei
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
          state.dailyTokenSpentUnits = (BigInt(state.dailyTokenSpentUnits) + addedTokens).toString();
          state.dailyNativeSpentWei = (
            BigInt(state.dailyNativeSpentWei) + BigInt(decoded.valueWei)
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
