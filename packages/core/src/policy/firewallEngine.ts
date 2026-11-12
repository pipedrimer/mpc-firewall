import type {
  DecodedBitcoinTx,
  DecodedEvmTx,
  DecodedForeignTx,
  EvmDecodedCall,
  FirewallDecision,
  FirewallPolicy,
  FirewallViolationCode
} from '../types.js';

const UINT128_MAX = (1n << 128n) - 1n;

function normalizeLowerSet(items: string[]): Set<string> {
  return new Set(items.map((x) => x.trim().toLowerCase()).filter(Boolean));
}

function addViolation(
  codes: FirewallViolationCode[],
  reasons: string[],
  code: FirewallViolationCode,
  reason: string
) {
  if (!codes.includes(code)) codes.push(code);
  reasons.push(reason);
}

function evaluateEvmCallTree(
  call: EvmDecodedCall,
  policy: FirewallPolicy,
  blocked: Set<string>,
  allowedRecipients: Set<string>,
  maxTokenAmount: bigint,
  codes: FirewallViolationCode[],
  reasons: string[]
): bigint {
  let tokenOutflow = 0n;

  if (call.action === 'ERC20_APPROVE' || call.action === 'ERC20_PERMIT') {
    const spender = call.spenderOrOperator ?? '';
    const amount = BigInt(call.tokenAmount ?? '0');
    const verb = call.action === 'ERC20_PERMIT' ? 'EIP-2612 permit' : 'ERC-20 approve';
    if (blocked.has(spender)) {
      addViolation(codes, reasons, 'ERR_BLOCKED_ADDRESS', `Spender ${spender} is on blocked list.`);
    }
    if (!policy.allowUnlimitedApprovals && (amount > maxTokenAmount || amount >= UINT128_MAX)) {
      addViolation(
        codes,
        reasons,
        'ERR_UNLIMITED_APPROVAL',
        `${verb}(${amount.toString()}) exceeds allowed cap (${maxTokenAmount.toString()}) or is unlimited.`
      );
      if (call.depth > 0) {
        addViolation(
          codes,
          reasons,
          'ERR_NESTED_MULTICALL_VIOLATION',
          `Detected smuggled ${verb} at multicall depth ${call.depth}.`
        );
      }
    }
    tokenOutflow += amount;
  } else if (call.action === 'ERC20_TRANSFER' || call.action === 'ERC20_TRANSFER_FROM') {
    const recipient = call.recipient ?? '';
    const amount = BigInt(call.tokenAmount ?? '0');
    if (blocked.has(recipient)) {
      addViolation(codes, reasons, 'ERR_BLOCKED_ADDRESS', `Recipient ${recipient} is on blocked list.`);
    }
    if (allowedRecipients.size > 0 && !allowedRecipients.has(recipient)) {
      addViolation(
        codes,
        reasons,
        'ERR_UNAPPROVED_RECIPIENT',
        `Recipient ${recipient} is not in policy allowedRecipients.`
      );
    }
    if (amount > maxTokenAmount) {
      addViolation(
        codes,
        reasons,
        'ERR_TOKEN_TRANSFER_EXCEEDS_MAX',
        `Token transfer ${amount.toString()} exceeds maxTokenAmountUnits (${maxTokenAmount.toString()}).`
      );
    }
    if (call.depth > 0 && (blocked.has(recipient) || amount > maxTokenAmount)) {
      addViolation(
        codes,
        reasons,
        'ERR_NESTED_MULTICALL_VIOLATION',
        `Detected policy violation inside multicall depth ${call.depth}.`
      );
    }
    tokenOutflow += amount;
  } else if (call.action === 'NFT_SET_APPROVAL_FOR_ALL') {
    const operator = call.spenderOrOperator ?? '';
    if (blocked.has(operator)) {
      addViolation(codes, reasons, 'ERR_BLOCKED_ADDRESS', `Operator ${operator} is blocked.`);
    }
    if (call.approvedBool && !policy.allowSetApprovalForAll) {
      addViolation(
        codes,
        reasons,
        'ERR_SET_APPROVAL_FOR_ALL_BLOCKED',
        `Blanket NFT setApprovalForAll(${operator}, true) is forbidden by policy.`
      );
      if (call.depth > 0) {
        addViolation(
          codes,
          reasons,
          'ERR_NESTED_MULTICALL_VIOLATION',
          `Detected smuggled setApprovalForAll at multicall depth ${call.depth}.`
        );
      }
    }
  } else if (call.action === 'UNKNOWN_CONTRACT_CALL') {
    if (!policy.allowUnknownSelectors) {
      addViolation(
        codes,
        reasons,
        'ERR_UNKNOWN_SELECTOR_BLOCKED',
        `Selector ${call.selector} is blocked under strict ABI decoding policy.`
      );
      if (call.depth > 0) {
        addViolation(
          codes,
          reasons,
          'ERR_NESTED_MULTICALL_VIOLATION',
          `Unknown selector ${call.selector} inside multicall depth ${call.depth}.`
        );
      }
    }
  } else if (call.action === 'MULTICALL') {
    for (const child of call.nestedCalls) {
      tokenOutflow += evaluateEvmCallTree(
        child,
        policy,
        blocked,
        allowedRecipients,
        maxTokenAmount,
        codes,
        reasons
      );
    }
  }

  return tokenOutflow;
}

