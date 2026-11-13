import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Cpu,
  FolderGit2,
  KeyRound,
  Lock,
  Network,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Users
} from 'lucide-react';
import { CodeBlock } from './CodeBlock';

const QUICKSTART_INSTALL = `pnpm install
cp .env.example apps/web/.env.local   # Optional: add NEAR AI / relay keys
pnpm dev                              # Launch console at http://localhost:3000`;

const QUICKSTART_TESTS = `pnpm typecheck      # Build @mpc-firewall/core & typecheck Next.js app
pnpm test           # Run 29 unit & security hardening tests across 5 suites
pnpm verify:judge   # Evaluate all 7 real byte-encoded scenarios via CLI
pnpm test:e2e       # End-to-end HTTP API + fail-closed hardening check

# Smart Contract Tests & WASM Build (requires wasm32-unknown-unknown target)
cd contracts/mpc-firewall
cargo test --locked
RUSTFLAGS="-C link-arg=-s -C target-cpu=mvp" cargo build --target wasm32-unknown-unknown --release`;

const ONCHAIN_SETUP = `// 1. Give your AI agent a NEAR key that ONLY calls MpcFirewall
//    (never grant direct access to v1.signer-prod.testnet).
near contract add-function-call-key <agent>.testnet <agent-pubkey> \\
  contract mpc-firewall.testnet \\
  method-names verify_and_sign_evm,verify_and_sign_btc,verify_and_sign_btc_bip143 \\
  allowance 1.0 NEAR

// 2. Whitelist that agent inside your MpcFirewall policy (Owner or DAO only).
near contract call-function as-transaction mpc-firewall.testnet add_authorized_agent \\
  json-args '{ "agent": "<agent>.testnet" }' \\
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as <owner>.testnet`;

const ONCHAIN_EVM = `import { ethers } from 'ethers';

// Build the full unsigned EIP-1559 transaction (do NOT hash it yourself)
const erc20 = new ethers.Interface(['function transfer(address to, uint256 amount)']);
const unsignedTx = ethers.Transaction.from({
  type: 2,
  chainId: 8453, // Base
  nonce: Math.floor(Date.now() / 1000),
  maxPriorityFeePerGas: 1_000_000n,
  maxFeePerGas: 25_000_000n,
  gasLimit: 65_000n,
  to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Base USDC
  value: 0n,
  data: erc20.encodeFunctionData('transfer', ['0x1111111111111111111111111111111111111111', 25_000_000n])
});

// Send raw unsigned bytes to MpcFirewall; the contract verifies everything,
// computes the hash on-chain, and requests a signature from v1.signer-prod.testnet.
await agentNearAccount.functionCall({
  contractId: 'mpc-firewall.testnet',
  methodName: 'verify_and_sign_evm',
  args: {
    raw_unsigned_tx_hex: unsignedTx.unsignedSerialized,
    tx_id: \`agent-\${crypto.randomUUID()}\`
  },
  gas: 300_000_000_000_000n,
  attachedDeposit: 1n
});`;

const ONCHAIN_BTC = `await agentNearAccount.functionCall({
  contractId: 'mpc-firewall.testnet',
  methodName: 'verify_and_sign_btc_bip143',
  args: {
    raw_unsigned_btc_hex: rawBtcHex,
    tx_id: \`btc-\${crypto.randomUUID()}\`,
    bip143: {
      input_index: 0,
      prevout_value_sats: 300000,
      script_code_hex: '00141111111111111111111111111111111111111111'
    }
  },
  gas: 300_000_000_000_000n,
  attachedDeposit: 1n
});`;

const HTTP_INSPECT = `// Call /api/inspect before letting your agent sign or broadcast any transaction
const res = await fetch('https://mpc-firewall.netlify.app/api/inspect', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    chainKind: 'evm',
    rawUnsignedHex: unsignedEip1559Hex,
    agentIntent: 'Pay vendor #402 25 USDC on Base for monthly API invoice'
  })
});

const { data } = await res.json();
const { decision, teeAudit, mpcDispatch, daoProposalPayload } = data.record;

if (decision.outcome === 'BLOCKED') {
  throw new Error(\`Transaction rejected: \${decision.reasons.join('; ')}\`);
}`;

const TOOL_SCHEMA = `{
  "type": "function",
  "function": {
    "name": "mpc_firewall_inspect_tx",
    "description": "Inspect raw unsigned EVM or Bitcoin transaction bytes before MPC signing to verify spend caps, calldata safety, and alignment with user intent.",
    "parameters": {
      "type": "object",
      "properties": {
        "chainKind": { "type": "string", "enum": ["evm", "bitcoin"] },
        "rawUnsignedHex": { "type": "string", "description": "0x-prefixed EVM RLP tx or raw BTC tx hex" },
        "agentIntent": { "type": "string", "description": "Plain-English summary of what the agent intends to do" },
        "bip143Input": {
          "type": "object",
          "properties": {
            "inputIndex": { "type": "integer" },
            "prevoutValueSats": { "type": "string" },
            "scriptCodeHex": { "type": "string" }
          },
          "required": ["inputIndex", "prevoutValueSats", "scriptCodeHex"]
        }
      },
      "required": ["chainKind", "rawUnsignedHex", "agentIntent"]
    }
  }
}`;

