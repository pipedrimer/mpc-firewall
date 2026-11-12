# How to Demo MpcFirewall on Localhost (`http://localhost:3000`)

This guide walks you through the **Awwwards-Grade Interactive X-Ray Studio** at `http://localhost:3000` so you can deliver a clear, high-impact 2-minute live demo for judges—whether they are non-technical investors or core protocol engineers.

---

## 1. Starting the Local Demo

Your server is already running at:
👉 **`http://localhost:3000`**

*(If you ever restart your computer, open a terminal in this folder and run `pnpm start` or `pnpm dev`.)*

When you open `http://localhost:3000`, the app defaults to **Interactive X-Ray Studio** mode—designed with a **Swiss Architectural Alabaster + Deep Obsidian + Optical Cobalt (`#1F3CFF`)** palette, custom editorial illustrations, a real-time 60fps 3D transaction payload cube, and an interactive **Optical X-Ray Lens** slider.

---

## 2. Understanding the Layout (Top to Bottom)

### A. Sticky Architectural Header Bar
- **Brand Mark (`MpcFirewall // v1.signer-prod.testnet`)**: Shows live status of your on-chain firewall gateway.
- **Center Mode Switcher Pill**:
  - **Interactive X-Ray Studio** *(Default)*: Visual storytelling, draggable X-Ray lens, plain-English assistant claims vs. hidden transaction payloads, and one-click scenario strip (`01`–`07`).
  - **Protocol Inspector**: 3-column engineering workbench for inspecting raw RLP hex, toggling live security policy switches, and testing stateful replay protection.
- **Daily Allowance Meter**: Tracks how much of your AI assistant's autonomous daily spending cap (`$1,000 USDC`) has been used (`$25 / $1,000 USDC`).
- **Probe `v1.signer-prod.testnet`**: Queries live NEAR Testnet RPC to fetch the active threshold root public key (`secp256k1:...`).
- **Reset State**: Resets the daily spending counter and replay-protection history back to a clean slate before you start your pitch.

---

### B. Above the Fold: The 3D Interactive X-Ray Stage
- **Left Column (Editorial Thesis & Primary Action)**:
  - **Headline**: *"Stop AI assistants from blind-signing your treasury."*
  - **Scan Selected Errand / Re-Scan Live on NEAR**: Runs the active scenario through the real RLP/Bitcoin byte parser, policy engine, and NEAR AI TEE intent co-auditor.
  - **Jump to Scenario Index (`01`–`07`)**: Smooth-scrolls to the 7 pre-loaded scenarios.
- **Right Column (Interactive 3D X-Ray Stage)**:
  - **3D Perspective Tilt & Wireframe Cube**: Move your cursor across the stage—the card tilts in 3D space and the 60fps wireframe transaction cube rotates and shifts color (`Emerald` = Safe, `Crimson` = Blocked, `Amber` = Escalated to DAO).
  - **Draggable Optical X-Ray Lens Handle (`< >`)**: Drag the vertical cobalt line left and right across the stage:
    - **Left of the lens (`Without MpcFirewall — Blind 32-Byte Envelope`)**: Shows the opaque dark obsidian box (`#0B0F17`) and raw 32-byte `keccak256` hash that `v1.signer` normally sees—with zero visibility into recipient, token amount, or hidden approvals.
    - **Right of the lens (`MpcFirewall X-Ray View`)**: Peels back the envelope to reveal custom editorial artwork, **What Your AI Assistant Claims** vs. **What Is Actually Inside the Envelope**, and the live **On-Chain Firewall Verdict Badge**.

---

### C. Section 01: The 7-Scenario Swiss Index Strip (`01`–`07`)
Clicking any row `01` through `07` immediately loads and evaluates that real unsigned EIP-1559 or Bitcoin transaction:
- **`01` — Safe $25 Supplier Payment** (`Base • 25 USDC` → `APPROVED_FOR_MPC_SIGN`)
- **`02` — The Blank-Check Trap** (`Base • Unlimited USDC Approval` → `BLOCKED: ERR_UNLIMITED_APPROVAL`)
- **`03` — The Russian Nesting-Doll Trap** (`Base • Multicall Batch` → `BLOCKED: ERR_NESTED_MULTICALL_VIOLATION`)
- **`04` — Total NFT Collection Takeover** (`Base • setApprovalForAll` → `BLOCKED: ERR_SET_APPROVAL_FOR_ALL`)
- **`05` — Bitcoin Dust-Sweep Trap** (`Bitcoin • 150,000 sats` → `BLOCKED: ERR_BTC_OUTPUT_CAP_EXCEEDED`)
- **`06` — $250 Equipment Purchase** (`Base • 250 USDC` → `ESCALATE_TO_DAO: add_proposal`)
- **`07` — Unverified Mystery Contract** (`Base • selector 0xdeadbeef` → `BLOCKED: ERR_UNKNOWN_SELECTOR`)

