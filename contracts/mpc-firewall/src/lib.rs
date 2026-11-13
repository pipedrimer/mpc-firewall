use near_sdk::store::{LookupMap, LookupSet};
use near_sdk::{
    env, ext_contract, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise,
    PromiseResult,
};

const NANOS_PER_DAY: u64 = 86_400_000_000_000;
const MAX_MULTICALL_DEPTH: usize = 3;

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct SignRequest {
    pub payload: [u8; 32],
    pub path: String,
    pub key_version: u32,
}

#[ext_contract(ext_mpc_signer)]
pub trait MpcSigner {
    fn sign(&mut self, request: SignRequest) -> Promise;
}

#[ext_contract(ext_self)]
pub trait FirewallCallback {
    fn on_mpc_sign_complete(
        &mut self,
        tx_id: String,
        token_amount: u128,
        native_wei: u128,
        btc_sats: u64,
    ) -> bool;
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct OnChainPolicy {
    pub authorized_agents: Vec<AccountId>,
    pub allowed_chain_ids: Vec<u64>,
    pub allowed_targets: Vec<String>,
    pub blocked_addresses: Vec<String>,
    pub allowed_recipients: Vec<String>,
    pub max_native_wei: u128,
    pub auto_approve_native_wei: u128,
    pub max_daily_native_wei: u128,
    pub max_token_amount: u128,
    pub auto_approve_token_amount: u128,
    pub max_daily_token_amount: u128,
    pub allow_unlimited_approvals: bool,
    pub allow_set_approval_for_all: bool,
    pub allow_unknown_selectors: bool,
    pub max_btc_output_sats: u64,
    pub max_daily_btc_sats: u64,
    pub allowed_btc_scripts: Vec<String>,
    pub dao_account: AccountId,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DispatchStatus {
    DispatchedToMpc,
    PendingDaoApproval,
    DaoApprovedAndDispatched,
    MpcFailedRolledBack,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct EscalatedTx {
    pub id: String,
    pub chain_kind: String,
    pub payload_hash_hex: String,
    pub path: String,
    pub token_amount: u128,
    pub native_wei: u128,
    pub status: DispatchStatus,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct Bip143InputContext {
    pub input_index: usize,
    pub prevout_value_sats: u64,
    pub script_code_hex: String,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct InspectionSummary {
    pub chain_id: u64,
    pub to: String,
    pub value_wei: String,
    pub selector: String,
    pub nested_calls_checked: usize,
    pub payload_hash_hex: String,
    pub outcome: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MpcFirewall {
    pub owner: AccountId,
    pub mpc_signer_contract: AccountId,
    pub derivation_path: String,
    pub policy: OnChainPolicy,
    pub current_day_epoch: u64,
    pub daily_token_spent: u128,
    pub daily_native_spent: u128,
    pub daily_btc_sats_spent: u64,
    pub processed_tx_ids: LookupSet<String>,
    pub processed_payloads: LookupSet<[u8; 32]>,
    pub escalated_txs: LookupMap<String, EscalatedTx>,
}

#[near]
impl MpcFirewall {
    #[init]
    pub fn new(
        owner: AccountId,
        mpc_signer_contract: AccountId,
        derivation_path: String,
        policy: OnChainPolicy,
    ) -> Self {
        Self {
            owner,
            mpc_signer_contract,
            derivation_path,
            policy,
            current_day_epoch: env::block_timestamp() / NANOS_PER_DAY,
            daily_token_spent: 0,
            daily_native_spent: 0,
            daily_btc_sats_spent: 0,
            processed_tx_ids: LookupSet::new(b"p"),
            processed_payloads: LookupSet::new(b"d"),
            escalated_txs: LookupMap::new(b"e"),
        }
    }

    pub fn update_policy(&mut self, policy: OnChainPolicy) {
        require!(
            env::predecessor_account_id() == self.owner
                || env::predecessor_account_id() == self.policy.dao_account,
            "Only owner or configured DAO can update firewall policy"
        );
        self.policy = policy;
    }

    pub fn add_authorized_agent(&mut self, agent: AccountId) {
        require!(
            env::predecessor_account_id() == self.owner
                || env::predecessor_account_id() == self.policy.dao_account,
            "Only owner or DAO can authorize agents"
        );
        if !self.policy.authorized_agents.contains(&agent) {
            self.policy.authorized_agents.push(agent);
        }
    }

    pub fn remove_authorized_agent(&mut self, agent: AccountId) {
        require!(
            env::predecessor_account_id() == self.owner
                || env::predecessor_account_id() == self.policy.dao_account,
            "Only owner or DAO can remove agents"
        );
        self.policy.authorized_agents.retain(|a| a != &agent);
    }

    /// Zero-trust EVM entrypoint: caller passes raw unsigned EIP-1559, EIP-2930, or Legacy RLP bytes.
    /// Contract verifies authorized caller & replay nonce, decodes RLP & ABI calldata (including
    /// nested multicall and EIP-2612 permit), enforces per-tx & daily caps, computes `env::keccak256`
    /// on-chain, and attaches a rollback callback when dispatching to `v1.signer`.
    #[payable]
    pub fn verify_and_sign_evm(&mut self, raw_unsigned_tx_hex: String, tx_id: String) -> InspectionSummary {
        self.require_authorized_caller();
        self.roll_day_epoch_if_needed();
        require!(!tx_id.is_empty() && tx_id.len() <= 64, "ERR_INVALID_TX_ID");
        require!(!self.processed_tx_ids.contains(&tx_id), "ERR_REPLAY_DETECTED");

        let raw_bytes = decode_hex(&raw_unsigned_tx_hex);
        let decoded = decode_evm_unsigned_tx(&raw_bytes);

        require!(
            self.policy.allowed_chain_ids.contains(&decoded.chain_id),
            "ERR_CHAIN_ID_NOT_ALLOWED"
        );

        let to_hex = format!("0x{}", encode_hex(&decoded.to));
        self.check_target(&to_hex);
        let native_exposure_wei = decoded.value_wei.saturating_add(decoded.max_fee_wei);
        require!(
            native_exposure_wei <= self.policy.max_native_wei,
            "ERR_NATIVE_VALUE_EXCEEDS_MAX"
        );
        require!(
            self.daily_native_spent.saturating_add(native_exposure_wei) <= self.policy.max_daily_native_wei,
            "ERR_DAILY_NATIVE_CAP_EXCEEDED"
        );

        let mut token_total: u128 = 0;
        let mut nested_count: usize = 0;
        let root_selector = selector_hex(&decoded.data);
        self.enforce_calldata_recursive(&to_hex, &decoded.data, 0, &mut token_total, &mut nested_count);

        require!(
            self.daily_token_spent.saturating_add(token_total) <= self.policy.max_daily_token_amount,
            "ERR_DAILY_TOKEN_CAP_EXCEEDED"
        );

        let hash_vec = env::keccak256(&raw_bytes);
        let mut payload = [0u8; 32];
        payload.copy_from_slice(&hash_vec);
        require!(!self.processed_payloads.contains(&payload), "ERR_REPLAY_DETECTED");
        let payload_hash_hex = format!("0x{}", encode_hex(&payload));

        self.processed_tx_ids.insert(tx_id.clone());
        self.processed_payloads.insert(payload);

        let needs_dao = decoded.value_wei > self.policy.auto_approve_native_wei
            || token_total > self.policy.auto_approve_token_amount;

        if needs_dao {
            self.escalated_txs.insert(
                tx_id.clone(),
                EscalatedTx {
                    id: tx_id,
                    chain_kind: "evm".into(),
                    payload_hash_hex: payload_hash_hex.clone(),
                    path: self.derivation_path.clone(),
                    token_amount: token_total,
                    native_wei: native_exposure_wei,
                    status: DispatchStatus::PendingDaoApproval,
                },
            );
            return InspectionSummary {
                chain_id: decoded.chain_id,
                to: to_hex,
                value_wei: decoded.value_wei.to_string(),
                selector: root_selector,
                nested_calls_checked: nested_count,
                payload_hash_hex,
                outcome: "ESCALATE_TO_DAO".into(),
            };
        }

        self.daily_token_spent = self.daily_token_spent.saturating_add(token_total);
        self.daily_native_spent = self.daily_native_spent.saturating_add(native_exposure_wei);

        let _ = ext_mpc_signer::ext(self.mpc_signer_contract.clone())
            .with_attached_deposit(env::attached_deposit())
            .with_static_gas(Gas::from_tgas(250))
            .sign(SignRequest {
                payload,
                path: self.derivation_path.clone(),
                key_version: 0,
            })
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(10))
                    .on_mpc_sign_complete(tx_id, token_total, native_exposure_wei, 0),
            );

        InspectionSummary {
            chain_id: decoded.chain_id,
            to: to_hex,
            value_wei: decoded.value_wei.to_string(),
            selector: root_selector,
            nested_calls_checked: nested_count,
            payload_hash_hex,
            outcome: "APPROVED_FOR_MPC_SIGN".into(),
        }
    }

    /// Zero-trust Bitcoin entrypoint: verifies authorized caller, parses raw outputs,
    /// enforces per-tx & daily satoshi caps + allowed output scripts, then hashes
    /// double-SHA256 for v1.signer (note: SegWit mainnet broadcast requires BIP-143 sighash preimage).
    #[payable]
    pub fn verify_and_sign_btc(&mut self, raw_unsigned_btc_hex: String, tx_id: String) -> String {
        self.verify_and_sign_btc_internal(raw_unsigned_btc_hex, tx_id, None)
    }

    /// Zero-trust Bitcoin BIP-143 SegWit entrypoint: computes the exact per-input BIP-143
    /// double-SHA256 sighash preimage on-chain (`SIGHASH_ALL = 0x01`) after enforcing caps & scripts.
    #[payable]
    pub fn verify_and_sign_btc_bip143(
        &mut self,
        raw_unsigned_btc_hex: String,
        tx_id: String,
        bip143: Bip143InputContext,
    ) -> String {
        self.verify_and_sign_btc_internal(raw_unsigned_btc_hex, tx_id, Some(bip143))
    }

    fn verify_and_sign_btc_internal(
        &mut self,
        raw_unsigned_btc_hex: String,
        tx_id: String,
        bip143: Option<Bip143InputContext>,
    ) -> String {
        self.require_authorized_caller();
        self.roll_day_epoch_if_needed();
        require!(!tx_id.is_empty() && tx_id.len() <= 64, "ERR_INVALID_TX_ID");
        require!(!self.processed_tx_ids.contains(&tx_id), "ERR_REPLAY_DETECTED");

        let raw_bytes = decode_hex(&raw_unsigned_btc_hex);
        let parsed = decode_btc_tx(&raw_bytes);
        require!(!parsed.outputs.is_empty(), "ERR_INVALID_RAW_TX: no outputs");

        let mut total_sats: u64 = 0;
        for (value_sats, script) in &parsed.outputs {
            total_sats = total_sats.saturating_add(*value_sats);
            if !self.policy.allowed_btc_scripts.is_empty() {
                let script_hex = encode_hex(script);
                require!(
                    self.policy
                        .allowed_btc_scripts
                        .iter()
                        .any(|s| s.eq_ignore_ascii_case(&script_hex)),
                    "ERR_BTC_UNAPPROVED_OUTPUT_SCRIPT"
                );
            }
        }
        require!(
            total_sats <= self.policy.max_btc_output_sats,
            "ERR_BTC_OUTPUT_EXCEEDS_CAP"
        );
        require!(
            self.daily_btc_sats_spent.saturating_add(total_sats) <= self.policy.max_daily_btc_sats,
            "ERR_DAILY_BTC_CAP_EXCEEDED"
        );

        let payload = match bip143 {
            Some(ctx) => compute_bip143_sighash(&parsed, &ctx),
            None => dsha256(&raw_bytes),
        };
        require!(!self.processed_payloads.contains(&payload), "ERR_REPLAY_DETECTED");

        self.processed_tx_ids.insert(tx_id.clone());
        self.processed_payloads.insert(payload);
        self.daily_btc_sats_spent = self.daily_btc_sats_spent.saturating_add(total_sats);

        let _ = ext_mpc_signer::ext(self.mpc_signer_contract.clone())
            .with_attached_deposit(env::attached_deposit())
            .with_static_gas(Gas::from_tgas(250))
            .sign(SignRequest {
                payload,
                path: self.derivation_path.clone(),
                key_version: 0,
            })
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(10))
                    .on_mpc_sign_complete(tx_id, 0, 0, total_sats),
            );

        format!("0x{}", encode_hex(&payload))
    }

    #[payable]
    pub fn dao_approve_escalated(&mut self, tx_id: String) -> Promise {
        self.roll_day_epoch_if_needed();
        require!(
            env::predecessor_account_id() == self.policy.dao_account
                || env::predecessor_account_id() == self.owner,
            "Only DAO account or owner can approve"
        );
        let mut item = self
            .escalated_txs
            .get(&tx_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("Escalated tx not found"));
        require!(
            item.status == DispatchStatus::PendingDaoApproval,
            "Tx is not awaiting DAO approval"
        );
        require!(
            self.daily_token_spent.saturating_add(item.token_amount) <= self.policy.max_daily_token_amount,
            "ERR_DAILY_TOKEN_CAP_EXCEEDED"
        );
        require!(
            self.daily_native_spent.saturating_add(item.native_wei) <= self.policy.max_daily_native_wei,
            "ERR_DAILY_NATIVE_CAP_EXCEEDED"
        );

        let token_amt = item.token_amount;
        let native_amt = item.native_wei;
        self.daily_token_spent = self.daily_token_spent.saturating_add(token_amt);
        self.daily_native_spent = self.daily_native_spent.saturating_add(native_amt);
        item.status = DispatchStatus::DaoApprovedAndDispatched;
        self.escalated_txs.insert(tx_id.clone(), item.clone());

        let payload_bytes = decode_hex(&item.payload_hash_hex);
        let mut payload = [0u8; 32];
        payload.copy_from_slice(&payload_bytes);

        ext_mpc_signer::ext(self.mpc_signer_contract.clone())
            .with_attached_deposit(env::attached_deposit().max(NearToken::from_yoctonear(1)))
            .with_static_gas(Gas::from_tgas(250))
            .sign(SignRequest {
                payload,
                path: item.path,
                key_version: 0,
            })
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(10))
                    .on_mpc_sign_complete(tx_id, token_amt, native_amt, 0),
            )
    }