const SDK_SNIPPET = `import { FirewallService } from '@mpc-firewall/core';

const firewall = new FirewallService();

export async function guardAgentTransaction(params: {
  chainKind: 'evm' | 'bitcoin';
  rawUnsignedHex: string;
  agentIntent: string;
}) {
  const record = await firewall.inspectAndDispatch(params);

  if (record.decision.outcome === 'APPROVED_FOR_MPC_SIGN') {
    return { approved: true, mpcDispatch: record.mpcDispatch };
  }
  if (record.decision.outcome === 'ESCALATE_TO_DAO') {
    return { approved: false, needsTeamVote: true, daoProposal: record.daoProposalPayload };
  }
  return { approved: false, blockedReasons: record.decision.reasons };
}`;

const CONTRACT_DEPLOY = `near contract deploy <your-firewall>.testnet \\
  use-file contracts/mpc-firewall/target/wasm32-unknown-unknown/release/mpc_firewall.wasm \\
  with-init-call new json-args '{
    "owner": "<owner>.testnet",
    "mpc_signer_contract": "v1.signer-prod.testnet",
    "derivation_path": "ethereum,agent-treasury-1",
    "policy": {
      "authorized_agents": ["<agent>.testnet"],
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
      "max_daily_btc_sats": 500000,
      "allowed_btc_scripts": ["00141111111111111111111111111111111111111111"],
      "dao_account": "mpc-firewall-council.sputnikv2.testnet"
    }
  }' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' \\
  sign-as <your-firewall>.testnet network-config testnet sign-with-keychain send`;