function evaluateEvm(
  tx: DecodedEvmTx,
  policy: FirewallPolicy,
  dailyTokenSpentUnits: string,
  dailyNativeSpentWei: string
): FirewallDecision {
  const codes: FirewallViolationCode[] = [];
  const reasons: string[] = [];

  const blocked = normalizeLowerSet(policy.blockedAddresses);
  const allowedTargets = normalizeLowerSet(policy.allowedTargetContracts);
  const allowedRecipients = normalizeLowerSet(policy.allowedRecipients);

  if (!policy.allowedChainIds.includes(tx.chainId)) {
    addViolation(
      codes,
      reasons,
      'ERR_CHAIN_ID_NOT_ALLOWED',
      `Chain ID ${tx.chainId} is not in allowedChainIds [${policy.allowedChainIds.join(', ')}].`
    );
  }

  if (blocked.has(tx.to)) {
    addViolation(codes, reasons, 'ERR_BLOCKED_ADDRESS', `Target ${tx.to} is blocked.`);
  }

  if (allowedTargets.size > 0 && !allowedTargets.has(tx.to)) {
    addViolation(
      codes,
      reasons,
      'ERR_UNAPPROVED_TARGET_CONTRACT',
      `Target ${tx.to} is not in allowedTargetContracts.`
    );
  }

  const valueWei = BigInt(tx.valueWei);
  const maxNativeWei = BigInt(policy.maxNativeValueWei);
  const autoNativeWei = BigInt(policy.autoApproveNativeValueWei);
  const maxDailyNativeWei = BigInt(policy.maxDailyNativeWei || policy.maxNativeValueWei);
  if (valueWei > maxNativeWei) {
    addViolation(
      codes,
      reasons,
      'ERR_NATIVE_VALUE_EXCEEDS_MAX',
      `Native value ${valueWei.toString()} wei exceeds maxNativeValueWei (${maxNativeWei.toString()}).`
    );
  }
  if (BigInt(dailyNativeSpentWei) + valueWei > maxDailyNativeWei) {
    addViolation(
      codes,
      reasons,
      'ERR_DAILY_NATIVE_CAP_EXCEEDED',
      `Daily native spend (${(BigInt(dailyNativeSpentWei) + valueWei).toString()} wei) exceeds maxDailyNativeWei (${maxDailyNativeWei.toString()}).`
    );
  }

  if (tx.rootCall.action === 'NATIVE_TRANSFER') {
    if (allowedRecipients.size > 0 && !allowedRecipients.has(tx.to)) {
      addViolation(
        codes,
        reasons,
        'ERR_UNAPPROVED_RECIPIENT',
        `Native transfer destination ${tx.to} is not in allowedRecipients.`
      );
    }
  }

  const maxTokenAmount = BigInt(policy.maxTokenAmountUnits);
  const autoTokenAmount = BigInt(policy.autoApproveTokenUnits);
  const maxDailyToken = BigInt(policy.maxDailyTokenUnits);
  const totalToken = evaluateEvmCallTree(
    tx.rootCall,
    policy,
    blocked,
    allowedRecipients,
    maxTokenAmount,
    codes,
    reasons
  );

  if (BigInt(dailyTokenSpentUnits) + totalToken > maxDailyToken) {
    addViolation(
      codes,
      reasons,
      'ERR_DAILY_TOKEN_CAP_EXCEEDED',
      `Daily spend (${BigInt(dailyTokenSpentUnits) + totalToken}) exceeds maxDailyTokenUnits (${maxDailyToken}).`
    );
  }

  if (codes.length > 0) {
    return {
      outcome: 'BLOCKED',
      codes,
      reasons,
      evaluatedAt: new Date().toISOString()
    };
  }

  if (valueWei > autoNativeWei || totalToken > autoTokenAmount) {
    return {
      outcome: 'ESCALATE_TO_DAO',
      codes: ['ERR_DAO_ESCALATION_REQUIRED'],
      reasons: [
        `Transaction passes safety checks but exceeds autonomous cap; escalating to ${policy.daoAccount}.`
      ],
      evaluatedAt: new Date().toISOString()
    };
  }

  return {
    outcome: 'APPROVED_FOR_MPC_SIGN',
    codes: [],
    reasons: ['Decoded EVM RLP & ABI calldata satisfy all Chain Signatures firewall constraints.'],
    evaluatedAt: new Date().toISOString()
  };
}

