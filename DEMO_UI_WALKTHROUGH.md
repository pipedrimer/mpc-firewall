# MpcFirewall Live Demo Walkthrough & Word-for-Word Script
**App URL:** `http://localhost:3000` *(Run `pnpm dev` or `pnpm start`)*  
**Production Site (Netlify):** `https://mpc-firewall.netlify.app`  
**GitHub Repository:** `https://github.com/pipedrimer/mpc-firewall`

---

## 1. Quick Orientation: What You See on Screen

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Shield] MpcFirewall  [v1.signer-prod.testnet]   [Studio | Inspector]   [Verify Key] [Reset] │
├───────────────────────────────────────────────────────┬────────────────────────────────┤
│ HERO COLUMN (Left)                                    │ 3D X-RAY STAGE (Right)         │
│ • "01 / ZERO BLIND SIGNING FOR NEAR AGENTS"           │ • Tilting Chassis + Parallax   │
│ • Headline: Never let your AI assistant sign a        │ • 0% Blind / Split / 100% Snap │
│   sealed envelope.                                    │ • Embedded 01-07 Scenario Dock │
│ • Primary CTA: [Scan Errand 01 ($25 Server Bill)]     │ • 4-Step Architecture Pipeline │
│ • Live Telemetry Strip (100% Open, $0 Lost, 3 Lanes)  │ • Draggable Cobalt Laser Lens  │
│                                                       │ • Interactive 3D Wireframe Cube│
│                                                       │ • [Simulate Prompt Injection]  │
│                                                       │ • 4-Pill X-Ray Anatomy Grid    │
│                                                       │ • [Human CFO Co-Sign (2/2)]    │
│                                                       │ • Live Policy Sandbox Toggles  │
├───────────────────────────────────────────────────────┴────────────────────────────────┤
│ SECTION 02: 7-Scenario Swiss Index Strip (Filter by All / Safe / Team Vote / Blocked) │
│ SECTION 03: Architectural Consequence Split (Blind Envelope vs. X-Ray Conveyor)       │
│ SECTION 04: 3-Cell Bento Grid (Spending Lanes • NEAR AI TEE • 3-Step Integration)      │
│ SECTION 05: Collapsible Cryptographic Proof Drawer (Raw AST • Promises • Intents Quote)│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Word-for-Word 90-Second Demo Script (Lightning Pitch)

Use this script when judges give you 90 seconds to 2 minutes. Every sentence corresponds to a visible interaction on the screen.

---

### Phase 1: The Hook & The Draggable Lens (0:00 – 0:25)

#### What You Do On Screen:
1. Ensure `http://localhost:3000` is open.
2. In the top-right header, click **`Reset`** to show a clean state.
3. Place your cursor over the **3D X-Ray Stage** on the right side of the hero section so the chassis tilts in 3D perspective.
4. Click and drag the **Cobalt X-Ray Lens Handle (`< >`)** all the way to the right (to 0% Blind), then slowly drag it back across the screen to reveal the inside.

#### What You Say Verbatim:
> *"Today on NEAR, autonomous AI agents manage company treasuries and pay vendors on Base, Ethereum, and Bitcoin using Chain Signatures (`v1.signer`).*  
>  
> *Here is the critical vulnerability: when an AI assistant calls `v1.signer`, it only passes a blind 32-byte cryptographic hash. That is this sealed black envelope on the left.*  
>  
> *If an attacker prompt-injects your AI assistant, `v1.signer` has no idea what is inside. It blindly stamps away your entire treasury.*  
>  
> *Dragging our MpcFirewall X-Ray lens across shows how our smart contract opens the raw transaction bytes on-chain before `v1.signer` is ever allowed to sign."*

---

### Phase 2: Scenario 01 & The Live Prompt-Injection Simulator (0:25 – 0:50)

#### What You Do On Screen:
1. Point to **Scenario 01 (The $25 Server Bill)** currently loaded on the stage.
2. Point to the **4-Pill Unpacked X-Ray Anatomy Grid** on the right:
   - Target Network: `Base (Chain 8453)`
   - Unpacked Function: `transfer (0xa9059cbb)`
   - Decoded Amount: `25.00 USDC`
   - Destination: `0x1111…1111 (Verified)`
3. Now, click the crimson button: **`Simulate Prompt Injection (Poison This $25 Bill)`**.
4. Watch the 3D stage react instantly:
   - Floating badge changes to: **`PROMPT-INJECTION DETECTED`**
   - 3D Wireframe Cube turns **Crimson Red**
   - Verdict changes to: **`Intercepted & Blocked Before Signing`** (`$142,500 Saved`)
   - Unpacked Anatomy updates: `multicall (2 nested calls)`, `UNLIMITED (2²⁵⁶ - 1)`, destination turns to `TRAP`.