function OverviewContent() {
  return (
    <>
      <section id="the-problem" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-[#1F3CFF]" />
          <h2 className="text-xl font-bold text-[#0B0F17]">The Blind-Signing Problem</h2>
        </div>
        <p className="text-sm leading-relaxed text-[#4A5568]">
          NEAR Chain Signatures lets an AI agent control wallets on Base, Ethereum, Arbitrum, and Bitcoin through a single NEAR account (<code className="font-mono text-xs text-[#0B0F17]">v1.signer</code>). That creates a critical blind spot: NEAR Function Call Keys can check which NEAR contract an agent calls, <strong>but <code className="font-mono text-xs text-[#0B0F17]">v1.signer.sign</code> only sees a scrambled 32-byte hash</strong>.
        </p>
        <p className="text-sm leading-relaxed text-[#4A5568]">
          Think of it like asking a security guard to approve a locked metal briefcase by looking at its serial number. If a prompt injection tricks your AI agent into slipping an unlimited token drain or attacker payout inside an Ethereum transaction before hashing it, standard MPC signers cannot see inside and sign it blindly.
        </p>
      </section>

      <section id="how-it-works" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">How MpcFirewall Solves It</h2>
        <p className="text-sm leading-relaxed text-[#4A5568]">
          MpcFirewall flips the order of operations: <strong>your AI agent never sends a pre-hashed digest to <code className="font-mono text-xs text-[#0B0F17]">v1.signer</code>.</strong> Instead, it submits the <strong>raw unsigned transaction bytes</strong> to the <code className="font-mono text-xs text-[#0B0F17]">mpc-firewall.testnet</code> smart contract, which unpacks the bytes on-chain, enforces your spending rules, computes the hash itself, and only then asks MPC to sign.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2]/60 p-4">
            <div className="font-mono text-[11px] font-bold uppercase text-[#BE123C]">
              Without MpcFirewall
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#4A5568]">
              Agent builds transaction → Hashes it off-chain → Sends 32 blind bytes to <code className="font-mono">v1.signer</code> → Wallet drained if compromised.
            </p>
          </div>
          <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-4">
            <div className="font-mono text-[11px] font-bold uppercase text-[#065F46]">
              With MpcFirewall
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#4A5568]">
              Agent sends raw unsigned bytes → Contract X-rays recipients, methods &amp; caps → Optionally audits intent in NEAR AI TEE → Hashes &amp; signs only if safe.
            </p>
          </div>
        </div>
      </section>

      <section id="three-outcomes" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#1F3CFF]" />
          <h2 className="text-xl font-bold text-[#0B0F17]">Three Clear Outcomes</h2>
        </div>
        <p className="text-sm text-[#4A5568]">
          Every transaction your agent proposes routes automatically into one of three predictable lanes:
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-4">
            <div className="font-mono text-xs font-bold text-[#059669]">1. Auto-Sign</div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#334155]">
              Safe routine payments (e.g., ≤ 100 USDC to a whitelisted vendor) are signed automatically in seconds with no human bottleneck.
            </p>
          </div>
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB]/70 p-4">
            <div className="font-mono text-xs font-bold text-[#D97706]">2. Team Vote</div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#334155]">
              Legitimate larger bills (e.g., 250 USDC) pause safely and create a SputnikDAO proposal so your human team can approve or reject.
            </p>
          </div>
          <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2]/70 p-4">
            <div className="font-mono text-xs font-bold text-[#E11D48]">3. Blocked (\$0 Signed)</div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#334155]">
              Blank-check approvals, sneaky nested calls, unapproved scripts, or intent lies are rejected on the spot before any signature exists.
            </p>
          </div>
        </div>
      </section>

      <section id="pick-path" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Start Integrating</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              href: '/docs/on-chain',
              badge: 'Production Security',
              title: 'On-Chain NEAR Contract',
              desc: 'Lock wallet authority directly to the contract so compromised prompts cannot bypass rules.'
            },
            {
              href: '/docs/http-api',
              badge: 'Fastest Setup',
              title: 'HTTP API & Tool Schema',
              desc: 'Guard any Python, LangGraph, CrewAI, or TypeScript agent via POST /api/inspect.'
            },
            {
              href: '/docs/sdk',
              badge: 'Embedded Node/TS',
              title: 'TypeScript SDK',
              desc: 'Import decoders, caps, and TEE auditing directly inside your agent tool handler.'
            }
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col justify-between rounded-xl border border-[#DCE2EE] bg-[#F8FAFC] p-4 transition-colors hover:border-[#1F3CFF] hover:bg-[#EEF2FF]/40"
            >
              <div>
                <span className="inline-block rounded-full bg-[#EEF2FF] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#1F3CFF]">
                  {card.badge}
                </span>
                <div className="mt-2.5 text-sm font-bold text-[#0B0F17]">{card.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-[#4A5568]">{card.desc}</p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#1F3CFF]">
                Read guide <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function FeaturesContent() {
  return (
    <>
      <section id="raw-byte-xray" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-[#1F3CFF]" />
          <h2 className="text-xl font-bold text-[#0B0F17]">Raw-Byte Decoding (Zero Blind Signing)</h2>
        </div>
        <p className="text-sm leading-relaxed text-[#4A5568]">
          Instead of trusting a label written by the AI model, both our Rust smart contract and TypeScript SDK parse the actual binary transaction envelope byte-for-byte. Even if a benign call hides a malicious sub-call inside a router batch, MpcFirewall unwraps nested instructions recursively (up to depth 3) so traps have nowhere to hide:
        </p>
        <ul className="space-y-1.5 text-xs leading-relaxed text-[#334155]">
          <li>• <strong>EVM Chains (Base, Ethereum, Arbitrum):</strong> Parses EIP-1559, EIP-2930, and Legacy RLP transactions, verifying exact chain ID, recipient, fee exposure (<code className="font-mono">value + gas * maxFeePerGas</code>), ERC-20 transfers/approvals/permits, NFT approvals, nested <code className="font-mono">multicall</code> batches, Gnosis Safe <code className="font-mono">execTransaction</code> (blocking hidden <code className="font-mono">DELEGATECALL</code>), Uniswap Permit2, and UniversalRouter sweeps.</li>
          <li>• <strong>Bitcoin SegWit (BIP-143):</strong> Unpacks transaction outputs, checks satoshi amounts and destination output scripts (<code className="font-mono">P2WPKH</code>, <code className="font-mono">P2PKH</code>, <code className="font-mono">P2SH</code>, <code className="font-mono">P2WSH</code>, <code className="font-mono">P2TR</code>), and computes real per-input BIP-143 sighash preimages.</li>
        </ul>
      </section>

      <section id="spend-caps" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#059669]" />
          <h2 className="text-xl font-bold text-[#0B0F17]">Per-TX &amp; 24h Cumulative Spend Caps</h2>
        </div>
        <p className="text-sm leading-relaxed text-[#4A5568]">
          A single small cap isn&apos;t enough—a compromised agent can try draining a treasury slowly by sending 90 USDC a hundred times in a row, or swapping a Bitcoin address under the per-TX limit repeatedly. MpcFirewall enforces <strong>both</strong> per-transaction ceilings and rolling 24-hour daily accumulators across ERC-20 tokens, native ETH/Base gas value, and Bitcoin satoshis—with automatic rollback if a remote MPC signature fails.
        </p>
      </section>

      <section id="ai-lie-detector" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-[#1F3CFF]" />
          <h2 className="text-xl font-bold text-[#0B0F17]">Confidential Intent-vs-Calldata Audit</h2>
        </div>
        <p className="text-sm leading-relaxed text-[#4A5568]">
          Rules alone catch malformed payloads, while <strong>NEAR AI Cloud TEE</strong> acts as a confidential semantic second opinion: it compares the agent&apos;s plain-English excuse (<em>&ldquo;Pay Alice \$25 for cloud hosting&rdquo;</em>) against the decoded bytes inside a private Trusted Execution Environment so proprietary trading or vendor prompts stay encrypted. If the story and the bytes disagree, the transaction is flagged <code className="font-mono text-xs text-[#BE123C]">CRITICAL</code>.
        </p>
      </section>

      <section id="dao-escalation" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#D97706]" />
          <h2 className="text-xl font-bold text-[#0B0F17]">Human Team Escalation via SputnikDAO</h2>
        </div>
        <p className="text-sm leading-relaxed text-[#4A5568]">
          Instead of forcing teams to choose between &ldquo;turn off safety limits&rdquo; and &ldquo;block legitimate work&rdquo;, medium-sized transactions that pass every security check automatically generate a ready-to-sign <strong>SputnikDAO / Trezu multisig proposal</strong> on <code className="font-mono text-xs text-[#0B0F17]">mpc-firewall-council.sputnikv2.testnet</code>. Once teammates vote yes, the contract releases the MPC signature.
        </p>
      </section>
    </>
  );
}

function QuickstartContent() {
  return (
    <>
      <section id="prerequisites" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Prerequisites &amp; Local Setup</h2>
        <p className="text-sm text-[#4A5568]">
          Requires Node.js <code className="font-mono text-xs text-[#0B0F17]">&gt;= 20</code> and{' '}
          <code className="font-mono text-xs text-[#0B0F17]">pnpm 10.x</code>. No API keys or wallet funds are required to run decoders, rules, or automated tests locally.
        </p>
        <CodeBlock title="Install & Run Web Console" lang="bash" code={QUICKSTART_INSTALL} />
      </section>

      <section id="run-suites" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Run Automated Test Suites</h2>
        <CodeBlock title="Verify TypeScript, E2E & Rust Smart Contract" lang="bash" code={QUICKSTART_TESTS} />
      </section>

      <section id="repo-structure" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5 text-[#1F3CFF]" />
          <h2 className="text-xl font-bold text-[#0B0F17]">Repository Layout</h2>
        </div>
        <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
          {[
            ['contracts/mpc-firewall/src/lib.rs', 'Rust NEAR smart contract + 17 unit tests (near-sdk 5.12.0)'],
            ['packages/core/src/', 'RLP/ABI/BTC decoders, policy engine, NEAR AI & 1Click clients, 29 tests'],
            ['apps/web/src/app/api/', 'Next.js REST endpoints (/inspect, /near/execute, /policy, /intents/*, /health)'],
            ['scripts/ & .github/workflows/ci.yml', 'CLI scenario verifier, HTTP E2E tests, and Ubuntu GitHub Actions CI']
          ].map(([path, desc]) => (
            <div key={path} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="font-mono font-bold text-[#0B0F17]">{path}</div>
              <div className="mt-1 text-[#4A5568]">{desc}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function OnChainContent() {
  return (
    <>
      <section id="key-scoping" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-[#1F3CFF]" />
          <h2 className="text-xl font-bold text-[#0B0F17]">1. Lock Down Agent Keys</h2>
        </div>
        <p className="text-sm text-[#4A5568]">
          In NEAR Chain Signatures, wallets are derived from the caller&apos;s account name. Bind your treasury to the firewall contract account (<code className="font-mono text-xs text-[#0B0F17]">mpc-firewall.testnet</code>), then give your agent a restricted key that can <em>only</em> call MpcFirewall entrypoints.
        </p>
        <CodeBlock title="Scope Key & Authorize Agent" lang="bash" code={ONCHAIN_SETUP} />
      </section>

      <section id="evm-signing" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">2. Sign EVM Transactions</h2>
        <p className="text-sm text-[#4A5568]">
          Serialize the unsigned EIP-1559 (or Legacy/EIP-2930) transaction using a fresh EVM <code className="font-mono text-xs text-[#0B0F17]">nonce</code> and unique <code className="font-mono text-xs text-[#0B0F17]">tx_id</code>, then pass the hex string on-chain.
        </p>
        <CodeBlock title="Send Raw Unsigned EIP-1559 TX On-Chain" lang="typescript" code={ONCHAIN_EVM} />
      </section>

      <section id="btc-signing" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">3. Sign Bitcoin SegWit (BIP-143)</h2>
        <p className="text-sm text-[#4A5568]">
          For P2WPKH inputs, attach <code className="font-mono text-xs text-[#0B0F17]">bip143</code> input metadata so the contract computes the exact Bitcoin SegWit sighash digest on-chain after verifying output scripts and satoshi caps.
        </p>
        <CodeBlock title="BIP-143 SegWit Signing Call" lang="typescript" code={ONCHAIN_BTC} />
      </section>

      <section id="rollback" className="scroll-mt-24 space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h2 className="text-base font-bold text-[#0B0F17]">Failure Rollback &amp; Team Voting</h2>
        <p className="text-xs leading-relaxed text-[#4A5568]">
          Every signature request registers <code className="font-mono">on_mpc_sign_complete</code>. If <code className="font-mono">v1.signer</code> fails or runs out of gas, daily token/ETH/BTC accumulators automatically revert. Medium spends above auto-approve limits park in <code className="font-mono">PendingDaoApproval</code> until <code className="font-mono">dao_approve_escalated(tx_id)</code> executes after a SputnikDAO vote.
        </p>
      </section>
    </>
  );
}

function HttpApiContent() {
  return (
    <>
      <section id="preflight-flow" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Pre-Flight Inspection Request</h2>
        <p className="text-sm text-[#4A5568]">
          Send any proposed transaction to <code className="font-mono text-xs text-[#0B0F17]">POST /api/inspect</code> before signing. The response tells your agent whether to proceed, escalate to the team DAO, or abort with exact human-readable reasons.
        </p>
        <CodeBlock title="Inspect & Gate Transaction" lang="typescript" code={HTTP_INSPECT} />
      </section>

      <section id="llm-tool-schema" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Ready-to-Use LLM Tool Schema</h2>
        <CodeBlock title="OpenAI / Anthropic / NEAR AI Function Schema" lang="json" code={TOOL_SCHEMA} />
      </section>

      <section id="rest-endpoints" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Available API Endpoints</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#DCE2EE] font-mono text-[11px] uppercase text-[#64748B]">
                <th className="py-2 pr-4">Route</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF1F7] text-[#334155]">
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">/api/inspect</td>
                <td className="py-2 pr-4 font-mono">POST</td>
                <td className="py-2">Decode raw EVM/BTC hex, evaluate policy + TEE audit, return dispatch or DAO proposal</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">/api/near/execute</td>
                <td className="py-2 pr-4 font-mono">POST</td>
                <td className="py-2">Broadcast <code className="font-mono">verify_and_sign_evm</code>, <code className="font-mono">verify_and_sign_btc_bip143</code>, or <code className="font-mono">dao_add_proposal</code> on Testnet (12 TX/min cap)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">/api/policy</td>
                <td className="py-2 pr-4 font-mono">GET / PATCH / POST</td>
                <td className="py-2">Read/patch spend rules or reset sandbox state (auth-gated when <code className="font-mono">REQUIRE_ADMIN_AUTH=true</code>)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">/api/intents/quote &amp; /tokens</td>
                <td className="py-2 pr-4 font-mono">POST / GET</td>
                <td className="py-2">Query live 1Click cross-chain swap tokens and dry quotes with explicit <code className="font-mono">depositType</code></td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">/api/near/account &amp; /health</td>
                <td className="py-2 pr-4 font-mono">GET</td>
                <td className="py-2">Check live <code className="font-mono">v1.signer-prod.testnet</code> key status and server config</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">/api/presets</td>
                <td className="py-2 pr-4 font-mono">GET</td>
                <td className="py-2">Fetch all 7 real-byte safe, escalation, and attack scenarios</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SdkContent() {
  return (
    <>
      <section id="firewall-service" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Drop-In Wallet Tool Guard</h2>
        <p className="text-sm text-[#4A5568]">
          In Node.js or TypeScript agent runtimes, import <code className="font-mono text-xs text-[#0B0F17]">FirewallService</code> from{' '}
          <code className="font-mono text-xs text-[#0B0F17]">@mpc-firewall/core</code>. Simultaneous calls queue automatically through an internal mutex so two parallel tool calls cannot race daily spend caps.
        </p>
        <CodeBlock title="Wrap an Agent Signing Tool" lang="typescript" code={SDK_SNIPPET} />
      </section>

      <section id="exported-primitives" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Individual SDK Functions</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[
            ['decodeUnsignedEvmTx', 'Decodes EIP-1559 / EIP-2930 / Legacy RLP + recursive ABI calldata'],
            ['decodeUnsignedBitcoinTx', 'Parses BTC outputs, script types & BIP-143 sighash preimages'],
            ['evaluateFirewallPolicy', 'Pure rule engine returning APPROVED / ESCALATE / BLOCKED + ERR_* codes'],
            ['runConfidentialTeeAudit', 'NEAR AI Cloud TEE intent-vs-calldata check with Ed25519 signature'],
            ['buildMpcDispatchPayload', 'Builds ready-to-submit contract call payloads for approved TXs'],
            ['authorizeAdminRequest', 'Constant-time header check for Bearer / x-admin-token secrets']
          ].map(([sym, desc]) => (
            <div key={sym} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="font-mono text-xs font-bold text-[#1F3CFF]">{sym}</div>
              <div className="mt-1 text-xs text-[#4A5568]">{desc}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ContractContent() {
  return (
    <>
      <section id="deploy-init" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-[#1F3CFF]" />
          <h2 className="text-xl font-bold text-[#0B0F17]">Deploy &amp; Initialize Command</h2>
        </div>
        <p className="text-sm text-[#4A5568]">
          Deploy an isolated contract account for your own organization or AI treasury with custom chain IDs, vendor allowlists, and spend thresholds:
        </p>
        <CodeBlock title="Deploy & Initialize Your Own Instance" lang="bash" code={CONTRACT_DEPLOY} />
      </section>

      <section id="contract-methods" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Smart Contract Method Reference</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#DCE2EE] font-mono text-[11px] uppercase text-[#64748B]">
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">Who Can Call</th>
                <th className="py-2">Behavior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF1F7] text-[#334155]">
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">new(...)</td>
                <td className="py-2 pr-4 font-mono">Deployer (#[init])</td>
                <td className="py-2">Sets owner, MPC signer contract, derivation path, and <code className="font-mono">OnChainPolicy</code></td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">verify_and_sign_evm(raw_unsigned_tx_hex, tx_id)</td>
                <td className="py-2 pr-4 font-mono">Authorized Agent / DAO / Owner</td>
                <td className="py-2">Decodes EVM RLP + ABI recursively, enforces rules/caps, hashes keccak256, calls <code className="font-mono">v1.signer.sign</code></td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">verify_and_sign_btc_bip143(raw_unsigned_btc_hex, tx_id, bip143)</td>
                <td className="py-2 pr-4 font-mono">Authorized Agent / DAO / Owner</td>
                <td className="py-2">Checks BTC scripts &amp; caps, computes BIP-143 sighash preimage, calls <code className="font-mono">v1.signer.sign</code></td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">verify_and_sign_btc(raw_unsigned_btc_hex, tx_id)</td>
                <td className="py-2 pr-4 font-mono">Authorized Agent / DAO / Owner</td>
                <td className="py-2">Checks BTC caps/scripts and signs raw double-SHA256 digest</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">dao_approve_escalated(tx_id)</td>
                <td className="py-2 pr-4 font-mono">DAO / Owner</td>
                <td className="py-2">Dispatches a queued <code className="font-mono">PendingDaoApproval</code> request after SputnikDAO vote</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">add_authorized_agent / remove_authorized_agent / update_policy</td>
                <td className="py-2 pr-4 font-mono">Owner / DAO</td>
                <td className="py-2">Updates allowed agent accounts and active policy limits</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">get_policy() / get_escalated_tx(tx_id)</td>
                <td className="py-2 pr-4 font-mono">Anyone (View)</td>
                <td className="py-2">Reads live policy rules or escalated transaction status</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">on_mpc_sign_complete(...)</td>
                <td className="py-2 pr-4 font-mono">Contract Only (#[private])</td>
                <td className="py-2">Rolls back daily spend accumulators if <code className="font-mono">v1.signer</code> fails</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SecurityContent() {
  return (
    <>
      <section id="decoder-coverage" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Supported Formats &amp; Honest Boundaries</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs leading-relaxed text-[#334155]">
            <div className="font-bold text-[#0B0F17]">Supported Calldata &amp; Envelopes</div>
            <p className="mt-1.5">
              EVM EIP-1559, EIP-2930, and Legacy RLP; ERC-20 (<code className="font-mono">transfer</code>, <code className="font-mono">approve</code>, <code className="font-mono">increaseAllowance</code>, <code className="font-mono">transferFrom</code>, <code className="font-mono">permit</code>), <code className="font-mono">setApprovalForAll</code>, nested <code className="font-mono">multicall</code> (depth ≤ 3), Gnosis Safe <code className="font-mono">execTransaction</code>, Uniswap Permit2 &amp; UniversalRouter (<code className="font-mono">V3_SWAP_EXACT_IN</code> / <code className="font-mono">SWEEP</code>), and Bitcoin P2WPKH/P2PKH/P2SH/P2WSH/P2TR + BIP-143.
            </p>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs leading-relaxed text-[#334155]">
            <div className="font-bold text-[#0B0F17]">Fail-Closed Boundary (No Silent Pass)</div>
            <p className="mt-1.5">
              If an agent calls a custom DeFi contract whose 4-byte selector is not in the supported decoder set, MpcFirewall classifies it as <code className="font-mono">UNKNOWN_CONTRACT_CALL</code> and rejects it by default rather than letting unknown bytes slip through (<code className="font-mono">allowUnknownSelectors: false</code>).
            </p>
          </div>
        </div>
      </section>

      <section id="default-caps" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Default Policy Limits</h2>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 font-mono text-xs leading-relaxed text-[#0B0F17]">
          Allowed Chains: Base (8453), Base Sepolia (84532), Arbitrum (42161), Ethereum Sepolia (11155111)<br />
          Tokens: Auto-sign ≤ 100 USDC • Max per TX: 500 USDC • Daily cap: 1,000 USDC<br />
          Native Gas: Auto-sign ≤ 0.1 ETH • Max per TX: 0.5 ETH • Daily cap: 1.0 ETH (includes max fee bribe guard)<br />
          Bitcoin: Max output 100,000 sats • Daily cap: 500,000 sats
        </div>
      </section>

      <section id="hardening-env" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Production Environment Flags</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#DCE2EE] font-mono text-[11px] uppercase text-[#64748B]">
                <th className="py-2 pr-4">Variable</th>
                <th className="py-2">Behavior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF1F7] text-[#334155]">
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">REQUIRE_ADMIN_AUTH + MPC_FIREWALL_ADMIN_TOKEN</td>
                <td className="py-2">Locks <code className="font-mono">PATCH/POST /api/policy</code> behind constant-time Bearer / <code className="font-mono">x-admin-token</code> verification</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">NEARAI_API_KEY + STRICT_LIVE_TEE=true</td>
                <td className="py-2">Requires live NEAR AI Cloud TEE (<code className="font-mono">cloud-api.near.ai/v1</code>); fails closed with <code className="font-mono">ERR_TEE_UNAVAILABLE</code> if unreachable</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">NEAR_INTENTS_BASE_URL / NEAR_INTENTS_API_KEY</td>
                <td className="py-2">Configures 1Click quote requests with explicit <code className="font-mono">CONFIDENTIAL_INTENTS</code> or <code className="font-mono">INTENTS</code> routing</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono font-semibold text-[#0B0F17]">MPC_FIREWALL_DATA_DIR</td>
                <td className="py-2">Custom directory for persistent runtime state (defaults to <code className="font-mono">.mpc-firewall-data</code> locally, <code className="font-mono">os.tmpdir()</code> on Netlify)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="operational-notes" className="scroll-mt-24 space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h2 className="text-base font-bold text-[#0B0F17]">Replay Guard &amp; Hosting Notes</h2>
        <p className="text-xs leading-relaxed text-[#334155]">
          On-chain, <code className="font-mono">processed_tx_ids</code> and <code className="font-mono">processed_payloads</code> block replaying identical signed bytes (<code className="font-mono">ERR_REPLAY_DETECTED</code>). Note that stateless serverless deployments (like Netlify) store Node-side counters inside <code className="font-mono">os.tmpdir()</code>; production teams should enforce spend caps primarily via the deployed NEAR smart contract or attach persistent storage via <code className="font-mono">MPC_FIREWALL_DATA_DIR</code>.
        </p>
      </section>

      <section id="error-codes" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-[#E11D48]" />
          <h2 className="text-xl font-bold text-[#0B0F17]">Violation Error Codes</h2>
        </div>
        <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
          {[
            'ERR_INVALID_RAW_TX',
            'ERR_CHAIN_ID_NOT_ALLOWED',
            'ERR_BLOCKED_ADDRESS',
            'ERR_UNAPPROVED_TARGET_CONTRACT',
            'ERR_UNAPPROVED_RECIPIENT',
            'ERR_UNLIMITED_APPROVAL',
            'ERR_APPROVAL_EXCEEDS_MAX',
            'ERR_SET_APPROVAL_FOR_ALL_BLOCKED',
            'ERR_DELEGATECALL_BLOCKED',
            'ERR_NESTED_MULTICALL_VIOLATION',
            'ERR_UNKNOWN_SELECTOR_BLOCKED',
            'ERR_NATIVE_VALUE_EXCEEDS_MAX',
            'ERR_DAILY_NATIVE_CAP_EXCEEDED',
            'ERR_DAILY_TOKEN_CAP_EXCEEDED',
            'ERR_BTC_OUTPUT_EXCEEDS_CAP',
            'ERR_DAILY_BTC_CAP_EXCEEDED',
            'ERR_BTC_UNAPPROVED_OUTPUT_SCRIPT',
            'ERR_REPLAY_DETECTED',
            'ERR_TEE_UNAVAILABLE',
            'ERR_TEE_CRITICAL_RISK'
          ].map((code) => (
            <span key={code} className="rounded border border-[#FECDD3] bg-[#FFF1F2] px-2 py-0.5 text-[#BE123C]">
              {code}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}

function ProofsContent() {
  return (
    <>
      <section id="testnet-deployments" className="scroll-mt-24 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#059669]" />
          <h2 className="text-xl font-bold text-[#0B0F17]">Deployed Contracts on NEAR Testnet</h2>
        </div>
        <p className="text-sm text-[#4A5568]">
          Nothing here is simulated-only: both the Rust MpcFirewall policy contract and the SputnikDAO multisig council are deployed and publicly inspectable on NEAR Testnet.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ['MpcFirewall Smart Contract (212,176 B WASM)', 'mpc-firewall.testnet', 'https://testnet.nearblocks.io/address/mpc-firewall.testnet'],
            ['SputnikDAO Security Council', 'mpc-firewall-council.sputnikv2.testnet', 'https://testnet.nearblocks.io/address/mpc-firewall-council.sputnikv2.testnet'],
            ['Initial Contract Deploy & Init TX', '3B94S9sB92jABvy2rYt4sZXiD4Rri47v3RpULScY3XQs', 'https://testnet.nearblocks.io/txns/3B94S9sB92jABvy2rYt4sZXiD4Rri47v3RpULScY3XQs'],
            ['Contract WASM Upgrade TX', '9pp1YBVfDw1Ve3Fx24YZCHPTJLiR8zNYsJ9D3C2puNMn', 'https://testnet.nearblocks.io/txns/9pp1YBVfDw1Ve3Fx24YZCHPTJLiR8zNYsJ9D3C2puNMn']
          ].map(([title, sub, href]) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl border border-[#DCE2EE] bg-[#F8FAFC] p-3.5 transition-colors hover:border-[#1F3CFF] hover:bg-[#EEF2FF]/40"
            >
              <div className="min-w-0 pr-2">
                <div className="text-xs font-bold text-[#0B0F17]">{title}</div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-[#4A5568]">{sub}</div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-[#1F3CFF]" />
            </a>
          ))}
        </div>
      </section>

      <section id="verified-txs" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Real Cross-Chain Signature Transactions</h2>
        <p className="text-sm text-[#4A5568]">
          Click any receipt below to verify live cross-contract calls from <code className="font-mono text-xs text-[#0B0F17]">mpc-firewall.testnet</code> into <code className="font-mono text-xs text-[#0B0F17]">v1.signer-prod.testnet</code> returning real ECDSA signatures, alongside real SputnikDAO escalation proposals:
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ['Live EVM MPC Signature TX', 'verify_and_sign_evm → v1.signer-prod.testnet (9CMZem...)', 'https://testnet.nearblocks.io/txns/9CMZemnkejMCCJHeUXHBtHp4A49T71aLyjoBBQ98ZxVN'],
            ['Live Bitcoin BIP-143 Signature TX', 'verify_and_sign_btc_bip143 → v1.signer-prod.testnet (4cQjHQ...)', 'https://testnet.nearblocks.io/txns/4cQjHQxoUHeEcJ1KquhE7aXsVWJt3mHBG8YGVLDcWZ31'],
            ['Live SputnikDAO add_proposal TX', 'mpc-firewall-council.sputnikv2.testnet (txUCaf...)', 'https://testnet.nearblocks.io/txns/txUCafGwPs9Fvm4xUomWBKyQiwNFkLeLMaEaYgqNrL2'],
            ['Council Policy Sync TX', 'Updated on-chain policy to council (7qLUD2...)', 'https://testnet.nearblocks.io/txns/7qLUD2NbyB4u4xGvcRTcW2bNEUGCwFJTT7AdDQJ5UYSt']
          ].map(([title, sub, href]) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/50 p-3.5 transition-colors hover:border-[#059669]"
            >
              <div className="min-w-0 pr-2">
                <div className="text-xs font-bold text-[#0B0F17]">{title}</div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-[#065F46]">{sub}</div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-[#059669]" />
            </a>
          ))}
        </div>
      </section>

      <section id="test-coverage" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-[#0B0F17]">Automated Test &amp; API Verification</h2>
        <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
          {[
            ['TypeScript Unit & Hardening Suites', '29 tests across 5 suites (RLP, BIP-143, Safe/Permit2/UniversalRouter, TEE fail-closed, replay & mutex race guards)'],
            ['Rust Smart Contract Suite', '17 unit tests in contracts/mpc-firewall compiled cleanly to wasm32-unknown-unknown via GitHub Actions CI'],
            ['Live NEAR AI Cloud TEE', 'Live attestation verified on https://mpc-firewall.netlify.app/api/health (mode: near-ai-live)'],
            ['Live NEAR Intents 1Click API', 'Live quote integration at POST /api/intents/quote against 1click.chaindefuser.com']
          ].map(([label, desc]) => (
            <div key={label} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="font-bold text-[#0B0F17]">{label}</div>
              <div className="mt-1 text-[#4A5568]">{desc}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function DocsArticle({ slug }: { slug: string }) {
  switch (slug) {
    case 'features':
      return <FeaturesContent />;
    case 'quickstart':
      return <QuickstartContent />;
    case 'on-chain':
      return <OnChainContent />;
    case 'http-api':
      return <HttpApiContent />;
    case 'sdk':
      return <SdkContent />;
    case 'contract':
      return <ContractContent />;
    case 'security':
      return <SecurityContent />;
    case 'proofs':
      return <ProofsContent />;
    default:
      return <OverviewContent />;
  }
}