---

### D. Section 02: Consequence Comparison (Obsidian vs. Paper Split)
Directly compares **Legacy Agentic Flow (`v1.signer` Alone)** on the left against **MpcFirewall Protected Flow** on the right, updating dynamically for whichever scenario (`01`–`07`) you clicked.

### E. Section 03: Three-Lane Architecture Bento Grid
Visualizes how MpcFirewall fits into the NEAR ecosystem with custom editorial illustrations:
1. **Path Ownership (`mpc-firewall.testnet` → `v1.signer`)**
2. **Three-Lane Traffic Routing (Green Lane Auto-Sign, Red Lane Instant Drop, Amber Lane Trezu/SputnikDAO Proposal)**
3. **Confidential Intents Treasury Refuel (1Click API Integration)**

### F. Collapsible Cryptographic Proof Drawer (Bottom)
Click **"Cryptographic Disassembly, AST & NEAR AI TEE Attestation"** at the bottom of the page whenever a technical judge asks *"Is this actually decoding real RLP bytes and verifying TEE signatures?"*—it expands the live `keccak256` preimage digest, recursive ABI call tree, and `ed25519` attestation signature.

---

## 3. Word-for-Word 2-Minute Judge Demo Script

### Step 1: Hook & Drag the X-Ray Lens (25 seconds)
1. Click **Reset State** in the top-right header so the allowance meter starts at `$0 / $1,000 USDC`.
2. Point to the **3D Interactive X-Ray Stage** on the right side of the hero section and drag the **Cobalt X-Ray Handle (`< >`)** left and right:
   > *"On NEAR today, when an AI assistant uses Chain Signatures (`v1.signer`) to pay a supplier on Base or Bitcoin, `v1.signer` only receives a blind 32-byte hash—this black box on the left. If the AI assistant is prompt-injected, `v1.signer` blindly signs away your entire treasury. Dragging our MpcFirewall X-Ray lens across shows how our smart contract opens the raw transaction bytes on-chain before `v1.signer` is ever called."*

### Step 2: Scenario `01` — Safe $25 Errand (20 seconds)
1. Show that **Scenario `01` (Safe $25 Supplier Payment)** is active:
   > *"In Scenario 01, our AI assistant asks to pay a verified supplier $25 USDC on Base. MpcFirewall decodes the raw EIP-1559 RLP bytes, confirms the recipient is on our allowlist and the amount is under our $100 autonomous cap, and automatically dispatches the 32-byte hash to `v1.signer`."*

### Step 3: Scenario `02` & `03` — Stopping the Blank-Check & Nesting-Doll Traps (40 seconds)
1. Click **Row `02` (The Blank-Check Trap)** in the Scenario Index Strip:
   > *"Now watch what happens when our AI assistant reads a poisoned webpage. It claims it's claiming a free airdrop—but inside the raw hex is an ERC-20 `approve(MAX_UINT256)` blank check. The 3D cube turns crimson and MpcFirewall aborts the transaction on-chain (`ERR_UNLIMITED_APPROVAL`). `v1.signer` is never even called."*
2. Click **Row `03` (The Russian Nesting-Doll Trap)**:
   > *"Even if an attacker hides an unlimited approval at depth-1 inside a `multicall(bytes[])` batch alongside a normal $10 payment, our recursive ABI decoder unwraps every nested frame and blocks the batch (`ERR_NESTED_MULTICALL_VIOLATION`)."*

### Step 4: Scenario `06` — CFO Multisig Escalation & Live Technical Proof (35 seconds)
1. Click **Row `06` ($250 Equipment Purchase)**:
   > *"Finally, what if the errand is legitimate—paying a verified vendor $250 USDC—but exceeds our AI assistant's $100 autonomous cap? Instead of failing, MpcFirewall routes it to the Amber Lane (`ESCALATE_TO_DAO`) and auto-generates a SputnikDAO / Trezu `add_proposal` payload so human signers can approve it."*
2. Click **Probe `v1.signer-prod.testnet`** in the top header and open the **Cryptographic Disassembly** drawer at the bottom (or switch to **Protocol Inspector** in the header):
   > *"Everything you just saw runs against real EIP-1559 RLP and Bitcoin byte decoders, verified NEAR AI TEE attestations, and live `v1.signer-prod.testnet` RPC state."*