    #[private]
    pub fn on_mpc_sign_complete(
        &mut self,
        tx_id: String,
        token_amount: u128,
        native_wei: u128,
        btc_sats: u64,
    ) -> bool {
        let succeeded = matches!(env::promise_result(0), PromiseResult::Successful(_));
        if !succeeded {
            self.daily_token_spent = self.daily_token_spent.saturating_sub(token_amount);
            self.daily_native_spent = self.daily_native_spent.saturating_sub(native_wei);
            self.daily_btc_sats_spent = self.daily_btc_sats_spent.saturating_sub(btc_sats);
            if let Some(mut item) = self.escalated_txs.get(&tx_id).cloned() {
                item.status = DispatchStatus::MpcFailedRolledBack;
                self.escalated_txs.insert(tx_id, item);
            }
        }
        succeeded
    }

    pub fn get_policy(&self) -> OnChainPolicy {
        self.policy.clone()
    }

    pub fn get_escalated_tx(&self, tx_id: String) -> Option<EscalatedTx> {
        self.escalated_txs.get(&tx_id).cloned()
    }

    fn require_authorized_caller(&self) {
        let caller = env::predecessor_account_id();
        let allowed = caller == self.owner
            || caller == self.policy.dao_account
            || self.policy.authorized_agents.contains(&caller);
        require!(allowed, "ERR_UNAUTHORIZED_AGENT");
    }