#### What You Say Verbatim:
> *"In Scenario 01, our AI assistant wants to pay a cloud provider $25 USDC on Base. MpcFirewall unpacks the raw EIP-1559 RLP bytes, confirms the vendor is on our allowlist, and confirms it is under our $100 auto-cap.*  
>  
> *Now, watch what happens when an attacker sneaks a prompt injection into that agent. I'll click 'Simulate Prompt Injection'.*  
>  
> *The AI assistant still claims it is paying a $25 server bill. But our recursive ABI decoder exposes what was smuggled inside: an infinite `approve(MAX_UINT256)` blank check. The 3D cube turns crimson, the transaction is dropped on-chain, and `v1.signer` is never called. Zero dollars lost."*

---

### Phase 3: The Russian Nesting-Doll & Bitcoin Traps (0:50 – 1:15)

#### What You Do On Screen:
1. In the embedded scenario dock right above the 3D canvas, click **`03 Nesting Doll`** (or click row `03` in the index strip below).
2. Grab and rotate the **3D Wireframe Cube** directly with your mouse to show the concentric unpacked shells.
3. Click **`07 Bitcoin Redirect`** in the scenario strip:
   - Notice the anatomy pills change to: `Bitcoin (SegWit)`, `250,000 sats`, `Unapproved Output Script`.

#### What You Say Verbatim:
> *"Attackers know basic firewalls only look at top-level functions. In Scenario 03, the Russian Nesting Doll, the attacker hides an unlimited draining permit inside an innocent-looking `multicall` batch. Our contract recursively unwraps the call tree at depth 1 and depth 2 to kill the trap.*  
>  
> *And this is not just for EVM. In Scenario 07, our AI assistant tries to sweep funds on Bitcoin. MpcFirewall parses the raw SegWit UTXO byte stream directly on NEAR, detects that 250,000 satoshis are being diverted to an unapproved scriptPubKey, and blocks the Bitcoin signature before it happens."*

---

### Phase 4: CFO Multisig Escalation & Live Technical Verification (1:15 – 1:40)

#### What You Do On Screen:
1. Click **`06 $250 Team Vote`** in the scenario strip.
2. Point out the amber banner: **`Paused for Human Team Vote (SputnikDAO)`**.
3. Point to the interactive co-sign card: **`SputnikDAO / Trezu Proposal #42 (Exceeds $100 Auto-Cap)`**.
4. Click the button: **`Co-Sign as Human CFO (Approve 2/2) →`**.
5. Watch the card immediately turn **Emerald Green**:
   - `SputnikDAO Proposal #42 Approved (2/2 Council Quorum)`
   - Status updates to: `v1.signer: Signed ✓`
6. Look up at the sticky header and click **`Verify MPC Key`**:
   - The button pulses and updates to **`Live Key: 4NfT…`**.
7. Scroll down to Section 05 and click **`Technical Judge Proof`** to expand the live RLP AST, cross-contract payload, and NEAR AI TEE attestation.

#### What You Say Verbatim:
> *"What if the transaction is legitimate, but exceeds the AI assistant's $100 daily autonomous budget?*  
>  
> *In Scenario 06, the AI assistant needs to pay a $250 equipment invoice. MpcFirewall routes it to the Amber Lane. It doesn't fail; instead, it automatically generates a SputnikDAO proposal.*  
>  
> *I click 'Co-Sign as Human CFO' right here. Quorum is reached, and MpcFirewall dispatches the verified digest to `v1.signer`.*  
>  
> *When I click 'Verify MPC Key' in the header, our frontend queries the live NEAR Testnet RPC for `v1.signer-prod.testnet`'s threshold root key. Expanding the proof drawer at the bottom exposes the byte-for-byte AST and verified TEE attestations.*  
>  
> *MpcFirewall is completely open-source, passes all 21 automated tests, and drops into existing NEAR agent architectures in three simple steps. Thank you."*

---

## 3. Deep-Dive 3-Minute Script (For Full Technical Presentation)

If you have 3 to 5 minutes or an interactive screen-share with a technical judge, follow this expanded track:

```
[0:00 - 0:45] The Blind-Signing Problem & 3D Interactive Stage
[0:45 - 1:30] EVM Defense: Blank Checks & Recursive Multicalls
[1:30 - 2:05] Non-EVM Defense: Native Bitcoin SegWit Output Parsing
[2:05 - 2:40] The 3 Lanes & Live Policy Sandbox Manipulation
[2:40 - 3:15] Security Hardening: Gas-Drain Caps, Replay LookupSets, TEE Checks
[3:15 - 3:30] Protocol Inspector Mode & Conclusion
```

### Detailed Script for Phase 4: The Live Policy Sandbox (2:05 – 2:40)

