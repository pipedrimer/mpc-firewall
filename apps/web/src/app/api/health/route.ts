import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    data: {
      service: 'mpc-firewall',
      status: 'ok',
      nearNetworkId: process.env.NEAR_NETWORK_ID || 'testnet',
      nearRpcUrl: process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org',
      mpcSignerContractId: process.env.MPC_SIGNER_CONTRACT_ID || 'v1.signer-prod.testnet',
      firewallContractId: process.env.MPC_FIREWALL_CONTRACT_ID || 'mpc-firewall.testnet',
      nearAiMode: process.env.NEARAI_API_KEY ? 'near-ai-live' : 'local-verifiable-enclave',
      strictLiveTee: process.env.STRICT_LIVE_TEE === 'true',
      adminAuthEnabled: Boolean(
        process.env.MPC_FIREWALL_ADMIN_TOKEN?.trim() || process.env.REQUIRE_ADMIN_AUTH === 'true'
      ),
      intentsBaseUrl: process.env.NEAR_INTENTS_BASE_URL || 'https://1click.chaindefuser.com',
      timestamp: new Date().toISOString()
    }
  });
}
