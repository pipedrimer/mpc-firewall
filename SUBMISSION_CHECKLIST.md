# NEAR HACKATHON — Submission Checklist & Playbook

> **IMPORTANT:** Re-read `https://nearhackathon.com/HACKATHON.md` before submitting. Development ends **`2026-11-14T23:59:00Z`** (UTC). One submission per team; submissions cannot be edited once sent.

---

## Step 1: Verify Build & Judge Flow Locally
```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm verify:judge
```

## Step 2: Publish Public GitHub Repository (Before `2026-11-14T23:59:00Z`)
1. Check `git status` to ensure `.env` and `submission-payload.json` are ignored and absent.
2. Push to a **public** GitHub repository (`git remote add origin ... && git push -u origin main`).
3. Verify the repository opens in a logged-out / incognito browser tab.

## Step 3: Record Demo & Publish Post on X
1. Run `pnpm dev` and open `http://localhost:3000`.
2. Record a 60–90s video showing:
   - Scenario 1 (`Safe Base USDC`) → `APPROVED_FOR_MPC_SIGN` + `v1.signer-prod.testnet` payload generated.
   - Scenario 2 (`ERC-20 approve(MaxUint256)`) and Scenario 3 (`Nested multicall` hidden approve) → `BLOCKED` with exact violation codes (`ERR_UNLIMITED_APPROVAL`, `ERR_NESTED_MULTICALL_VIOLATION`).
   - Scenario 6 (`250 USDC`) → `ESCALATE_TO_DAO` generating a Trezu / SputnikDAO `add_proposal` payload.
   - Probing live `v1.signer-prod.testnet` MPC root public key via NEAR Testnet RPC.
3. Publish the public X post using `X_DEMO_POST_DRAFT.md` with the demo video/screenshots attached, and copy the post URL.

## Step 4: Fill & Validate `submission-payload.json`
1. Copy `submission-template.json` to `submission-payload.json` (gitignored).
2. Generate `requestId` **once** and reuse it across any retries:
   ```bash
   node -e "console.log(crypto.randomUUID())"
   ```
3. Fill in your real `leadName`, `email`, `size`, `nearAddress`, `projectUrl`, and `demoUrl`.
4. Read the contact notice verbatim:
   > *"I agree that the organizers may use these details to review our submission and contact us about this hackathon."*
   If you agree, set `"consent": true`.
5. Validate locally:
   ```bash
   node scripts/validate-submission.mjs submission-payload.json
   ```

## Step 5: Submit Once After Reviewing Exact JSON
Print `submission-payload.json` to verify every character, then send:
```bash
curl -sS -X POST https://nearhackathon.com/api/applications \
  -H "Content-Type: application/json" \
  --data-binary @submission-payload.json
```
Expect HTTP `201`. Reuse the exact same `requestId` on `503` or `400` retries; do not retry `403` or `409`.