function evaluateBitcoin(tx: DecodedBitcoinTx, policy: FirewallPolicy): FirewallDecision {
  const codes: FirewallViolationCode[] = [];
  const reasons: string[] = [];

  const maxSats = BigInt(policy.maxBtcOutputSats);
  const allowedScripts = normalizeLowerSet(policy.allowedBtcOutputScripts);
  const totalSats = BigInt(tx.totalOutputSats);

  if (totalSats > maxSats) {
    addViolation(
      codes,
      reasons,
      'ERR_BTC_OUTPUT_EXCEEDS_CAP',
      `Total Bitcoin output (${totalSats.toString()} sats) exceeds maxBtcOutputSats (${maxSats.toString()}).`
    );
  }

  if (allowedScripts.size > 0) {
    for (const out of tx.outputs) {
      if (!allowedScripts.has(out.scriptPubKeyHex.toLowerCase())) {
        addViolation(
          codes,
          reasons,
          'ERR_BTC_UNAPPROVED_OUTPUT_SCRIPT',
          `Bitcoin output #${out.index} scriptPubKey ${out.scriptPubKeyHex} is not allowlisted.`
        );
      }
    }
  }

  return {
    outcome: codes.length > 0 ? 'BLOCKED' : 'APPROVED_FOR_MPC_SIGN',
    codes,
    reasons:
      codes.length > 0
        ? reasons
        : ['Decoded Bitcoin outputs satisfy satoshi cap and scriptPubKey allowlist.'],
    evaluatedAt: new Date().toISOString()
  };
}

export function evaluateFirewallPolicy(
  decoded: DecodedForeignTx,
  policy: FirewallPolicy,
  dailyTokenSpentUnits = '0',
  dailyNativeSpentWei = '0'
): FirewallDecision {
  if (decoded.kind === 'evm') {
    return evaluateEvm(decoded, policy, dailyTokenSpentUnits, dailyNativeSpentWei);
  }
  return evaluateBitcoin(decoded, policy);
}