    fn enforce_calldata_recursive(
        &self,
        target: &str,
        data: &[u8],
        depth: usize,
        token_total: &mut u128,
        nested_count: &mut usize,
    ) {
        require!(depth <= MAX_MULTICALL_DEPTH, "ERR_NESTED_MULTICALL_DEPTH");
        if data.is_empty() {
            return;
        }
        require!(data.len() >= 4, "ERR_INVALID_CALLDATA_LENGTH");
        *nested_count += 1;

        let sel = [data[0], data[1], data[2], data[3]];
        let args = &data[4..];

        match sel {
            // transfer(address to, uint256 amount) -> 0xa9059cbb
            [0xa9, 0x05, 0x9c, 0xbb] => {
                require!(args.len() >= 64, "Malformed ERC20 transfer calldata");
                let recipient = word_to_address_hex(&args[0..32]);
                let amount = word_to_u128_checked(&args[32..64], "ERR_TOKEN_TRANSFER_EXCEEDS_MAX");
                self.check_recipient(&recipient);
                require!(amount <= self.policy.max_token_amount, "ERR_TOKEN_TRANSFER_EXCEEDS_MAX");
                *token_total = token_total.saturating_add(amount);
            }
            // approve(address spender, uint256 amount) -> 0x095ea7b3
            // increaseAllowance(address spender, uint256 addedValue) -> 0x39509351
            [0x09, 0x5e, 0xa7, 0xb3] | [0x39, 0x50, 0x93, 0x51] => {
                require!(args.len() >= 64, "Malformed ERC20 approve calldata");
                let spender = word_to_address_hex(&args[0..32]);
                self.enforce_approval_word(&spender, &args[32..64], token_total);
            }
            // EIP-2612 permit(address owner, address spender, uint256 value, ...) -> 0xd505accf
            [0xd5, 0x05, 0xac, 0xcf] => {
                require!(args.len() >= 96, "Malformed EIP-2612 permit calldata");
                let spender = word_to_address_hex(&args[32..64]);
                self.enforce_approval_word(&spender, &args[64..96], token_total);
            }
            // transferFrom(address from, address to, uint256 amount) -> 0x23b872dd
            [0x23, 0xb8, 0x72, 0xdd] => {
                require!(args.len() >= 96, "Malformed ERC20 transferFrom calldata");
                let recipient = word_to_address_hex(&args[32..64]);
                let amount = word_to_u128_checked(&args[64..96], "ERR_TOKEN_TRANSFER_EXCEEDS_MAX");
                self.check_recipient(&recipient);
                require!(amount <= self.policy.max_token_amount, "ERR_TOKEN_TRANSFER_EXCEEDS_MAX");
                *token_total = token_total.saturating_add(amount);
            }
            // setApprovalForAll(address operator, bool approved) -> 0xa22cb465
            [0xa2, 0x2c, 0xb4, 0x65] => {
                require!(args.len() >= 64, "Malformed setApprovalForAll calldata");
                let operator = word_to_address_hex(&args[0..32]);
                let approved = args[63] != 0;
                require!(!self.is_blocked(&operator), "ERR_BLOCKED_ADDRESS: operator blocked");
                if approved {
                    require!(
                        self.policy.allow_set_approval_for_all,
                        "ERR_SET_APPROVAL_FOR_ALL_BLOCKED"
                    );
                }
            }
            // multicall(bytes[] data) -> 0xac9650d8
            [0xac, 0x96, 0x50, 0xd8] => {
                let inner_calls = decode_abi_bytes_array(args, 0);
                for inner in inner_calls {
                    self.enforce_calldata_recursive(target, &inner, depth + 1, token_total, nested_count);
                }
            }
            // multicall(uint256 deadline, bytes[] data) -> 0x5ae401dc
            [0x5a, 0xe4, 0x01, 0xdc] => {
                let inner_calls = decode_abi_bytes_array(args, 32);
                for inner in inner_calls {
                    self.enforce_calldata_recursive(target, &inner, depth + 1, token_total, nested_count);
                }
            }
            // Gnosis Safe execTransaction(address to, uint256 value, bytes data, uint8 operation, ...) -> 0x6a761202
            [0x6a, 0x76, 0x12, 0x02] => {
                require!(args.len() >= 128, "Malformed Safe execTransaction calldata");
                let safe_to = word_to_address_hex(&args[0..32]);
                let safe_val = word_to_u128_checked(&args[32..64], "ERR_NATIVE_VALUE_EXCEEDS_MAX");
                let safe_data = decode_abi_bytes_slice(args, 64);
                let safe_op = args[127];
                require!(safe_op == 0, "ERR_DELEGATECALL_BLOCKED");
                self.check_target(&safe_to);
                require!(safe_val <= self.policy.max_native_wei, "ERR_NATIVE_VALUE_EXCEEDS_MAX");
                self.enforce_calldata_recursive(&safe_to, &safe_data, depth + 1, token_total, nested_count);
            }
            // Uniswap Permit2 approve(address token, address spender, uint160 amount, uint48 expiration) -> 0x87517c45
            [0x87, 0x51, 0x7c, 0x45] => {
                require!(args.len() >= 128, "Malformed Permit2 approve calldata");
                let spender = word_to_address_hex(&args[32..64]);
                self.enforce_approval_word(&spender, &args[64..96], token_total);
            }
            // Uniswap Permit2 permit(address owner, PermitSingle, bytes sig) -> 0x2b67b570
            [0x2b, 0x67, 0xb5, 0x70] => {
                require!(args.len() >= 224, "Malformed Permit2 permit calldata");
                let spender = word_to_address_hex(&args[160..192]);
                self.enforce_approval_word(&spender, &args[64..96], token_total);
            }
            // Uniswap UniversalRouter execute(bytes commands, bytes[] inputs[, uint256 deadline]) -> 0x3593564c | 0x24856bc3
            [0x35, 0x93, 0x56, 0x4c] | [0x24, 0x85, 0x6b, 0xc3] => {
                require!(depth < MAX_MULTICALL_DEPTH, "ERR_NESTED_MULTICALL_DEPTH");
                let commands = decode_abi_bytes_slice(args, 0);
                let inputs = decode_abi_bytes_array(args, 32);
                require!(inputs.len() >= commands.len(), "Malformed UniversalRouter inputs");
                for (idx, &raw_cmd) in commands.iter().enumerate() {
                    *nested_count += 1;
                    let cmd = raw_cmd & 0x3f;
                    let inp = &inputs[idx];
                    match cmd {
                        // SWEEP (0x04) / TRANSFER (0x05): (address token, address recipient, uint256 amount)
                        0x04 | 0x05 => {
                            require!(inp.len() >= 96, "Malformed UniversalRouter transfer input");
                            let recipient = word_to_address_hex(&inp[32..64]);
                            let amount = word_to_u128_checked(&inp[64..96], "ERR_TOKEN_TRANSFER_EXCEEDS_MAX");
                            self.check_router_recipient(&recipient);
                            require!(amount <= self.policy.max_token_amount, "ERR_TOKEN_TRANSFER_EXCEEDS_MAX");
                            *token_total = token_total.saturating_add(amount);
                        }
                        // V3_SWAP_EXACT_IN (0x00) / V2_SWAP_EXACT_IN (0x08): (address recipient, uint256 amountIn, ...)
                        0x00 | 0x08 => {
                            require!(inp.len() >= 96, "Malformed UniversalRouter swap input");
                            let recipient = word_to_address_hex(&inp[0..32]);
                            let amount_in = word_to_u128_checked(&inp[32..64], "ERR_TOKEN_TRANSFER_EXCEEDS_MAX");
                            self.check_router_recipient(&recipient);
                            require!(amount_in <= self.policy.max_token_amount, "ERR_TOKEN_TRANSFER_EXCEEDS_MAX");
                            *token_total = token_total.saturating_add(amount_in);
                        }
                        // PERMIT2_PERMIT (0x0a): (PermitSingle, bytes signature)
                        0x0a => {
                            require!(inp.len() >= 192, "Malformed UniversalRouter Permit2 input");
                            let spender = word_to_address_hex(&inp[128..160]);
                            self.enforce_approval_word(&spender, &inp[32..64], token_total);
                        }
                        _ => {
                            require!(
                                self.policy.allow_unknown_selectors,
                                "ERR_UNKNOWN_SELECTOR_BLOCKED"
                            );
                        }
                    }
                }
            }
            _ => {
                require!(
                    self.policy.allow_unknown_selectors,
                    "ERR_UNKNOWN_SELECTOR_BLOCKED"
                );
            }
        }
    }

