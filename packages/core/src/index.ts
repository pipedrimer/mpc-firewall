export * from './types.js';
export { decodeUnsignedEvmTx } from './decoders/evmDecoder.js';
export { decodeUnsignedBitcoinTx, buildSampleUnsignedBtcTx } from './decoders/btcDecoder.js';
export { evaluateFirewallPolicy } from './policy/firewallEngine.js';
export { runConfidentialTeeAudit, verifyLocalTeeAuditSignature } from './integrations/nearAi.js';
export { inspectNearAccountAndSigner } from './integrations/nearRpc.js';
export { fetchIntentsTokens, previewIntentsQuote } from './integrations/nearIntents.js';
export { buildMpcDispatchPayload, buildDaoEscalationPayload } from './integrations/outlayer.js';
export {
  buildPresetScenarios,
  getDefaultFirewallPolicy,
  BASE_USDC_ADDRESS,
  BASE_ROUTER_ADDRESS,
  APPROVED_VENDOR_ADDRESS,
  ATTACKER_DRAINER_ADDRESS,
  APPROVED_BTC_P2WPKH_SCRIPT,
  ATTACKER_BTC_P2WPKH_SCRIPT
} from './presets/scenarios.js';
export { FirewallService } from './store/firewallService.js';
export { authorizeAdminRequest, extractBearerOrHeaderToken } from './security/adminAuth.js';

