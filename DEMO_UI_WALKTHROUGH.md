# MpcFirewall Localhost Demo Guide (`http://localhost:3000`)

This guide explains the new **Interactive 3D Visual Console** and gives you a **step-by-step 60–90 second click-and-talk recording script** for your hackathon demo.

---

## 1. Before You Hit Record

1. The app is running live at **`http://localhost:3000`**.
2. Open `http://localhost:3000` in your browser.
3. You will notice the new **Console View Mode Switcher** at the top:
   - **`✨ Visual Story & Attack Simulator`** (Active by default — designed for video recordings & high-impact presentations)
   - **`🔬 Deep Protocol & Policy Inspector`** (The low-level developer view for hardcore security audits)
4. Click **`Reset State`** in the top hero bar before recording so **Daily Assistant Spend** starts cleanly at `0.00 / 1000.00 USDC` and the inspection gates start fresh.

> **Tip:** MpcFirewall has built-in **replay protection**. If you click the same scenario twice without resetting, the second attempt is rejected as an exact replay. Click **`Reset State`** anytime to restart clean.

---

## 2. Understanding the New Visual Interface (Plain-English Map)

The interface is organized into **3 intuitive visual stages**:

### Stage 1: One-Click Scenario & Attack Sandbox (Interactive 3D Cards)
Seven interactive cards with tactile 3D hover effects, risk badges, and emoji icons:
- ☕ **1. Safe $25 Assistant Errand** (`Base USDC` • `Safe`): Routine vendor bill.
- 💣 **2. The Infinite Blank Check** (`Base USDC` • `Critical Attack`): Prompt-injected agent tries to sign `ERC-20 approve(drainer, MaxUint256)`.
- 🪆 **3. The Trojan Nesting Doll** (`Base Router` • `High Attack`): Smuggles a hidden drain inside a nested `multicall(bytes[])` bundle.
- ⛓️ **4. Wrong-Chain Trap** (`Ethereum Mainnet` • `Attack`): Encodes chain ID 1 while claiming to be on Base.
- 🖼️ **5. Blanket NFT Drainage** (`Base NFT` • `Attack`): Sneaks in `setApprovalForAll(true)`.
- 🏛️ **6. $250 Team Milestone** (`Base USDC` • `DAO Escalation`): Safe transaction above the $100 auto-cap that escalates to human vote (`Trezu / SputnikDAO`).
- ₿ **7. Bitcoin Treasury Hijack** (`Bitcoin Raw` • `Attack`): Redirects 250,000 sats to an unapproved Bitcoin script.

### Stage 2: Live Airport X-Ray Inspection Belt (The 4 Security Gates)
Shows your AI Assistant's transaction traveling through 4 glowing inspection chambers:
- **Gate 1 (AI Assistant Intent):** Displays what the AI assistant claims it is doing and the target network.
- **Gate 2 (On-Chain X-Ray Decoder):** Unwraps raw transaction bytes and nested multicalls up to depth 3 in Rust Wasm.
- **Gate 3 (Private TEE Lie Detector):** Confidential NEAR AI Cloud audit verifying that the assistant's stated reason matches the decoded bytecode.
- **Gate 4 (Policy & Vault Stamp):** Enforces spending limits, daily budgets, and prepares the cross-contract call to `v1.signer`.
- **Action Button:** Big glowing button **`Run Inspection & Intercept Attacks`**.

### Stage 3: The "What Happened to Your Treasury" Verdict (Shock-Value Comparison)
Two side-by-side comparison cards:
- **🔴 Without MpcFirewall (Current NEAR Chain Signatures):**
  - Shows what `v1.signer` alone sees: an unreadable 32-byte hash (`0x7a2d40fdb3...`).
  - Displays the catastrophic real-world outcome: **`💀 $142,500 USDC DRAINED`** (wallet drained blindfolded).
- **🟢 With MpcFirewall (Zero-Blind-Signing Protected Flow):**
  - Shows our contract opening the bytes on-chain.
  - Displays the protected result: **`🛡️ $0.00 Lost — Intercepted at $0`**.