    fn enforce_approval_word(&self, spender: &str, amount_word: &[u8], token_total: &mut u128) {
        self.check_recipient(spender);
        if !self.policy.allow_unlimited_approvals {
            require!(
                amount_word[0..16].iter().all(|&b| b == 0),
                "ERR_UNLIMITED_APPROVAL"
            );
        }
        let amount = word_to_u128_checked(amount_word, "ERR_APPROVAL_EXCEEDS_MAX");
        if !self.policy.allow_unlimited_approvals {
            require!(
                amount <= self.policy.max_token_amount,
                "ERR_UNLIMITED_APPROVAL"
            );
        }
        *token_total = token_total.saturating_add(amount);
    }

    fn check_target(&self, addr: &str) {
        require!(
            !self.is_blocked(addr),
            "ERR_BLOCKED_ADDRESS: target address is blocked"
        );
        if !self.policy.allowed_targets.is_empty() {
            require!(
                self.policy.allowed_targets.iter().any(|a| a.eq_ignore_ascii_case(addr)),
                "ERR_UNAPPROVED_TARGET_CONTRACT"
            );
        }
    }

    fn check_router_recipient(&self, addr: &str) {
        let is_router_internal =
            addr.eq_ignore_ascii_case("0x0000000000000000000000000000000000000001")
                || addr.eq_ignore_ascii_case("0x0000000000000000000000000000000000000002");
        if is_router_internal {
            return;
        }
        self.check_recipient(addr);
    }

    fn check_recipient(&self, addr: &str) {
        require!(!self.is_blocked(addr), "ERR_BLOCKED_ADDRESS: recipient blocked");
        if !self.policy.allowed_recipients.is_empty() {
            require!(
                self.policy.allowed_recipients.iter().any(|a| a.eq_ignore_ascii_case(addr)),
                "ERR_UNAPPROVED_RECIPIENT"
            );
        }
    }

    fn is_blocked(&self, addr: &str) -> bool {
        self.policy.blocked_addresses.iter().any(|a| a.eq_ignore_ascii_case(addr))
    }

    fn roll_day_epoch_if_needed(&mut self) {
        let epoch = env::block_timestamp() / NANOS_PER_DAY;
        if epoch > self.current_day_epoch {
            self.current_day_epoch = epoch;
            self.daily_token_spent = 0;
            self.daily_native_spent = 0;
            self.daily_btc_sats_spent = 0;
        }
    }
}

struct ParsedEvmTx {
    chain_id: u64,
    to: [u8; 20],
    value_wei: u128,
    max_fee_wei: u128,
    data: Vec<u8>,
}

enum RlpItem<'a> {
    Bytes(&'a [u8]),
    List(Vec<RlpItem<'a>>),
}

fn decode_evm_unsigned_tx(raw: &[u8]) -> ParsedEvmTx {
    require!(!raw.is_empty(), "ERR_INVALID_RAW_TX: empty");
    if raw[0] == 0x02 {
        let (item, consumed) = parse_rlp(&raw[1..]);
        require!(consumed == raw.len() - 1, "ERR_INVALID_RAW_TX: trailing bytes");
        let fields = match item {
            RlpItem::List(l) => l,
            _ => env::panic_str("ERR_INVALID_RAW_TX: expected list"),
        };
        require!(fields.len() == 9, "ERR_INVALID_RAW_TX: eip1559 field count");
        let max_fee_per_gas = rlp_as_u128(&fields[3]);
        let gas_limit = rlp_as_u128(&fields[4]);
        ParsedEvmTx {
            chain_id: rlp_as_u64(&fields[0]),
            to: rlp_as_address20(&fields[5]),
            value_wei: rlp_as_u128(&fields[6]),
            max_fee_wei: max_fee_per_gas.saturating_mul(gas_limit),
            data: rlp_as_bytes(&fields[7]).to_vec(),
        }
    } else if raw[0] == 0x01 {
        let (item, consumed) = parse_rlp(&raw[1..]);
        require!(consumed == raw.len() - 1, "ERR_INVALID_RAW_TX: trailing bytes");
        let fields = match item {
            RlpItem::List(l) => l,
            _ => env::panic_str("ERR_INVALID_RAW_TX: expected list"),
        };
        require!(fields.len() == 8, "ERR_INVALID_RAW_TX: eip2930 field count");
        let gas_price = rlp_as_u128(&fields[2]);
        let gas_limit = rlp_as_u128(&fields[3]);
        ParsedEvmTx {
            chain_id: rlp_as_u64(&fields[0]),
            to: rlp_as_address20(&fields[4]),
            value_wei: rlp_as_u128(&fields[5]),
            max_fee_wei: gas_price.saturating_mul(gas_limit),
            data: rlp_as_bytes(&fields[6]).to_vec(),
        }
    } else if raw[0] >= 0xc0 {
        let (item, consumed) = parse_rlp(raw);
        require!(consumed == raw.len(), "ERR_INVALID_RAW_TX: trailing bytes");
        let fields = match item {
            RlpItem::List(l) => l,
            _ => env::panic_str("ERR_INVALID_RAW_TX: expected list"),
        };
        require!(
            fields.len() == 6 || fields.len() == 9,
            "ERR_INVALID_RAW_TX: legacy field count"
        );
        let chain_id = if fields.len() == 9 { rlp_as_u64(&fields[6]) } else { 1 };
        let gas_price = rlp_as_u128(&fields[1]);
        let gas_limit = rlp_as_u128(&fields[2]);
        ParsedEvmTx {
            chain_id,
            to: rlp_as_address20(&fields[3]),
            value_wei: rlp_as_u128(&fields[4]),
            max_fee_wei: gas_price.saturating_mul(gas_limit),
            data: rlp_as_bytes(&fields[5]).to_vec(),
        }
    } else {
        env::panic_str("ERR_INVALID_RAW_TX: unsupported EVM tx envelope");
    }
}

fn parse_rlp(input: &[u8]) -> (RlpItem<'_>, usize) {
    require!(!input.is_empty(), "ERR_INVALID_RAW_TX: EOF in RLP");
    let prefix = input[0];
    if prefix <= 0x7f {
        (RlpItem::Bytes(&input[0..1]), 1)
    } else if prefix <= 0xb7 {
        let len = (prefix - 0x80) as usize;
        require!(input.len() >= 1 + len, "ERR_INVALID_RAW_TX: short string OOB");
        (RlpItem::Bytes(&input[1..1 + len]), 1 + len)
    } else if prefix <= 0xbf {
        let len_of_len = (prefix - 0xb7) as usize;
        require!(input.len() >= 1 + len_of_len, "ERR_INVALID_RAW_TX: long len OOB");
        let len = read_be_usize(&input[1..1 + len_of_len]);
        let start = 1 + len_of_len;
        require!(input.len() >= start + len, "ERR_INVALID_RAW_TX: long string OOB");
        (RlpItem::Bytes(&input[start..start + len]), start + len)
    } else if prefix <= 0xf7 {
        let len = (prefix - 0xc0) as usize;
        require!(input.len() >= 1 + len, "ERR_INVALID_RAW_TX: short list OOB");
        let items = parse_rlp_list(&input[1..1 + len]);
        (RlpItem::List(items), 1 + len)
    } else {
        let len_of_len = (prefix - 0xf7) as usize;
        require!(input.len() >= 1 + len_of_len, "ERR_INVALID_RAW_TX: long list len OOB");
        let len = read_be_usize(&input[1..1 + len_of_len]);
        let start = 1 + len_of_len;
        require!(input.len() >= start + len, "ERR_INVALID_RAW_TX: long list OOB");
        let items = parse_rlp_list(&input[start..start + len]);
        (RlpItem::List(items), start + len)
    }
}

fn parse_rlp_list(mut slice: &[u8]) -> Vec<RlpItem<'_>> {
    let mut items = Vec::new();
    while !slice.is_empty() {
        let (item, consumed) = parse_rlp(slice);
        items.push(item);
        slice = &slice[consumed..];
    }
    items
}

