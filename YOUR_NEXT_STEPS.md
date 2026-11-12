# MpcFirewall — Credentials & Manual Launch Guide

This guide covers:
1. How to configure `.env` credentials (and which keys are optional vs. required).
2. Every manual step left in your hands through final **NEAR HACKATHON** submission (deadline: **`2026-11-14T23:59:00Z`** UTC).

---

## Part 1: Setting Up Environment Credentials

### Important: Where to Put `.env`
Because the Next.js web app runs inside `apps/web/`, **Next.js loads environment variables from `apps/web/.env.local` (NOT the repository root `.env`)**.

Create `apps/web/.env.local` (already gitignored via `.gitignore`'s `.env.*` rule):

```powershell
Copy-Item .env.example apps\web\.env.local
```

If you also run standalone Node scripts directly from the repo root with env vars, load it via `node --env-file=apps/web/.env.local ...`.

---

### Which Variables You Actually Need

#### A. Zero-Config Local Demo Mode (No Paid Keys Needed)
If you leave every key blank in `apps/web/.env.local`:
- **RLP / ABI / `multicall` / EIP-2612 `permit` / Bitcoin decoding + Policy Firewall** work 100% locally.
- **TEE Audit** runs in `local-verifiable-enclave` mode (Ed25519-signed verdicts).
- **NEAR Testnet RPC (`v1.signer-prod.testnet`)** and **NEAR Intents `/v0/tokens` & dry `/v0/quote`** work without API keys.

#### B. Live NEAR AI Cloud TEE (Optional for Demo, Required if `STRICT_LIVE_TEE=true`)
1. Get an API key from NEAR AI Cloud (`https://docs.near.ai/` / `cloud-api.near.ai`).
2. Set in `apps/web/.env.local`:
   ```env
   NEARAI_API_KEY=sk-...
   NEARAI_BASE_URL=https://cloud-api.near.ai/v1/
   NEARAI_MODEL=deepseek-ai/DeepSeek-V3.1
   NEARAI_E2EE=true
   STRICT_LIVE_TEE=true
   ```
   - Leave `STRICT_LIVE_TEE=false` if you want local fallback when offline or unauthenticated.
   - Set `STRICT_LIVE_TEE=true` in production so missing/failing TEE verification blocks execution (`ERR_TEE_UNAVAILABLE`) instead of falling back.

#### C. NEAR Intents 1Click Partner JWT (Optional)
- `GET /v0/tokens` and `POST /v0/quote` work without a key (with unauthenticated fee schedule).
- If you obtain a Partner JWT from the NEAR Intents Partner Portal (`https://docs.near-intents.org/`), add:
  ```env
  NEAR_INTENTS_API_KEY=your_jwt_token
  NEAR_INTENTS_BASE_URL=https://1click.chaindefuser.com
  ```

#### D. Production Admin Protection (Recommended if Hosting Publicly)
Any hosted instance should protect `PATCH /api/policy` and `POST /api/policy` (reset) from unauthorized visitors:
1. Generate a random 32-byte admin token:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Set in `apps/web/.env.local`:
   ```env
   MPC_FIREWALL_ADMIN_TOKEN=paste_generated_hex_here
   REQUIRE_ADMIN_AUTH=true
   ```
3. When enabled, the UI displays an **Admin Token Required (`x-admin-token`)** field in the left policy panel; enter this token in the browser before toggling policy switches.

#### E. NEAR RPC & Contract IDs
Defaults point to NEAR Testnet and `v1.signer-prod.testnet`. Only change these if you deploy your own contract or switch to mainnet:
```env
NEAR_NETWORK_ID=testnet
NEAR_RPC_URL=https://rpc.testnet.near.org
MPC_SIGNER_CONTRACT_ID=v1.signer-prod.testnet
MPC_FIREWALL_CONTRACT_ID=mpc-firewall.testnet
TREZU_DAO_ACCOUNT=mpc-firewall-council.sputnik-dao.near
```

> **Note on `OUTLAYER_API_KEY` / `OUTLAYER_BASE_URL`:** These appear in `.env.example` as optional placeholders, but current runtime modules (`packages/core/src/integrations/outlayer.ts`) build `v1.signer` and SputnikDAO/Trezu `add_proposal` payloads locally without calling an external OutLayer API key.

---

## Part 2: All Steps Remaining in Your Hands

### Step 1 (Optional): Compile & Deploy the Rust NEAR Contract
The Rust contract (`contracts/mpc-firewall/src/lib.rs`) could not link on this Windows host because MSVC `link.exe` is not installed. If you want live on-chain Testnet deployment before recording:
1. Open WSL2, Linux, macOS, or install Visual Studio C++ Build Tools (`link.exe`).
2. Run inside `contracts/mpc-firewall/`:
   ```bash
   cargo test
   cargo near build non-reproducible-wasm
   ```
3. Follow `contracts/mpc-firewall/README.md` to deploy to `<your-account>.testnet` and put that account ID into `MPC_FIREWALL_CONTRACT_ID` in `apps/web/.env.local`.

### Step 2: Start the App & Verify Locally
```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm verify:judge
pnpm test:e2e
pnpm start
```
Open `http://localhost:3000` in your browser and confirm all panels load and **Probe `v1.signer-prod.testnet`** returns the live MPC root public key.

### Step 3: Record Your Demo Video (60–90s)
While running `http://localhost:3000`, record your screen showing:
1. **Scenario 1 (`Safe Base USDC`)** → `APPROVED_FOR_MPC_SIGN` + `v1.signer-prod.testnet` dispatch payload.
2. **Scenario 2 (`ERC-20 approve(MaxUint256)`)** → `BLOCKED` (`ERR_UNLIMITED_APPROVAL`) even though `v1.signer` alone only sees an opaque 32-byte hash.
3. **Scenario 3 (`Nested multicall` hidden approve)** → recursive call tree unwrapping `depth=0` -> `depth=1` and blocking (`ERR_NESTED_MULTICALL_VIOLATION`).
4. **Scenario 6 (`250 USDC`)** → `ESCALATE_TO_DAO` generating a Trezu / SputnikDAO `add_proposal` payload.
5. **Top bar Probe** → live `v1.signer-prod.testnet` MPC root key from NEAR Testnet RPC.

### Step 4: Commit & Push to a Public GitHub Repository
Must be public before **`2026-11-14T23:59:00Z`**:
1. Verify no secrets or personal files are staged:
   ```powershell
   git status
   ```
   *(Ensure `.env`, `apps/web/.env.local`, and `submission-payload.json` do NOT appear.)*
2. Configure git identity if not set globally, commit, create a **public** GitHub repo, and push:
   ```powershell
   git add .
   git commit -m "feat: MpcFirewall zero-blind-signing firewall for NEAR Chain Signatures"
   git remote add origin https://github.com/<your-username>/mpc-firewall.git
   git push -u origin main
   ```
3. Open your GitHub repo URL in an incognito window to verify judges/AI judges can read it publicly.

### Step 5: Publish Your Demo Post on X
1. Edit `X_DEMO_POST_DRAFT.md` with your real GitHub repo link.
2. Post it publicly on X with your demo video or screenshots attached (must mention built at **NEAR HACKATHON**).
3. Copy the published X post URL (`https://x.com/<handle>/status/<id>`).

### Step 6: Create Your Mainnet NEAR Payout Account (If Needed)
- You need a **mainnet** NEAR account (`team.near` or 64-char implicit account) created in any NEAR wallet (`https://docs.near.org/`).

### Step 7: Build, Validate, and Submit `submission-payload.json`
1. **Re-read live rules first:** Check `https://nearhackathon.com/HACKATHON.md` in case dates or fields changed.
2. Copy template (gitignored):
   ```powershell
   Copy-Item submission-template.json submission-payload.json
   ```
3. Generate your `requestId` **once** and save it in `submission-payload.json` (reuse this exact UUID if you ever need to retry):
   ```powershell
   node -e "console.log(crypto.randomUUID())"
   ```
4. Edit `submission-payload.json` with your real values:
   - `leadName` (2–80 chars)
   - `email` (unique across hackathon, max 160 chars)
   - `size` (`"1"`, `"2 - 4"`, `"4 - 6"`, `"6 - 8"`, or `"8+"`)
   - `tracks` (confirm final tracks: `["security", "defi", "agents", "privacy", "social"]`)
   - `nearAddress` (lowercase mainnet payout account)
   - `projectUrl` (public GitHub repo URL)
   - `demoUrl` (public X post URL)
   - `consent`: Read verbatim before setting `true`:
     > *"I agree that the organizers may use these details to review our submission and contact us about this hackathon."*
5. Validate locally against the exact `HACKATHON.md` contract:
   ```powershell
   node scripts/validate-submission.mjs submission-payload.json
   ```
6. Print and inspect the exact JSON, then submit **once** (cannot be edited afterward):
   ```powershell
   Get-Content submission-payload.json
   curl.exe -sS -X POST https://nearhackathon.com/api/applications `
     -H "Content-Type: application/json" `
     --data-binary "@submission-payload.json"
   ```
   - **`201`**: Submission saved — you're done!
   - **`503`**: Wait 60s and retry with the **exact same `requestId`**.
   - **`400`**: Fix listed fields and retry with the **exact same `requestId`**.
   - **`403` / `409`**: Do not loop-retry; inspect message.

