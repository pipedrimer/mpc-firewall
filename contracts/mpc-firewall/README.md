# MpcFirewall NEAR Smart Contract (`contracts/mpc-firewall`)

Rust smart contract (`near-sdk = "=5.12.0"`) that owns the Chain Signatures derivation path and decodes raw unsigned EVM (`0x02` EIP-1559, `0x01` EIP-2930, Legacy RLP) and Bitcoin transactions on-chain before computing `env::keccak256` / `env::sha256` and calling `v1.signer-prod.testnet` (`v1.signer` on mainnet).

## Hardened Security Controls
- **Authorized Agent Allowlist:** Only `owner`, `dao_account`, or accounts listed in `policy.authorized_agents` can invoke signing entrypoints (`add_authorized_agent` / `remove_authorized_agent`).
- **Replay Protection:** `processed_tx_ids` (`LookupSet<String>`) rejects duplicate `tx_id` submissions (`ERR_REPLAY_DETECTED`).
- **Promise Callback Rollback:** `on_mpc_sign_complete` checks `env::promise_result(0)` and rolls back `daily_token_spent` and `daily_native_spent` if `v1.signer` fails.
- **EVM Coverage:** Enforces `allowed_chain_ids`, `max_native_wei`, `max_daily_native_wei`, `max_token_amount`, `max_daily_token_amount`, `approve`/`permit` (`0x095ea7b3` / `0xd505accf`) caps, `setApprovalForAll`, and recursive `multicall` (`0xac9650d8`, `0x5ae401dc`).
- **Bitcoin Output Guard:** Parses raw Bitcoin outputs and checks `max_btc_output_sats` + `allowed_btc_scripts`.

## Build & Test (Requires `cargo-near` / `wasm32-unknown-unknown` & host C linker)

```bash
cargo test
cargo near build non-reproducible-wasm
```

## Example Testnet Deployment & Initialization

```bash
near contract deploy <your-firewall-account>.testnet \
  use-file target/near/mpc_firewall.wasm \
  with-init-call new json-args '{
    "owner": "<owner>.testnet",
    "mpc_signer_contract": "v1.signer-prod.testnet",
    "derivation_path": "ethereum,agent-treasury-1",
    "policy": {
      "authorized_agents": ["agent.testnet"],
      "allowed_chain_ids": [8453, 84532, 42161],
      "allowed_targets": ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"],
      "blocked_addresses": [],
      "allowed_recipients": ["0x1111111111111111111111111111111111111111"],
      "max_native_wei": 500000000000000000,
      "auto_approve_native_wei": 100000000000000000,
      "max_daily_native_wei": 1000000000000000000,
      "max_token_amount": 500000000,
      "auto_approve_token_amount": 100000000,
      "max_daily_token_amount": 1000000000,
      "allow_unlimited_approvals": false,
      "allow_set_approval_for_all": false,
      "allow_unknown_selectors": false,
      "max_btc_output_sats": 100000,
      "allowed_btc_scripts": ["00141111111111111111111111111111111111111111"],
      "dao_account": "mpc-firewall-council.sputnikv2.testnet"
    }
  }' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' \
  sign-as <your-firewall-account>.testnet network-config testnet sign-with-keychain send
```