fn read_be_usize(bytes: &[u8]) -> usize {
    require!(bytes.len() <= 4, "RLP length overflow");
    let mut acc: usize = 0;
    for &b in bytes {
        acc = (acc << 8) | (b as usize);
    }
    acc
}

fn rlp_as_bytes<'a>(item: &'a RlpItem<'a>) -> &'a [u8] {
    match item {
        RlpItem::Bytes(b) => b,
        _ => env::panic_str("ERR_INVALID_RAW_TX: expected RLP bytes"),
    }
}

fn rlp_as_u64(item: &RlpItem<'_>) -> u64 {
    let b = rlp_as_bytes(item);
    require!(b.len() <= 8, "u64 overflow");
    let mut acc: u64 = 0;
    for &byte in b {
        acc = (acc << 8) | (byte as u64);
    }
    acc
}

fn rlp_as_u128(item: &RlpItem<'_>) -> u128 {
    let b = rlp_as_bytes(item);
    require!(b.len() <= 16, "ERR_NATIVE_VALUE_EXCEEDS_MAX");
    let mut acc: u128 = 0;
    for &byte in b {
        acc = (acc << 8) | (byte as u128);
    }
    acc
}

fn rlp_as_address20(item: &RlpItem<'_>) -> [u8; 20] {
    let b = rlp_as_bytes(item);
    require!(b.len() == 20, "ERR_INVALID_RAW_TX: expected 20-byte 'to' address");
    let mut out = [0u8; 20];
    out.copy_from_slice(b);
    out
}

fn word_to_address_hex(word: &[u8]) -> String {
    format!("0x{}", encode_hex(&word[12..32]))
}

fn word_to_u128_checked(word: &[u8], err_msg: &str) -> u128 {
    require!(word[0..16].iter().all(|&b| b == 0), err_msg);
    let mut acc: u128 = 0;
    for &b in &word[16..32] {
        acc = (acc << 8) | (b as u128);
    }
    acc
}

fn decode_abi_bytes_slice(args: &[u8], offset_word_pos: usize) -> Vec<u8> {
    require!(args.len() >= offset_word_pos + 32, "Malformed bytes offset");
    let data_offset = word_to_u128_checked(&args[offset_word_pos..offset_word_pos + 32], "Offset overflow") as usize;
    require!(args.len() >= data_offset + 32, "Malformed bytes header");
    let len = word_to_u128_checked(&args[data_offset..data_offset + 32], "Length overflow") as usize;
    let start = data_offset + 32;
    require!(args.len() >= start + len, "Malformed bytes slice");
    args[start..start + len].to_vec()
}

fn decode_abi_bytes_array(args: &[u8], offset_word_pos: usize) -> Vec<Vec<u8>> {
    require!(args.len() >= offset_word_pos + 32, "Malformed multicall offset");
    let array_offset = word_to_u128_checked(&args[offset_word_pos..offset_word_pos + 32], "Offset overflow") as usize;
    require!(args.len() >= array_offset + 32, "Malformed multicall array header");
    let count = word_to_u128_checked(&args[array_offset..array_offset + 32], "Count overflow") as usize;
    require!(count <= 32, "Too many nested calls");
    let elem_base = array_offset + 32;
    let mut out = Vec::with_capacity(count);
    for i in 0..count {
        let rel_pos = elem_base + i * 32;
        require!(args.len() >= rel_pos + 32, "Malformed element offset");
        let item_rel = word_to_u128_checked(&args[rel_pos..rel_pos + 32], "Elem offset overflow") as usize;
        let item_pos = elem_base + item_rel;
        require!(args.len() >= item_pos + 32, "Malformed element length");
        let len = word_to_u128_checked(&args[item_pos..item_pos + 32], "Elem length overflow") as usize;
        let data_start = item_pos + 32;
        require!(args.len() >= data_start + len, "Malformed element bytes");
        out.push(args[data_start..data_start + len].to_vec());
    }
    out
}

struct ParsedBtcTx {
    version_le: [u8; 4],
    outpoints: Vec<[u8; 36]>,
    sequences: Vec<[u8; 4]>,
    outputs: Vec<(u64, Vec<u8>)>,
    outputs_raw: Vec<u8>,
    locktime_le: [u8; 4],
}

fn dsha256(data: &[u8]) -> [u8; 32] {
    let first = env::sha256(data);
    let second = env::sha256(&first);
    let mut out = [0u8; 32];
    out.copy_from_slice(&second);
    out
}

fn encode_varint_vec(n: usize) -> Vec<u8> {
    if n < 0xfd {
        vec![n as u8]
    } else if n <= 0xffff {
        let mut out = vec![0xfd];
        out.extend_from_slice(&(n as u16).to_le_bytes());
        out
    } else {
        let mut out = vec![0xfe];
        out.extend_from_slice(&(n as u32).to_le_bytes());
        out
    }
}

fn normalize_bip143_script_code(hex_str: &str) -> Vec<u8> {
    let raw = decode_hex(hex_str);
    if raw.len() == 20 {
        let mut out = Vec::with_capacity(25);
        out.extend_from_slice(&[0x76, 0xa9, 0x14]);
        out.extend_from_slice(&raw);
        out.extend_from_slice(&[0x88, 0xac]);
        return out;
    }
    if raw.len() == 22 && raw[0] == 0x00 && raw[1] == 0x14 {
        let mut out = Vec::with_capacity(25);
        out.extend_from_slice(&[0x76, 0xa9, 0x14]);
        out.extend_from_slice(&raw[2..22]);
        out.extend_from_slice(&[0x88, 0xac]);
        return out;
    }
    raw
}

fn compute_bip143_sighash(tx: &ParsedBtcTx, ctx: &Bip143InputContext) -> [u8; 32] {
    require!(ctx.input_index < tx.outpoints.len(), "ERR_INVALID_RAW_TX: bip143 input_index OOB");
    let mut prevouts_buf = Vec::with_capacity(tx.outpoints.len() * 36);
    for op in &tx.outpoints {
        prevouts_buf.extend_from_slice(op);
    }
    let mut seq_buf = Vec::with_capacity(tx.sequences.len() * 4);
    for seq in &tx.sequences {
        seq_buf.extend_from_slice(seq);
    }
    let hash_prevouts = dsha256(&prevouts_buf);
    let hash_sequence = dsha256(&seq_buf);
    let hash_outputs = dsha256(&tx.outputs_raw);

    let script_code = normalize_bip143_script_code(&ctx.script_code_hex);
    let script_len = encode_varint_vec(script_code.len());

    let mut preimage = Vec::with_capacity(160 + script_len.len() + script_code.len());
    preimage.extend_from_slice(&tx.version_le);
    preimage.extend_from_slice(&hash_prevouts);
    preimage.extend_from_slice(&hash_sequence);
    preimage.extend_from_slice(&tx.outpoints[ctx.input_index]);
    preimage.extend_from_slice(&script_len);
    preimage.extend_from_slice(&script_code);
    preimage.extend_from_slice(&ctx.prevout_value_sats.to_le_bytes());
    preimage.extend_from_slice(&tx.sequences[ctx.input_index]);
    preimage.extend_from_slice(&hash_outputs);
    preimage.extend_from_slice(&tx.locktime_le);
    preimage.extend_from_slice(&1u32.to_le_bytes());
    dsha256(&preimage)
}

