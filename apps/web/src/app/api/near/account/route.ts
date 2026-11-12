import { NextResponse } from 'next/server';
import { inspectNearAccountAndSigner } from '@mpc-firewall/core';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId =
    searchParams.get('accountId')?.trim() ||
    process.env.MPC_SIGNER_CONTRACT_ID ||
    'v1.signer-prod.testnet';

  const result = await inspectNearAccountAndSigner(accountId);
  return NextResponse.json({ data: result });
}

