# MpcFirewall — Judge Audit & Remediation Plan (`issue.md`)

Audit conducted against live deployment (`https://mpc-firewall.netlify.app`), NEAR Testnet/Mainnet RPCs, NEAR Intents 1Click API, `contracts/mpc-firewall/src/lib.rs`, `packages/core`, and `https://nearhackathon.com/HACKATHON.md` rules (`Q-000`–`Q-017`).

---

## Summary Tracker

| ID | Severity | Issue | Status |
| :--- | :--- | :--- | :--- |
| **ISSUE-01** | **CRITICAL** | Live Netlify app crashes with `HTTP 500 EROFS: read-only file system` on every scan & policy update | **FIXED (Verified on live Netlify)** |
| **ISSUE-02** | **CRITICAL** | NEAR Intents 1Click API always fails (`HTTP 400`) due to missing `depositType` and `deadline` | **FIXED (Verified `near-intents-live` on Netlify)** |
| **ISSUE-03** | **HIGH** | Local TEE co-audit (`nearAi.ts`) never inspects `agentIntent` for semantic mismatches | **FIXED (Verified locally & on Netlify)** |
| **ISSUE-04** | **HIGH** | Bitcoin path lacks cumulative daily satoshi cap (`max_daily_btc_sats`) & strict trailing-byte / BIP-143 scope | **FIXED (TS verified locally; Rust CI added)** |
| **ISSUE-05** | **HIGH** | Missing `LICENSE`, stale `README.md` test count (`18` vs `24`), fabricated `$142,500 Saved` UI claims, & track dilution | **FIXED (Verified locally & on Netlify)** |
| **ISSUE-06** | **CRITICAL (External Action)** | Rust contract not built to `.wasm` or deployed on NEAR Testnet (`mpc-firewall.testnet` doesn't exist) & `NEARAI_API_KEY` unset | **PARTIAL (CI added; needs user wallet deploy & Netlify env keys)** |

---

## Detailed Root Causes & Proposed Solutions

### ISSUE-01: Live Netlify Serverless Crash (`HTTP 500 EROFS: read-only file system`)
- **Observed Error:** Calling `POST https://mpc-firewall.netlify.app/api/inspect` returns `500 EROFS: read-only file system, open '.mpc-firewall-data/state.json...'` and `PATCH /api/policy` returns `400 EROFS`.
- **Root Cause:** `apps/web/src/lib/firewallRuntime.ts` resolves `.mpc-firewall-data` relative to `process.cwd()` and `apps/web/.env.local` hardcodes `MPC_FIREWALL_DATA_DIR=.mpc-firewall-data`. In Netlify/AWS Lambda, `/var/task` is read-only. Additionally, `FirewallService` assumes the filesystem directory is always writable.
- **Proposed Solution:**
  1. Remove `MPC_FIREWALL_DATA_DIR=.mpc-firewall-data` from `apps/web/.env.local` (or treat relative paths on serverless `NETLIFY`/`AWS_LAMBDA_FUNCTION_NAME` as `os.tmpdir()`).
  2. Update `apps/web/src/lib/firewallRuntime.ts` to detect serverless/read-only runtimes (`process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME`) and resolve writable storage in `path.join(os.tmpdir(), 'mpc-firewall-data')`.
  3. Update `FirewallService` (`packages/core/src/store/firewallService.ts`) to probe directory writability and gracefully fall back to `os.tmpdir()` or in-memory persistence if disk writes return `EROFS`/`EACCES` (never crash with 500).
  4. Redeploy to Netlify and verify `POST /api/inspect` and `PATCH /api/policy` return `200 OK`.

### ISSUE-02: NEAR Intents 1Click API Always Falls Back (`HTTP 400` Validation Error)
- **Observed Error:** `POST /api/intents/quote` returns `"mode": "near-intents-offline-fallback"` with error `"depositType should not be empty,depositType must be one of the following values: ORIGIN_CHAIN, INTENTS, CONFIDENTIAL_INTENTS,deadline must be a valid ISO 8601 date string"`.
- **Root Cause:** `previewIntentsQuote` (`packages/core/src/integrations/nearIntents.ts`) omitted `depositType` and `deadline`. Also, `depositType: "CONFIDENTIAL_INTENTS"` requires partner JWT (`401 Unauthorized` without `NEAR_INTENTS_API_KEY`), whereas `depositType: "INTENTS"` succeeds with `201 Created` on unauthenticated `dry: true` quotes.
- **Proposed Solution:**
  1. Include `depositType: (apiKey && confidentiality === 'advanced') ? 'CONFIDENTIAL_INTENTS' : 'INTENTS'` and a valid future ISO-8601 `deadline` (+1 hour).
  2. If `CONFIDENTIAL_INTENTS` is requested without an API key, clearly indicate `confidentiality` mode and return a live signed 1Click quote (`201`).
  3. Verify `POST https://mpc-firewall.netlify.app/api/intents/quote` returns `mode: "near-intents-live"` with a real quote signature.

### ISSUE-03: Local Enclave "AI Lie Detector" Never Reads `agentIntent`
- **Root Cause:** In `packages/core/src/integrations/nearAi.ts`, `summarizeDeterministicRisk` only checks `decision.outcome` and never examines `input.agentIntent`. A lying assistant claiming `"Send 5 ETH to Bob on Ethereum"` while submitting a valid `25 USDC` Base transfer passes local audit as `"LOW: aligns with stated agent intent"`.
- **Proposed Solution:**
  1. Add deterministic semantic intent-vs-calldata cross-checking in `nearAi.ts` fallback mode: detect contradictions in target chain (e.g., claiming Ethereum/Arbitrum/Bitcoin while tx is Base `8453`), action type (claiming transfer while calldata is `approve` or `setApprovalForAll`), and numeric token/ETH amounts mentioned in `agentIntent` vs decoded value (>5x divergence).
  2. Escalate mismatched intent to `riskLevel: 'CRITICAL'` so `FirewallService` blocks it with `ERR_TEE_CRITICAL_RISK`.
  3. Label fallback honestly as `local-verifiable-enclave` (and show exact mode in UI instead of claiming Intel TDX live TEE when unconfigured).
  4. Add unit test proving a spoofed `agentIntent` on a valid transfer gets caught with `ERR_TEE_CRITICAL_RISK`.

### ISSUE-04: Bitcoin Daily Satoshi Cap & Parser Hardening
- **Root Cause:** `verify_and_sign_btc` in `contracts/mpc-firewall/src/lib.rs` passes `(0, 0)` to `on_mpc_sign_complete` and tracks no daily satoshi spend (`daily_btc_sats_spent`), allowing repeated drains below the per-tx cap. `btcDecoder.ts` & `decode_btc_outputs` also skip locktime/trailing-byte checks and don't document BIP-143 sighash scope.
- **Proposed Solution:**
  1. Add `maxDailyBtcSats` / `max_daily_btc_sats` (default `500_000` sats) and `dailyBtcSatsSpent` / `daily_btc_sats_spent` tracking + rollback on MPC failure in both `contracts/mpc-firewall/src/lib.rs` and TypeScript (`types.ts`, `firewallEngine.ts`, `firewallService.ts`, `scenarios.ts`).
  2. Enforce `nLockTime` (4 bytes) / trailing-byte EOF sanity in `decodeUnsignedBitcoinTx` (allowing witness bytes cleanly when SegWit flag `0x0001` is present, rejecting truncated locktime).
  3. Document BIP-143 SegWit / Legacy preimage signing scope accurately in `contracts/mpc-firewall/src/lib.rs` and `README.md`.
  4. Add unit test enforcing cumulative daily Bitcoin cap in `packages/core/tests/hardening.test.ts` and `contracts/mpc-firewall/src/lib.rs`.

### ISSUE-05: Hackathon Submission Compliance & Credibility Cleanup (`HACKATHON.md`)
- **Root Causes:**
  - Missing root `LICENSE` file (`Q-014` explicitly asks for a license file).
  - UI displays fabricated `"$142,500 Saved"` / `"$142,500 treasury drained"` numbers (`VisualStoryView.tsx`, `InteractiveXRayStage.tsx`).
  - `README.md` cites `"18 tests"` when `pnpm test` runs `21+` tests, and lacks `Q-005` baseline/AI disclosure and honest deployment status.
  - `submission-template.json` lists 5 tracks including `defi` and `social` where integrations are secondary previews rather than primary products; tightening to primary tracks (`security`, `agents`, `privacy`) prevents track dilution.
- **Proposed Solution:**
  1. Add MIT `LICENSE`.
  2. Replace fabricated `"$142,500"` claims with exact policy metrics (`"Unlimited Drain Blocked"`, `"Full Vault Protected"`).
  3. Update `README.md` with accurate test count, live Netlify URL (`https://mpc-firewall.netlify.app`), `Q-005` library/AI disclosure, and exact contract/partner status.
  4. Update `submission-template.json` tracks (`["security", "agents", "privacy"]`) while keeping `defi`/`social` optional notes for user confirmation.

### ISSUE-06: Rust WASM Verification CI, Testnet Deployment & Live `NEARAI_API_KEY`
- **Root Cause:** Local Windows lacks MSVC `link.exe`, WSL1, and Docker, so `cargo test` and WASM compilation couldn't run locally, and `mpc-firewall.testnet` + `NEARAI_API_KEY` require the user's NEAR wallet & NEAR AI Cloud account.
- **Proposed Solution:**
  1. Add `.github/workflows/ci.yml` running `pnpm typecheck`, `pnpm test`, `pnpm build`, `cargo test`, and `cargo build --target wasm32-unknown-unknown --release` on Ubuntu so judges see verified green Rust + TS builds and a downloadable `.wasm` artifact.
  2. Provide exact copy-paste steps for the user to deploy the `.wasm` artifact to NEAR Testnet (`near-cli-rs` or NEAR Playground / GitHub artifact) and add `NEARAI_API_KEY` (from `nearbuilders.org/dashboard` $10 free credits) in Netlify Environment Variables.

