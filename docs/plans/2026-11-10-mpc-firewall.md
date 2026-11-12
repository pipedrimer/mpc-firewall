# MpcFirewall Implementation Plan

> **Problem Unsolved on NEAR:** Existing NEAR agent-security projects (`pursestrings`, `countersign`, `near-leash`) inspect NEAR-native calls via Function Call Keys. When an agent or DAO uses **NEAR Chain Signatures (`v1.signer`)** to sign foreign-chain transactions (Ethereum, Base, Arbitrum, Bitcoin), `v1.signer` only sees an opaque **32-byte payload hash** (`blind signing`). Function Call Keys cannot detect an EVM `ERC20.approve(drainer, MAX_UINT256)` or nested `multicall` hidden inside a 32-byte digest.

**Goal:** Build **MpcFirewall**, an on-chain NEAR smart contract + TEE co-auditor + interactive developer console that owns the MPC derivation path, decodes raw unsigned EVM (EIP-1559 / Legacy) RLP bytes, ABI calldata (including nested `multicall`), and raw Bitcoin outputs **inside NEAR Wasm** before computing `keccak256` / `sha256d` and invoking `v1.signer` (`v1.signer-prod.testnet`).

**Architecture:**
- `contracts/mpc-firewall`: Pure-Rust NEAR smart contract (`near-sdk`) implementing zero-trust on-chain RLP decoding, EVM ABI selector/argument parsing, nested `multicall` unwrapping, Bitcoin output parsing, per-tx/daily spend & chain-ID caps, Trezu/SputnikDAO escalation state, and `env::keccak256` -> `v1.signer` dispatch.
- `packages/core`: TypeScript library (`ethers` v6, `@nearai/inference-sdk`, `zod`) providing byte-identical RLP/ABI/BTC decoders & policy evaluation, real EVM transaction builders for adversarial tests, NEAR AI Cloud TEE intent-vs-calldata risk audit, NEAR Intents 1Click safe-route checks, OutLayer policy attestation, and NEAR Testnet RPC `v1.signer-prod.testnet` state verification.
- `apps/web`: Next.js App Router Security Console featuring a 3-stage interactive workbench (Policy & Chain Caps, Raw Unsigned Tx & 6 Adversarial Attack Simulators, Byte-Level RLP/ABI Proof & `v1.signer` Dispatch Inspector).
- `scripts/judge-demo.mjs` & `scripts/validate-submission.mjs`: Deterministic `Do X -> See Y` verification runner and `HACKATHON.md` payload validator.