fn decode_btc_tx(raw: &[u8]) -> ParsedBtcTx {
    require!(raw.len() >= 10, "ERR_INVALID_RAW_TX: btc too short");
    let mut version_le = [0u8; 4];
    version_le.copy_from_slice(&raw[0..4]);
    let mut pos = 4;
    let is_segwit = raw[pos] == 0x00 && raw.get(pos + 1) == Some(&0x01);
    if is_segwit {
        pos += 2;
    }
    let vin_count = read_varint(raw, &mut pos) as usize;
    require!(vin_count > 0, "ERR_INVALID_RAW_TX: btc missing inputs");
    let mut outpoints = Vec::with_capacity(vin_count);
    let mut sequences = Vec::with_capacity(vin_count);
    for _ in 0..vin_count {
        require!(pos + 36 <= raw.len(), "ERR_INVALID_RAW_TX: btc vin OOB");
        let mut op = [0u8; 36];
        op.copy_from_slice(&raw[pos..pos + 36]);
        outpoints.push(op);
        pos += 36;
        let script_len = read_varint(raw, &mut pos) as usize;
        require!(pos + script_len + 4 <= raw.len(), "ERR_INVALID_RAW_TX: btc scriptSig OOB");
        pos += script_len;
        let mut seq = [0u8; 4];
        seq.copy_from_slice(&raw[pos..pos + 4]);
        sequences.push(seq);
        pos += 4;
    }
    let vout_count = read_varint(raw, &mut pos) as usize;
    require!(vout_count > 0, "ERR_INVALID_RAW_TX: btc missing outputs");
    let outputs_start = pos;
    let mut outputs = Vec::with_capacity(vout_count);
    for _ in 0..vout_count {
        require!(pos + 8 <= raw.len(), "ERR_INVALID_RAW_TX: btc vout value OOB");
        let mut val_bytes = [0u8; 8];
        val_bytes.copy_from_slice(&raw[pos..pos + 8]);
        let value_sats = u64::from_le_bytes(val_bytes);
        pos += 8;
        let script_len = read_varint(raw, &mut pos) as usize;
        require!(pos + script_len <= raw.len(), "ERR_INVALID_RAW_TX: btc scriptPubKey OOB");
        outputs.push((value_sats, raw[pos..pos + script_len].to_vec()));
        pos += script_len;
    }
    let outputs_raw = raw[outputs_start..pos].to_vec();
    if is_segwit {
        for _ in 0..vin_count {
            let stack_items = read_varint(raw, &mut pos);
            for _ in 0..stack_items {
                let item_len = read_varint(raw, &mut pos) as usize;
                require!(pos + item_len <= raw.len(), "ERR_INVALID_RAW_TX: btc witness OOB");
                pos += item_len;
            }
        }
    }
    require!(pos + 4 == raw.len(), "ERR_INVALID_RAW_TX: btc locktime/trailing byte mismatch");
    let mut locktime_le = [0u8; 4];
    locktime_le.copy_from_slice(&raw[pos..pos + 4]);
    ParsedBtcTx {
        version_le,
        outpoints,
        sequences,
        outputs,
        outputs_raw,
        locktime_le,
    }
}

fn read_varint(raw: &[u8], pos: &mut usize) -> u64 {
    require!(*pos < raw.len(), "ERR_INVALID_RAW_TX: varint EOF");
    let first = raw[*pos];
    *pos += 1;
    if first < 0xfd {
        first as u64
    } else if first == 0xfd {
        require!(*pos + 2 <= raw.len(), "ERR_INVALID_RAW_TX: varint fd");
        let v = u16::from_le_bytes([raw[*pos], raw[*pos + 1]]) as u64;
        *pos += 2;
        v
    } else {
        env::panic_str("ERR_INVALID_RAW_TX: varint too large")
    }
}

fn selector_hex(data: &[u8]) -> String {
    if data.len() < 4 {
        "0x".into()
    } else {
        format!("0x{}", encode_hex(&data[0..4]))
    }
}

fn decode_hex(hex_str: &str) -> Vec<u8> {
    let clean = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    require!(clean.len() % 2 == 0, "Hex string must have even length");
    (0..clean.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&clean[i..i + 2], 16).unwrap_or_else(|_| env::panic_str("Invalid hex")))
        .collect()
}

