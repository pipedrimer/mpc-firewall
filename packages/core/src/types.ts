export type FirewallChainKind = 'evm' | 'bitcoin';

export type EvmActionType =
  | 'NATIVE_TRANSFER'
  | 'ERC20_TRANSFER'
  | 'ERC20_APPROVE'
  | 'ERC20_PERMIT'
  | 'ERC20_TRANSFER_FROM'
  | 'NFT_SET_APPROVAL_FOR_ALL'
  | 'MULTICALL'
  | 'UNKNOWN_CONTRACT_CALL';

export interface EvmDecodedCall {
  depth: number;
  target: string;
  selector: string;
  action: EvmActionType;
  spenderOrOperator?: string;
  recipient?: string;
  fromAddress?: string;
  tokenAmount?: string;
  approvedBool?: boolean;
  nestedCalls: EvmDecodedCall[];
  rawDataHex: string;
}

export interface DecodedEvmTx {
  kind: 'evm';
  txType: 'eip1559' | 'eip2930' | 'legacy';
  chainId: number;
  nonce: string;
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  gasLimit: string;
  to: string;
  valueWei: string;
  dataHex: string;
  rawUnsignedHex: string;
  sighashPayloadHex: string;
  rootCall: EvmDecodedCall;
  flattenedCalls: EvmDecodedCall[];
}

export interface BitcoinOutput {
  index: number;
  valueSats: string;
  scriptPubKeyHex: string;
  scriptType: 'P2WPKH' | 'P2WSH' | 'P2PKH' | 'P2SH' | 'P2TR' | 'OP_RETURN' | 'UNKNOWN';
}

export interface DecodedBitcoinTx {
  kind: 'bitcoin';
  version: number;
  isSegwit: boolean;
  inputCount: number;
  outputs: BitcoinOutput[];
  totalOutputSats: string;
  rawUnsignedHex: string;
  sighashPayloadHex: string;
}

export type DecodedForeignTx = DecodedEvmTx | DecodedBitcoinTx;

export interface FirewallPolicy {
  id: string;
  name: string;
  derivationPath: string;
  firewallContractId: string;
  mpcSignerContractId: string;
  allowedChainIds: number[];
  allowedTargetContracts: string[];
  blockedAddresses: string[];
  allowedRecipients: string[];
  maxNativeValueWei: string;
  autoApproveNativeValueWei: string;
  maxDailyNativeWei: string;
  maxTokenAmountUnits: string;
  autoApproveTokenUnits: string;
  maxDailyTokenUnits: string;
  allowUnlimitedApprovals: boolean;
  allowSetApprovalForAll: boolean;
  allowUnknownSelectors: boolean;
  maxBtcOutputSats: string;
  allowedBtcOutputScripts: string[];
  requireTeeRiskCheck: boolean;
  daoAccount: string;
}

export type FirewallViolationCode =
  | 'ERR_INVALID_RAW_TX'
  | 'ERR_CHAIN_ID_NOT_ALLOWED'
  | 'ERR_BLOCKED_ADDRESS'
  | 'ERR_UNAPPROVED_TARGET_CONTRACT'
  | 'ERR_UNAPPROVED_RECIPIENT'
  | 'ERR_NATIVE_VALUE_EXCEEDS_MAX'
  | 'ERR_DAILY_NATIVE_CAP_EXCEEDED'
  | 'ERR_UNLIMITED_APPROVAL'
  | 'ERR_APPROVAL_EXCEEDS_MAX'
  | 'ERR_SET_APPROVAL_FOR_ALL_BLOCKED'
  | 'ERR_TOKEN_TRANSFER_EXCEEDS_MAX'
  | 'ERR_DAILY_TOKEN_CAP_EXCEEDED'
  | 'ERR_UNKNOWN_SELECTOR_BLOCKED'
  | 'ERR_NESTED_MULTICALL_VIOLATION'
  | 'ERR_BTC_OUTPUT_EXCEEDS_CAP'
  | 'ERR_BTC_UNAPPROVED_OUTPUT_SCRIPT'
  | 'ERR_REPLAY_DETECTED'
  | 'ERR_TEE_UNAVAILABLE'
  | 'ERR_DAO_ESCALATION_REQUIRED';

export type FirewallOutcome = 'APPROVED_FOR_MPC_SIGN' | 'BLOCKED' | 'ESCALATE_TO_DAO';

export interface FirewallDecision {
  outcome: FirewallOutcome;
  codes: FirewallViolationCode[];
  reasons: string[];
  evaluatedAt: string;
}

export interface TeeIntentAudit {
  mode: 'near-ai-live' | 'local-verifiable-enclave';
  nonce: string;
  model: string;
  responseId: string;
  payloadDigestSha256: string;
  enclaveQuoteSha256: string;
  signatureHex: string;
  signerPublicKeyPem: string;
  signatureVerified: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'CRITICAL';
  summary: string;
  verifiedAt: string;
}

export interface MpcSignDispatchPayload {
  signerContractId: string;
  methodName: 'sign';
  args: {
    request: {
      payload: number[];
      path: string;
      key_version: number;
    };
  };
  payloadHex: string;
  firewallContractMethod: 'verify_and_sign_evm' | 'verify_and_sign_btc';
}

export interface DaoEscalationPayload {
  contractId: string;
  methodName: 'add_proposal';
  args: Record<string, unknown>;
}

export interface FirewallEvaluationRecord {
  id: string;
  createdAt: string;
  agentIntent: string;
  decoded: DecodedForeignTx;
  decision: FirewallDecision;
  teeAudit?: TeeIntentAudit;
  mpcDispatch?: MpcSignDispatchPayload;
  daoProposalPayload?: DaoEscalationPayload;
}

