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
    pub processed_tx_ids: LookupSet<String>,
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
            processed_tx_ids: LookupSet::new(b"p"),
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
        require!(
            !self.is_blocked(&to_hex),
            "ERR_BLOCKED_ADDRESS: target address is blocked"
        );
        if !self.policy.allowed_targets.is_empty() {
            require!(
                self.policy.allowed_targets.iter().any(|a| a.eq_ignore_ascii_case(&to_hex)),
                "ERR_UNAPPROVED_TARGET_CONTRACT"
            );
        }
        require!(
            decoded.value_wei <= self.policy.max_native_wei,
            "ERR_NATIVE_VALUE_EXCEEDS_MAX"
        );
        require!(
            self.daily_native_spent.saturating_add(decoded.value_wei) <= self.policy.max_daily_native_wei,
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
        let payload_hash_hex = format!("0x{}", encode_hex(&payload));

        self.processed_tx_ids.insert(tx_id.clone());

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
                    native_wei: decoded.value_wei,
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
        self.daily_native_spent = self.daily_native_spent.saturating_add(decoded.value_wei);

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
                    .on_mpc_sign_complete(tx_id, token_total, decoded.value_wei),
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
    /// enforces satoshi cap & allowed output scripts, then hashes double-SHA256 for v1.signer.
    #[payable]
    pub fn verify_and_sign_btc(&mut self, raw_unsigned_btc_hex: String, tx_id: String) -> String {
        self.require_authorized_caller();
        require!(!tx_id.is_empty() && tx_id.len() <= 64, "ERR_INVALID_TX_ID");
        require!(!self.processed_tx_ids.contains(&tx_id), "ERR_REPLAY_DETECTED");

        let raw_bytes = decode_hex(&raw_unsigned_btc_hex);
        let outputs = decode_btc_outputs(&raw_bytes);
        require!(!outputs.is_empty(), "ERR_INVALID_RAW_TX: no outputs");

        let mut total_sats: u64 = 0;
        for (value_sats, script) in outputs {
            total_sats = total_sats.saturating_add(value_sats);
            if !self.policy.allowed_btc_scripts.is_empty() {
                let script_hex = encode_hex(&script);
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

        self.processed_tx_ids.insert(tx_id.clone());

        let first_hash = env::sha256(&raw_bytes);
        let double_hash = env::sha256(&first_hash);
        let mut payload = [0u8; 32];
        payload.copy_from_slice(&double_hash);

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
                    .on_mpc_sign_complete(tx_id, 0, 0),
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
                    .on_mpc_sign_complete(tx_id, token_amt, native_amt),
            )
    }

    #[private]
    pub fn on_mpc_sign_complete(
        &mut self,
        tx_id: String,
        token_amount: u128,
        native_wei: u128,
    ) -> bool {
        let succeeded = matches!(env::promise_result(0), PromiseResult::Successful(_));
        if !succeeded {
            self.daily_token_spent = self.daily_token_spent.saturating_sub(token_amount);
            self.daily_native_spent = self.daily_native_spent.saturating_sub(native_wei);
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
            [0x09, 0x5e, 0xa7, 0xb3] => {
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
            _ => {
                require!(
                    self.policy.allow_unknown_selectors,
                    "ERR_UNKNOWN_SELECTOR_BLOCKED"
                );
            }
        }
    }

    fn enforce_approval_word(&self, spender: &str, amount_word: &[u8], token_total: &mut u128) {
        require!(!self.is_blocked(spender), "ERR_BLOCKED_ADDRESS: spender blocked");
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
        }
    }
}

struct ParsedEvmTx {
    chain_id: u64,
    to: [u8; 20],
    value_wei: u128,
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
        require!(fields.len() >= 9, "ERR_INVALID_RAW_TX: eip1559 field count");
        ParsedEvmTx {
            chain_id: rlp_as_u64(&fields[0]),
            to: rlp_as_address20(&fields[5]),
            value_wei: rlp_as_u128(&fields[6]),
            data: rlp_as_bytes(&fields[7]).to_vec(),
        }
    } else if raw[0] == 0x01 {
        let (item, consumed) = parse_rlp(&raw[1..]);
        require!(consumed == raw.len() - 1, "ERR_INVALID_RAW_TX: trailing bytes");
        let fields = match item {
            RlpItem::List(l) => l,
            _ => env::panic_str("ERR_INVALID_RAW_TX: expected list"),
        };
        require!(fields.len() >= 8, "ERR_INVALID_RAW_TX: eip2930 field count");
        ParsedEvmTx {
            chain_id: rlp_as_u64(&fields[0]),
            to: rlp_as_address20(&fields[4]),
            value_wei: rlp_as_u128(&fields[5]),
            data: rlp_as_bytes(&fields[6]).to_vec(),
        }
    } else if raw[0] >= 0xc0 {
        let (item, consumed) = parse_rlp(raw);
        require!(consumed == raw.len(), "ERR_INVALID_RAW_TX: trailing bytes");
        let fields = match item {
            RlpItem::List(l) => l,
            _ => env::panic_str("ERR_INVALID_RAW_TX: expected list"),
        };
        require!(fields.len() >= 6, "ERR_INVALID_RAW_TX: legacy field count");
        let chain_id = if fields.len() >= 9 { rlp_as_u64(&fields[6]) } else { 1 };
        ParsedEvmTx {
            chain_id,
            to: rlp_as_address20(&fields[3]),
            value_wei: rlp_as_u128(&fields[4]),
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

fn decode_btc_outputs(raw: &[u8]) -> Vec<(u64, Vec<u8>)> {
    require!(raw.len() >= 10, "ERR_INVALID_RAW_TX: btc too short");
    let mut pos = 4;
    if raw[pos] == 0x00 && raw.get(pos + 1) == Some(&0x01) {
        pos += 2;
    }
    let vin_count = read_varint(raw, &mut pos);
    for _ in 0..vin_count {
        pos += 36;
        require!(pos <= raw.len(), "ERR_INVALID_RAW_TX: btc vin OOB");
        let script_len = read_varint(raw, &mut pos) as usize;
        pos += script_len + 4;
        require!(pos <= raw.len(), "ERR_INVALID_RAW_TX: btc scriptSig OOB");
    }
    let vout_count = read_varint(raw, &mut pos);
    let mut outputs = Vec::with_capacity(vout_count as usize);
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
    outputs
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

    fn build_eip1559_raw_hex(chain_id: u64, to_hex: &str, value: u128, calldata: &[u8]) -> String {
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
            rlp_encode_bytes(&to_be_minimal(20_000_000)),
            rlp_encode_bytes(&to_be_minimal(100_000)),
            rlp_encode_bytes(&to_bytes),
            rlp_encode_bytes(&value_bytes),
            rlp_encode_bytes(calldata),
            rlp_encode_list(&[]),
        ]);
        let mut out = vec![0x02];
        out.extend_from_slice(&list);
        format!("0x{}", encode_hex(&out))
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
        let raw_hex = build_eip1559_raw_hex(8453, "0x1111111111111111111111111111111111111111", 80_000_000_000_000_000, &[]);
        fw.verify_and_sign_evm(raw_hex.clone(), "tx-nat-1".into());
        fw.verify_and_sign_evm(raw_hex, "tx-nat-2".into());
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

    #[test]
    #[should_panic(expected = "ERR_BTC_UNAPPROVED_OUTPUT_SCRIPT")]
    fn blocks_unapproved_bitcoin_script() {
        let mut fw = setup_firewall();
        let mut btc = vec![1, 0, 0, 0, 0, 1];
        btc.extend_from_slice(&20_000u64.to_le_bytes());
        btc.push(22);
        btc.extend_from_slice(&decode_hex("00149999999999999999999999999999999999999999"));
        btc.extend_from_slice(&[0, 0, 0, 0]);
        fw.verify_and_sign_btc(format!("0x{}", encode_hex(&btc)), "btc-evil".into());
    }
}