#### What You Do On Screen:
1. Stay on **Scenario 06 ($250 Team Milestone)**, which is currently **Amber (Paused for SputnikDAO Vote)**.
2. Scroll to the bottom of the 3D stage card to find the **Live Policy Sandbox Bar**:
   - Look at the button: `Auto-Sign Cap: $100 USDC (Click for $300)`.
3. Click the button to raise the cap to **`$300`**.
4. Watch the entire stage flip from **Amber** to **Emerald Green** in real time!
   - Verdict changes to: `Verified Safe — Approved for Signing ($250 Approved)`
   - Pipeline badge updates to: `v1.signer: Signed ✓`
5. Click **`Restore Defaults`** to return the cap to $100.

#### What You Say Verbatim:
> *"Judges often ask: 'Are these scenarios hardcoded mock data?'*  
>  
> *Notice this Live Policy Sandbox bar at the bottom of the stage. Scenario 06 is currently paused for a DAO vote because its $250 amount exceeds our $100 auto-cap.*  
>  
> *Watch what happens when I click this button to raise our auto-approve policy to $300.*  
>  
> *Immediately, the Rust policy engine re-evaluates the transaction. Because $250 is now below $300, the stage instantly turns green, and it authorizes `v1.signer` automatically. This is a live, dynamic policy engine."*

---

### Detailed Script for Phase 5: Protocol Inspector Mode (3:15 – 3:30)

#### What You Do On Screen:
1. In the sticky header bar, click **`Protocol Inspector`** in the center mode switcher.
2. Show the 3-column engineering layout:
   - **Column 1 (TxWorkbench):** Raw unsigned hex editor, chain selector, and preset scenario picker.
   - **Column 2 (PolicyRail):** Live policy controls (Authorized Agents, Blocked Addresses, Max Native Wei, Auto-Approve Caps, TEE Enforcement).
   - **Column 3 (ProofInspector):** Real-time cryptographic evaluation record, AST call tree, TEE Ed25519 signature verification, and cross-contract payload.
3. Switch back to **`Interactive X-Ray Studio`** to wrap up.

#### What You Say Verbatim:
> *"For protocol engineers and auditors, clicking 'Protocol Inspector' opens our engineering workbench. You can paste arbitrary RLP hex, edit allowlists, toggle fail-closed TEE validation, and inspect the resulting cross-contract promises before deploying to mainnet."*

---

## 4. Line-by-Line Visual Anchor Cheatsheet

When you navigate the app during your presentation, use this quick reference table to know exactly what every badge and button means:

| UI Element | Location | What It Shows / Does | Spoken Talking Point |
| :--- | :--- | :--- | :--- |
| **`MpcFirewall // v1.signer-prod.testnet`** | Header (Left) | Brand mark with pulsing green live dot | *"Our gateway contract deployed on NEAR Testnet."* |
| **`Interactive X-Ray Studio`** | Header (Center) | Visual storytelling & interactive 3D stage | *"Designed for visual clarity and real-time comprehension."* |
| **`Protocol Inspector`** | Header (Center) | 3-column raw engineering workbench | *"For protocol developers to inspect raw hex and ASTs."* |
| **`Verify MPC Key`** | Header (Right) | Queries live NEAR RPC & fetches root public key | *"Fetches the real threshold key (`secp256k1:4NfT…`) directly from NEAR Testnet."* |
| **`Reset`** | Header (Right) | Resets daily spent budget and replay cache | *"Restores demo state to zero spend."* |
| **`3D Tilting Chassis`** | Hero (Right) | Smooth 3D perspective tilt on mouse hover | *"A true 3D spatial interface with dynamic specular lighting."* |
| **`0% Blind / Split / 100% X-Ray`** | 3D Stage (Top) | Instant snap buttons for X-Ray curtain | *"Jump between the blind envelope and full transparency."* |
| **`< >` Cobalt Slider Handle** | 3D Stage (Center) | Draggable divider between Blind and X-Ray views | *"Peels back the blind envelope to inspect the transaction."* |
| **3D Wireframe Cube** | 3D Stage (Canvas) | Rotating 3D hologram with concentric shells | *"Drag with your cursor to orbit the transaction in 3D."* |
| **`Simulate Prompt Injection`** | 3D Stage (Canvas) | Injects nested multicall trap into Scenario 01 | *"Shows what happens when a safe agent is compromised."* |
| **4-Pill Anatomy Grid** | 3D Stage (Right) | Network, Function, Amount, Counterparty | *"Breaks down raw byte code into human-auditable truths."* |
| **`Co-Sign as Human CFO →`** | 3D Stage (Right) | Approves SputnikDAO proposal #42 | *"Human-in-the-loop multisig quorum for large expenses."* |
| **Live Policy Sandbox** | 3D Stage (Bottom) | Dynamic policy buttons (Cap $100/$300, Guards) | *"Proves the engine is dynamic and not hardcoded."* |
| **Scenario Index (`01`–`07`)** | Section 02 | Swiss table of 7 real EIP-1559 and BTC txs | *"Seven distinct attack vectors and legitimate flows."* |
| **Consequence Comparison** | Section 03 | Split cards: Blind Notary vs. X-Ray Conveyor | *"Why existing function call keys fail to stop the drain."* |
| **3-Cell Bento Grid** | Section 04 | 3 Spending Lanes, NEAR AI TEE, 3-Step Setup | *"How MpcFirewall seamlessly integrates into NEAR."* |
| **Technical Proof Drawer** | Section 05 | AST JSON, NEAR Promises, 1Click Intents | *"Full cryptographic transparency for smart contract judges."* |