### Deep Protocol Proof (Collapsible Drawer at the Bottom)
Click **`🔬 Deep Cryptographic Disassembly & On-Chain Verification Proof`** to expand:
- The full unwrapped AST tree (`depth=0`, `depth=1`).
- The verified NEAR AI TEE signature badge.
- The exact cross-contract Promise payload sent to `v1.signer-prod.testnet` or SputnikDAO.
- The **`Preview Confidential Intents Treasury Refuel Quote`** button.

---

## 3. Your 60–90 Second Demo Recording Script

Start on **`http://localhost:3000`** in **Visual Story Mode** (click **`Reset State`** once):

### 0:00 – 0:15 | Introduction & Live NEAR Probe
- **Click:** **`Probe v1.signer-prod.testnet`** in the top hero bar (updates to `MPC Root Key: secp256k1:...`).
- **Say:** *"This is MpcFirewall. When an AI assistant controls multi-chain crypto on NEAR, Chain Signatures only sees an opaque 32-byte hash. If the assistant gets prompt-injected, existing locks are blindfolded. MpcFirewall is the airport X-ray scanner that inspects the raw transaction before NEAR's signing vault ever signs."*

### 0:15 – 0:30 | Scenario 1: Routine $25 Assistant Errand (Green Lane)
- **Click card:** **`1. Compliant Base USDC Vendor Payout (25 USDC)`**.
- **Click:** **`Run Inspection & Intercept Attacks`**.
- **Point to:**
  1. Gate 4 turns green (`APPROVED_FOR_MPC_SIGN`).
  2. Right card shows **`$25.00 USDC Authorized & Stamped Safely`**.
  3. Top bar **Daily Spend** counter advances to **`25.00 / 1000.00 USDC`**.
- **Say:** *"First, a routine errand: our AI assistant pays a $25 invoice. MpcFirewall unwraps the raw bytes, confirms the TEE intent matches, updates daily spend, and builds the safe `v1.signer` dispatch."*

### 0:30 – 0:50 | Scenario 2: The Infinite Blank Check (Red Lane Interception)
- **Click card:** **`2. Blind-Sign Attack: ERC-20 approve(drainer, MaxUint256)`**.
- **Click:** **`Run Inspection & Intercept Attacks`**.
- **Point to:**
  1. Left card (Without MpcFirewall): **`💀 $142,500 USDC DRAINED`** — explains that without our firewall, `v1.signer` would only see this 32-byte hash and sign away the vault.
  2. Right card (With MpcFirewall): **`🛡️ $0.00 Lost — Intercepted at $0`** with `ERR_UNLIMITED_APPROVAL`.
- **Say:** *"Now, a scammer tricks our assistant with prompt injection. The assistant claims it's claiming a gas rebate, but secretly slipped in an unlimited `MaxUint256` approval. Without MpcFirewall, your entire $142,000 treasury is drained. With MpcFirewall, it's intercepted on-chain in 4 milliseconds. Zero dollars lost."*

### 0:50 – 1:10 | Scenario 3: The Trojan Nesting Doll (Nested Multicall Drain)
- **Click card:** **`3. Smuggled Drain: Nested multicall(bytes[]) Hidden Approve`**.
- **Click:** **`Run Inspection & Intercept Attacks`**.
- **Click bottom drawer:** **`Deep Cryptographic Disassembly...`** to briefly reveal the indented `depth=1` tree.
- **Say:** *"Even if attackers hide the drain inside a Russian nesting doll bundle of normal transfers, our Rust decoder recursively unwraps the multicall tree layer-by-layer and catches the hidden approve."*

### 1:10 – 1:30 | Scenario 6: $250 Team Milestone (Amber Lane / DAO Governance)
- **Click card:** **`6. Over-Limit Governance: 250 USDC Escalates to Trezu / SputnikDAO`**.
- **Click:** **`Run Inspection & Intercept Attacks`**.
- **Point to:**
  1. Amber status: **`ESCALATE_TO_DAO`**.
  2. Amber note: **`🏛️ Paused — Sent to Trezu / SputnikDAO Multisig Proposal`**.
- **Say:** *"And when the assistant makes a legitimate $250 payment above its $100 allowance, MpcFirewall doesn't fail—it automatically builds a SputnikDAO multisig proposal for human team approval."*

### Wrap Up (Last 5 seconds)
- **Say:** *"MpcFirewall stops blind signing so AI assistants can safely act across chains. You can verify all 7 scenarios locally with `pnpm verify:judge`."*
