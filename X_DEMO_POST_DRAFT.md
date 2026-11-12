# Draft X Demo Post (Edit & Publish Yourself)

Built **MpcFirewall** at **NEAR HACKATHON** — eliminating the 32-byte blind-signing vulnerability in NEAR Chain Signatures (`v1.signer`).

The unsolved problem on NEAR: Function Call Keys only constrain NEAR calls. When an AI agent signs Base, Arbitrum, or Bitcoin transactions via `v1.signer`, NEAR only sees a 32-byte hash — so an agent can smuggle `ERC20.approve(drainer, MaxUint256)` or a hidden `multicall` drain right past Function Call Keys.

How MpcFirewall fixes it:
- Contract-owned MPC derivation path (`mpc-firewall.testnet` -> `v1.signer-prod.testnet`)
- On-chain Rust RLP + ABI + nested `multicall` + Bitcoin output decoder
- Computes `keccak256` inside the NEAR contract after deterministic policy checks pass
- Confidential intent-vs-calldata audit in NEAR AI Cloud TEE
- Oversized valid txs escalate to Trezu / SputnikDAO multisig proposals

Watch MpcFirewall catch unlimited approvals, nested multicall drains, wrong-chain replays & BTC hijacks live:
[ATTACH 60-90s DEMO VIDEO / SCREENSHOTS]

Repo: https://github.com/<your-username>/mpc-firewall
#NEAR #NEARHACKATHON #ChainSignatures #AISecurity