---

## 5. Judge Q&A Defense: Top 6 Questions & Exact Answers

### Q1: *"Is this just a frontend simulation or is it real cryptographic decoding?"*
> **Answer:** *"It is 100% real cryptographic decoding. Our `@mpc-firewall/core` library contains a zero-dependency RLP byte parser, recursive ABI calldata unpacker, and Bitcoin SegWit/Legacy UTXO decoder. When you click any scenario, it parses the actual unsigned transaction bytes. Furthermore, our Rust contract in `contracts/mpc-firewall` implements these exact same byte-level parsers in WebAssembly directly inside the NEAR runtime."*

### Q2: *"How does this stop an attacker from bypassing your contract and calling `v1.signer` directly?"*
> **Answer:** *"NEAR's account model makes this foolproof. The multi-chain treasury derivation path is tied directly to `mpc-firewall.testnet`. The user scopes their AI assistant's NEAR Function Call Key so that the assistant only possesses permissions to call `mpc-firewall.testnet`. The assistant does NOT possess permissions to call `v1.signer` directly. If the assistant tries to bypass the firewall, NEAR's runtime protocol rejects the transaction at the consensus layer."*

### Q3: *"Can an attacker drain the treasury through gas bribe fees (maxFeePerGas) without sending tokens?"*
> **Answer:** *"No. We audited this exact attack vector. In both our TypeScript engine and our NEAR Rust contract, we calculate the worst-case gas exposure: `gasLimit * maxFeePerGas`. This worst-case fee is added to `valueWei` and evaluated against both the single-transaction cap and the daily cumulative cap. If an attacker submits a transaction with zero transfer value but an astronomical priority bribe, MpcFirewall blocks it on-chain with `ERR_NATIVE_VALUE_EXCEEDS_MAX`."*

### Q4: *"What stops an attacker from replaying an approved transaction multiple times?"*
> **Answer:** *"We enforce dual-layer replay protection. In addition to caller-specified transaction IDs, our Rust contract hashes the exact unsigned transaction payload into a SHA-256 digest and stores it in a persistent NEAR `LookupSet`. If an attacker attempts to resubmit the exact same signed payload with a new ID, the contract reverts immediately with `ERR_REPLAY_DETECTED`."*

### Q5: *"Can an attacker hide an unapproved spender inside a bounded approve or permit?"*
> **Answer:** *"No. In addition to blocking unlimited `MaxUint256` approvals, our engine decodes the `spender` address from `approve`, `increaseAllowance` (`0x39509351`), and EIP-2612 `permit` calldata. The spender must exist on the policy's `allowedRecipients` allowlist. Approving an unapproved third party is blocked with `ERR_UNAPPROVED_RECIPIENT`."*

### Q6: *"What role does NEAR AI Cloud play if you already decode on-chain?"*
> **Answer:** *"NEAR AI Cloud provides confidential intent co-auditing inside a secure TEE (Confidential AMD SEV-SNP enclave). The AI agent submits its plain-English user prompt. The TEE compares the agent's stated intent against the extracted function calldata. If the agent claims it is 'paying an invoice' while the calldata calls an unverified router, the TEE flags a `CRITICAL` risk mismatch. MpcFirewall enforces this with `ERR_TEE_CRITICAL_RISK` before dispatching to `v1.signer`."*

---

## 6. Pre-Demo Checklist (30 Seconds Before Pitching)

- [ ] Ensure local dev server is running on `http://localhost:3000` (run `pnpm dev` in workspace).
- [ ] Open `http://localhost:3000` in Chrome or Brave at **100% zoom**.
- [ ] Click **`Reset`** in the header so the stage starts clean on **Scenario 01**.
- [ ] Move cursor across the 3D stage to confirm smooth 60fps tilt.
- [ ] Test-drag the Cobalt slider handle (`< >`) once to confirm smooth movement.
- [ ] Click **`Verify MPC Key`** once to cache the live NEAR testnet RPC response (`Live Key: 4NfT…`).
- [ ] Take a deep breath: you are ready to deliver a flawless, award-winning presentation!
