export interface DocPageMeta {
  slug: string; // '' for /docs overview
  href: string;
  category: 'Getting Started' | 'Integrate an Agent' | 'Reference & Verification';
  title: string;
  shortTitle: string;
  description: string;
  headings: { id: string; label: string }[];
}

export const DOC_PAGES: DocPageMeta[] = [
  {
    slug: '',
    href: '/docs',
    category: 'Getting Started',
    title: 'Why MpcFirewall Exists',
    shortTitle: 'Why MpcFirewall',
    description:
      'Give autonomous AI agents cross-chain spending power on Ethereum, Base, and Bitcoin without risking an empty wallet from prompt injection or blind signing.',
    headings: [
      { id: 'the-problem', label: 'The Blind-Signing Problem' },
      { id: 'how-it-works', label: 'How MpcFirewall Solves It' },
      { id: 'three-outcomes', label: 'Three Clear Outcomes' },
      { id: 'pick-path', label: 'Start Integrating' }
    ]
  },
  {
    slug: 'features',
    href: '/docs/features',
    category: 'Getting Started',
    title: 'Core Features & Capabilities',
    shortTitle: 'Core Features',
    description:
      'What MpcFirewall checks before any signature leaves NEAR—and why both deterministic rules and confidential AI auditing work together.',
    headings: [
      { id: 'raw-byte-xray', label: 'Raw-Byte Decoding (Zero Blind Signing)' },
      { id: 'spend-caps', label: 'Per-TX & 24h Cumulative Spend Caps' },
      { id: 'ai-lie-detector', label: 'Confidential Intent-vs-Calldata Audit' },
      { id: 'dao-escalation', label: 'Human Team Escalation via SputnikDAO' }
    ]
  },
  {
    slug: 'quickstart',
    href: '/docs/quickstart',
    category: 'Getting Started',
    title: 'Quickstart & Local Verification',
    shortTitle: 'Quickstart',
    description:
      'Clone the repository, start the local console with zero required API keys, and run all automated TypeScript and Rust verification suites.',
    headings: [
      { id: 'prerequisites', label: 'Prerequisites & Local Setup' },
      { id: 'run-suites', label: 'Run Automated Test Suites' },
      { id: 'repo-structure', label: 'Repository Layout' }
    ]
  },
  {
    slug: 'on-chain',
    href: '/docs/on-chain',
    category: 'Integrate an Agent',
    title: 'Direct On-Chain Contract Flow',
    shortTitle: 'On-Chain NEAR Contract',
    description:
      'Bind your agent wallet to MpcFirewall on NEAR so policy rules are enforced by the blockchain itself—even if the agent runtime is compromised.',
    headings: [
      { id: 'key-scoping', label: '1. Lock Down Agent Keys' },
      { id: 'evm-signing', label: '2. Sign EVM Transactions' },
      { id: 'btc-signing', label: '3. Sign Bitcoin SegWit (BIP-143)' },
      { id: 'rollback', label: 'Failure Rollback & Team Voting' }
    ]
  },
  {
    slug: 'http-api',
    href: '/docs/http-api',
    category: 'Integrate an Agent',
    title: 'HTTP Middleware & Agent Tool Schema',
    shortTitle: 'HTTP API & Tool Schema',
    description:
      'Add MpcFirewall in front of any Python, LangGraph, CrewAI, Eliza, or TypeScript agent using plain HTTP requests and standard LLM tool schemas.',
    headings: [
      { id: 'preflight-flow', label: 'Pre-Flight Inspection Request' },
      { id: 'llm-tool-schema', label: 'Ready-to-Use LLM Tool Schema' },
      { id: 'rest-endpoints', label: 'Available API Endpoints' }
    ]
  },
  {
    slug: 'sdk',
    href: '/docs/sdk',
    category: 'Integrate an Agent',
    title: 'TypeScript SDK (@mpc-firewall/core)',
    shortTitle: 'TypeScript SDK',
    description:
      'Embed raw transaction decoding, policy checks, and NEAR AI Cloud intent auditing directly inside Node.js or TypeScript agent tools.',
    headings: [
      { id: 'firewall-service', label: 'Drop-In Wallet Tool Guard' },
      { id: 'exported-primitives', label: 'Individual SDK Functions' }
    ]
  },
  {
    slug: 'contract',
    href: '/docs/contract',
    category: 'Reference & Verification',
    title: 'Deploying & Managing Your Contract',
    shortTitle: 'Contract Deploy & ABI',
    description:
      'Deploy your own dedicated MpcFirewall contract on NEAR with custom allowlists, spend thresholds, and DAO governance.',
    headings: [
      { id: 'deploy-init', label: 'Deploy & Initialize Command' },
      { id: 'contract-methods', label: 'Smart Contract Method Reference' }
    ]
  },
  {
    slug: 'security',
    href: '/docs/security',
    category: 'Reference & Verification',
    title: 'Policies, Boundaries & Hardening',
    shortTitle: 'Policy & Hardening',
    description:
      'Default spend limits, supported DeFi/Bitcoin formats, honest fail-closed boundaries, replay protection, and production environment flags.',
    headings: [
      { id: 'decoder-coverage', label: 'Supported Formats & Honest Boundaries' },
      { id: 'default-caps', label: 'Default Policy Limits' },
      { id: 'hardening-env', label: 'Production Environment Flags' },
      { id: 'operational-notes', label: 'Replay Guard & Hosting Notes' },
      { id: 'error-codes', label: 'Violation Error Codes' }
    ]
  },
  {
    slug: 'proofs',
    href: '/docs/proofs',
    category: 'Reference & Verification',
    title: 'Live Proofs & Verified Executions',
    shortTitle: 'Live Proofs & Audits',
    description:
      'Every claim backed by public NEAR Testnet transactions, deployed WASM hashes, SputnikDAO proposals, and automated CI test coverage.',
    headings: [
      { id: 'testnet-deployments', label: 'Deployed Contracts on NEAR Testnet' },
      { id: 'verified-txs', label: 'Real Cross-Chain Signature Transactions' },
      { id: 'test-coverage', label: 'Automated Test & API Verification' }
    ]
  }
];

export const DOC_CATEGORIES: DocPageMeta['category'][] = [
  'Getting Started',
  'Integrate an Agent',
  'Reference & Verification'
];

export function getDocPage(slug: string): DocPageMeta | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}

export function getAdjacentPages(slug: string) {
  const idx = DOC_PAGES.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: undefined, next: undefined };
  return {
    prev: idx > 0 ? DOC_PAGES[idx - 1] : undefined,
    next: idx < DOC_PAGES.length - 1 ? DOC_PAGES[idx + 1] : undefined
  };
}