fn encode_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn rlp_encode_bytes(data: &[u8]) -> Vec<u8> {
        if data.len() == 1 && data[0] < 0x80 {
            data.to_vec()
        } else if data.len() <= 55 {
            let mut out = vec![0x80 + data.len() as u8];
            out.extend_from_slice(data);
            out
        } else {
            let len_bytes = to_be_minimal(data.len() as u64);
            let mut out = vec![0xb7 + len_bytes.len() as u8];
            out.extend_from_slice(&len_bytes);
            out.extend_from_slice(data);
            out
        }
    }

    fn rlp_encode_list(items: &[Vec<u8>]) -> Vec<u8> {
        let mut payload = Vec::new();
        for item in items {
            payload.extend_from_slice(item);
        }
        if payload.len() <= 55 {
            let mut out = vec![0xc0 + payload.len() as u8];
            out.extend_from_slice(&payload);
            out
        } else {
            let len_bytes = to_be_minimal(payload.len() as u64);
            let mut out = vec![0xf7 + len_bytes.len() as u8];
            out.extend_from_slice(&len_bytes);
            out.extend_from_slice(&payload);
            out
        }
    }

    fn to_be_minimal(v: u64) -> Vec<u8> {
        if v == 0 {
            return vec![];
        }
        let b = v.to_be_bytes();
        let first_nz = b.iter().position(|&x| x != 0).unwrap_or(8);
        b[first_nz..].to_vec()
    }

    fn build_eip1559_with_gas(
        chain_id: u64,
        to_hex: &str,
        value: u128,
        max_fee_per_gas: u64,
        gas_limit: u64,
        calldata: &[u8],
    ) -> String {
        let to_bytes = decode_hex(to_hex);
        let value_bytes = {
            if value == 0 {
                vec![]
            } else {
                let b = value.to_be_bytes();
                let nz = b.iter().position(|&x| x != 0).unwrap_or(16);
                b[nz..].to_vec()
            }
        };
        let list = rlp_encode_list(&[
            rlp_encode_bytes(&to_be_minimal(chain_id)),
            rlp_encode_bytes(&to_be_minimal(1)),
            rlp_encode_bytes(&to_be_minimal(1_000_000)),
            rlp_encode_bytes(&to_be_minimal(max_fee_per_gas)),
            rlp_encode_bytes(&to_be_minimal(gas_limit)),
            rlp_encode_bytes(&to_bytes),
            rlp_encode_bytes(&value_bytes),
            rlp_encode_bytes(calldata),
            rlp_encode_list(&[]),
        ]);
        let mut out = vec![0x02];
        out.extend_from_slice(&list);
        format!("0x{}", encode_hex(&out))
    }

    fn build_eip1559_raw_hex(chain_id: u64, to_hex: &str, value: u128, calldata: &[u8]) -> String {
        build_eip1559_with_gas(chain_id, to_hex, value, 20_000_000, 100_000, calldata)
    }

    fn abi_word_address(addr_hex: &str) -> Vec<u8> {
        let b = decode_hex(addr_hex);
        let mut w = vec![0u8; 32];
        w[12..32].copy_from_slice(&b);
        w
    }

    fn abi_word_u128(v: u128) -> Vec<u8> {
        let mut w = vec![0u8; 32];
        w[16..32].copy_from_slice(&v.to_be_bytes());
        w
    }

    fn setup_firewall() -> MpcFirewall {
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id("agent.testnet".parse().unwrap())
            .attached_deposit(NearToken::from_millinear(100))
            .block_timestamp(1_000_000_000_000)
            .build());
        MpcFirewall::new(
            "owner.testnet".parse().unwrap(),
            "v1.signer-prod.testnet".parse().unwrap(),
            "ethereum,agent-treasury-1".into(),
            OnChainPolicy {
                authorized_agents: vec!["agent.testnet".parse().unwrap()],
                allowed_chain_ids: vec![8453, 84532],
                allowed_targets: vec![
                    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913".into(),
                    "0x2626664c2603336e57b271c5c0b26f421741e481".into(),
                    "0x1111111111111111111111111111111111111111".into(),
                ],
                blocked_addresses: vec!["0xdead00000000000000000000000000000000beef".into()],
                allowed_recipients: vec!["0x1111111111111111111111111111111111111111".into()],
                max_native_wei: 500_000_000_000_000_000,
                auto_approve_native_wei: 100_000_000_000_000_000,
                max_daily_native_wei: 150_000_000_000_000_000,
                max_token_amount: 500_000_000,
                auto_approve_token_amount: 100_000_000,
                max_daily_token_amount: 1_000_000_000,
                allow_unlimited_approvals: false,
                allow_set_approval_for_all: false,
                allow_unknown_selectors: false,
                max_btc_output_sats: 100_000,
                max_daily_btc_sats: 500_000,
                allowed_btc_scripts: vec!["00141111111111111111111111111111111111111111".into()],
                dao_account: "council.sputnik-dao.near".parse().unwrap(),
            },
        )
    }

    #[test]
    fn approves_compliant_eip1559_erc20_transfer() {
        let mut fw = setup_firewall();
        let mut calldata = vec![0xa9, 0x05, 0x9c, 0xbb];
        calldata.extend_from_slice(&abi_word_address("0x1111111111111111111111111111111111111111"));
        calldata.extend_from_slice(&abi_word_u128(25_000_000));

        let raw_hex = build_eip1559_raw_hex(8453, "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 0, &calldata);
        let summary = fw.verify_and_sign_evm(raw_hex, "tx-1".into());
        assert_eq!(summary.outcome, "APPROVED_FOR_MPC_SIGN");
        assert_eq!(fw.daily_token_spent, 25_000_000);
    }

    #[test]
    #[should_panic(expected = "ERR_UNAUTHORIZED_AGENT")]
    fn blocks_unauthorized_caller() {
        let mut fw = setup_firewall();
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id("attacker.testnet".parse().unwrap())
            .build());
        let raw_hex = build_eip1559_raw_hex(8453, "0x1111111111111111111111111111111111111111", 1_000, &[]);
        fw.verify_and_sign_evm(raw_hex, "tx-unauth".into());
    }

    #[test]
    #[should_panic(expected = "ERR_REPLAY_DETECTED")]
    fn blocks_tx_id_replay() {
        let mut fw = setup_firewall();
        let raw_hex = build_eip1559_raw_hex(8453, "0x1111111111111111111111111111111111111111", 10_000, &[]);
        fw.verify_and_sign_evm(raw_hex.clone(), "tx-dup".into());
        fw.verify_and_sign_evm(raw_hex, "tx-dup".into());
    }

    #[test]
    #[should_panic(expected = "ERR_DAILY_NATIVE_CAP_EXCEEDED")]
    fn enforces_daily_native_wei_cap() {
        let mut fw = setup_firewall();
        let raw_hex_1 = build_eip1559_raw_hex(8453, "0x1111111111111111111111111111111111111111", 80_000_000_000_000_000, &[]);
        let raw_hex_2 = build_eip1559_raw_hex(8453, "0x1111111111111111111111111111111111111111", 80_000_000_000_000_001, &[]);
        fw.verify_and_sign_evm(raw_hex_1, "tx-nat-1".into());
        fw.verify_and_sign_evm(raw_hex_2, "tx-nat-2".into());
    }

    #[test]
    #[should_panic(expected = "ERR_UNLIMITED_APPROVAL")]
    fn blocks_unlimited_eip2612_permit() {
        let mut fw = setup_firewall();
        let mut calldata = vec![0xd5, 0x05, 0xac, 0xcf];
        calldata.extend_from_slice(&abi_word_address("0x1111111111111111111111111111111111111111"));
        calldata.extend_from_slice(&abi_word_address("0x1111111111111111111111111111111111111111"));
        calldata.extend_from_slice(&[0xffu8; 32]); // MaxUint256 permit!

        let raw_hex = build_eip1559_raw_hex(8453, "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 0, &calldata);
        fw.verify_and_sign_evm(raw_hex, "tx-permit-evil".into());
    }

    fn build_btc_raw_hex(sats: u64, script_hex: &str) -> String {
        let mut btc = vec![1, 0, 0, 0, 1]; // version 1 + 1 input
        btc.extend_from_slice(&[0x11u8; 32]); // dummy prevout txid
        btc.extend_from_slice(&0u32.to_le_bytes()); // vout 0
        btc.push(0); // empty scriptSig
        btc.extend_from_slice(&0xffffffffu32.to_le_bytes()); // sequence
        btc.push(1); // 1 output
        btc.extend_from_slice(&sats.to_le_bytes());
        let script = decode_hex(script_hex);
        btc.push(script.len() as u8);
        btc.extend_from_slice(&script);
        btc.extend_from_slice(&[0, 0, 0, 0]); // locktime
        format!("0x{}", encode_hex(&btc))
    }

    #[test]
    #[should_panic(expected = "ERR_BTC_UNAPPROVED_OUTPUT_SCRIPT")]
    fn blocks_unapproved_bitcoin_script() {
        let mut fw = setup_firewall();
        let raw_hex = build_btc_raw_hex(20_000, "00149999999999999999999999999999999999999999");
        fw.verify_and_sign_btc(raw_hex, "btc-evil".into());
    }

    #[test]
    #[should_panic(expected = "ERR_REPLAY_DETECTED")]
    fn blocks_payload_digest_replay_even_with_new_tx_id() {
        let mut fw = setup_firewall();
        let raw_hex = build_eip1559_raw_hex(8453, "0x1111111111111111111111111111111111111111", 10_000, &[]);
        fw.verify_and_sign_evm(raw_hex.clone(), "tx-unique-1".into());
        fw.verify_and_sign_evm(raw_hex, "tx-unique-2".into());
    }

    #[test]
    #[should_panic(expected = "ERR_UNAPPROVED_RECIPIENT")]
    fn blocks_bounded_approve_to_unapproved_spender() {
        let mut fw = setup_firewall();
        let mut calldata = vec![0x09, 0x5e, 0xa7, 0xb3]; // approve(address,uint256)
        calldata.extend_from_slice(&abi_word_address("0x9999999999999999999999999999999999999999"));
        calldata.extend_from_slice(&abi_word_u128(10_000_000)); // bounded 10 USDC

        let raw_hex = build_eip1559_raw_hex(8453, "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 0, &calldata);
        fw.verify_and_sign_evm(raw_hex, "tx-approve-unapproved-spender".into());
    }

    #[test]
    #[should_panic(expected = "ERR_NATIVE_VALUE_EXCEEDS_MAX")]
    fn blocks_gas_bribe_fee_drain_exceeding_max_native_wei() {
        let mut fw = setup_firewall();
        // value = 0, but max_fee_per_gas * gas_limit = 300_000 gwei * 2_000 = 0.6 ETH > 0.5 ETH cap
        let raw_hex = build_eip1559_with_gas(
            8453,
            "0x1111111111111111111111111111111111111111",
            0,
            300_000_000_000_000,
            2_000,
            &[],
        );
        fw.verify_and_sign_evm(raw_hex, "tx-gas-bribe".into());
    }

    #[test]
    #[should_panic(expected = "ERR_UNLIMITED_APPROVAL")]
    fn blocks_increase_allowance_unlimited() {
        let mut fw = setup_firewall();
        let mut calldata = vec![0x39, 0x50, 0x93, 0x51]; // increaseAllowance(address,uint256)
        calldata.extend_from_slice(&abi_word_address("0x1111111111111111111111111111111111111111"));
        calldata.extend_from_slice(&[0xffu8; 32]);

        let raw_hex = build_eip1559_raw_hex(8453, "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 0, &calldata);
        fw.verify_and_sign_evm(raw_hex, "tx-increase-allowance-max".into());
    }

    #[test]
    #[should_panic(expected = "ERR_DAILY_BTC_CAP_EXCEEDED")]
    fn enforces_daily_bitcoin_satoshi_cap() {
        let mut fw = setup_firewall();
        let valid_script = "00141111111111111111111111111111111111111111";
        for i in 0..6u64 {
            testing_env!(VMContextBuilder::new()
                .predecessor_account_id("agent.testnet".parse().unwrap())
                .attached_deposit(NearToken::from_millinear(100))
                .block_timestamp(1_000_000_000_000 + i)
                .build());
            let raw_hex = build_btc_raw_hex(95_000 + i, valid_script);
            fw.verify_and_sign_btc(raw_hex, format!("btc-cap-{i}"));
        }
    }

    #[test]
    #[should_panic(expected = "ERR_INVALID_RAW_TX: btc locktime/trailing byte mismatch")]
    fn blocks_btc_trailing_byte_smuggling() {
        let mut fw = setup_firewall();
        let mut raw_hex = build_btc_raw_hex(20_000, "00141111111111111111111111111111111111111111");
        raw_hex.push_str("deadbeef");
        fw.verify_and_sign_btc(raw_hex, "btc-trailing".into());
    }

    #[test]
    fn computes_bip143_segwit_sighash() {
        let mut fw = setup_firewall();
        let valid_script = "00141111111111111111111111111111111111111111";
        let raw_hex = build_btc_raw_hex(40_000, valid_script);
        let raw_bytes = decode_hex(&raw_hex);
        let raw_dsha = format!("0x{}", encode_hex(&dsha256(&raw_bytes)));

        let sighash_hex = fw.verify_and_sign_btc_bip143(
            raw_hex,
            "btc-bip143-1".into(),
            Bip143InputContext {
                input_index: 0,
                prevout_value_sats: 50_000,
                script_code_hex: valid_script.into(),
            },
        );
        assert!(sighash_hex.starts_with("0x"));
        assert_eq!(sighash_hex.len(), 66);
        assert_ne!(sighash_hex, raw_dsha);
    }

    #[test]
    #[should_panic(expected = "ERR_DELEGATECALL_BLOCKED")]
    fn blocks_safe_delegatecall_execution() {
        let mut fw = setup_firewall();
        let mut calldata = vec![0x6a, 0x76, 0x12, 0x02];
        calldata.extend_from_slice(&abi_word_address("0x1111111111111111111111111111111111111111")); // to
        calldata.extend_from_slice(&abi_word_u128(0)); // value
        calldata.extend_from_slice(&abi_word_u128(10 * 32)); // data offset = 320 bytes
        calldata.extend_from_slice(&abi_word_u128(1)); // operation = 1 (DELEGATECALL)
        for _ in 0..6 {
            calldata.extend_from_slice(&abi_word_u128(0));
        }
        calldata.extend_from_slice(&abi_word_u128(0)); // data len = 0
        let raw_hex = build_eip1559_raw_hex(8453, "0x1111111111111111111111111111111111111111", 0, &calldata);
        fw.verify_and_sign_evm(raw_hex, "tx-safe-delegate".into());
    }

    #[test]
    #[should_panic(expected = "ERR_UNLIMITED_APPROVAL")]
    fn blocks_permit2_unlimited_approval() {
        let mut fw = setup_firewall();
        let mut calldata = vec![0x87, 0x51, 0x7c, 0x45]; // Permit2.approve
        calldata.extend_from_slice(&abi_word_address("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"));
        calldata.extend_from_slice(&abi_word_address("0x1111111111111111111111111111111111111111"));
        let mut u160_max = vec![0u8; 32];
        for b in &mut u160_max[12..32] {
            *b = 0xff;
        }
        calldata.extend_from_slice(&u160_max);
        calldata.extend_from_slice(&abi_word_u128(9_999_999_999));
        let raw_hex = build_eip1559_raw_hex(8453, "0x2626664c2603336e57b271c5c0b26f421741e481", 0, &calldata);
        fw.verify_and_sign_evm(raw_hex, "tx-permit2-max".into());
    }

    #[test]
    #[should_panic(expected = "ERR_BLOCKED_ADDRESS: recipient blocked")]
    fn blocks_universal_router_sweep_to_attacker() {
        let mut fw = setup_firewall();
        let mut sweep_inp = Vec::new();
        sweep_inp.extend_from_slice(&abi_word_address("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"));
        sweep_inp.extend_from_slice(&abi_word_address("0xdead00000000000000000000000000000000beef"));
        sweep_inp.extend_from_slice(&abi_word_u128(10_000_000));

        // execute(bytes commands, bytes[] inputs) -> 0x24856bc3
        let mut calldata = vec![0x24, 0x85, 0x6b, 0xc3];
        calldata.extend_from_slice(&abi_word_u128(64)); // commands offset = 64
        calldata.extend_from_slice(&abi_word_u128(128)); // inputs offset = 128
        // commands = [0x04] (SWEEP)
        calldata.extend_from_slice(&abi_word_u128(1));
        let mut cmd_word = vec![0u8; 32];
        cmd_word[0] = 0x04;
        calldata.extend_from_slice(&cmd_word);
        // inputs array len = 1, rel offset = 32, elem len = 96, sweep_inp
        calldata.extend_from_slice(&abi_word_u128(1));
        calldata.extend_from_slice(&abi_word_u128(32));
        calldata.extend_from_slice(&abi_word_u128(sweep_inp.len() as u128));
        calldata.extend_from_slice(&sweep_inp);

        let raw_hex = build_eip1559_raw_hex(8453, "0x2626664c2603336e57b271c5c0b26f421741e481", 0, &calldata);
        fw.verify_and_sign_evm(raw_hex, "tx-router-sweep".into());
    }

    #[test]
    fn approves_universal_router_swap_to_msg_sender() {
        let mut fw = setup_firewall();
        let mut swap_inp = Vec::new();
        swap_inp.extend_from_slice(&abi_word_address("0x0000000000000000000000000000000000000001")); // MSG_SENDER
        swap_inp.extend_from_slice(&abi_word_u128(20_000_000));
        swap_inp.extend_from_slice(&abi_word_u128(19_000_000));

        let mut calldata = vec![0x24, 0x85, 0x6b, 0xc3];
        calldata.extend_from_slice(&abi_word_u128(64));
        calldata.extend_from_slice(&abi_word_u128(128));
        calldata.extend_from_slice(&abi_word_u128(1));
        let mut cmd_word = vec![0u8; 32];
        cmd_word[0] = 0x00; // V3_SWAP_EXACT_IN
        calldata.extend_from_slice(&cmd_word);
        calldata.extend_from_slice(&abi_word_u128(1));
        calldata.extend_from_slice(&abi_word_u128(32));
        calldata.extend_from_slice(&abi_word_u128(swap_inp.len() as u128));
        calldata.extend_from_slice(&swap_inp);

        let raw_hex = build_eip1559_raw_hex(8453, "0x2626664c2603336e57b271c5c0b26f421741e481", 0, &calldata);
        let summary = fw.verify_and_sign_evm(raw_hex, "tx-router-swap-ok".into());
        assert_eq!(summary.outcome, "APPROVED_FOR_MPC_SIGN");
        assert_eq!(fw.daily_token_spent, 20_000_000);
    }
}
