import { NextResponse } from 'next/server';
import { fetchIntentsTokens } from '@mpc-firewall/core';

export async function GET() {
  const result = await fetchIntentsTokens();
  return NextResponse.json({ data: result });
}

