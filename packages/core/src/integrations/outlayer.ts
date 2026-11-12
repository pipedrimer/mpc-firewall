import type {
  DaoEscalationPayload,
  DecodedForeignTx,
  FirewallPolicy,
  MpcSignDispatchPayload
} from '../types.js';

function hexToByteArray32(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const buf = Buffer.from(clean, 'hex');
  if (buf.length !== 32) {
    throw new Error(`Expected 32-byte payload hash, got ${buf.length} bytes`);
  }
  return Array.from(buf);
}

/**
 * Builds the exact NEAR Chain Signatures (`v1.signer` / `v1.signer-prod.testnet`) cross-contract
 * `sign` payload generated ONLY AFTER the MpcFirewall contract decodes & verifies raw tx bytes.
 */
export function buildMpcDispatchPayload(
  decoded: DecodedForeignTx,
  policy: FirewallPolicy
): MpcSignDispatchPayload {
  return {
    signerContractId: policy.mpcSignerContractId,
    methodName: 'sign',
    args: {
      request: {
        payload: hexToByteArray32(decoded.sighashPayloadHex),
        path: policy.derivationPath,
        key_version: 0
      }
    },
    payloadHex: decoded.sighashPayloadHex,
    firewallContractMethod: decoded.kind === 'evm' ? 'verify_and_sign_evm' : 'verify_and_sign_btc'
  };
}

/**
 * Builds a SputnikDAO / Trezu `add_proposal` payload for legitimate high-value foreign-chain
 * transactions that exceed the autonomous limit and require multisig co-signers.
 */
export function buildDaoEscalationPayload(
  txId: string,
  decoded: DecodedForeignTx,
  policy: FirewallPolicy,
  agentIntent: string
): DaoEscalationPayload {
  const argsJson = JSON.stringify({ tx_id: txId });
  return {
    contractId: policy.daoAccount,
    methodName: 'add_proposal',
    args: {
      proposal: {
        description: `MpcFirewall DAO escalation (${txId}): ${agentIntent} | digest=${decoded.sighashPayloadHex}`,
        kind: {
          FunctionCall: {
            receiver_id: policy.firewallContractId,
            actions: [
              {
                method_name: 'dao_approve_escalated',
                args: Buffer.from(argsJson, 'utf8').toString('base64'),
                deposit: '1',
                gas: '300000000000000'
              }
            ]
          }
        }
      }
    }
  };
}

