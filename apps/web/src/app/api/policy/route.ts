import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeAdminRequest } from '@mpc-firewall/core';
import { getFirewallService } from '@/lib/firewallRuntime';

const policyPatchSchema = z.object({
  allowedChainIds: z.array(z.number().int().positive()).optional(),
  maxNativeValueWei: z.string().regex(/^\d+$/).optional(),
  autoApproveNativeValueWei: z.string().regex(/^\d+$/).optional(),
  maxDailyNativeWei: z.string().regex(/^\d+$/).optional(),
  maxTokenAmountUnits: z.string().regex(/^\d+$/).optional(),
  autoApproveTokenUnits: z.string().regex(/^\d+$/).optional(),
  maxDailyTokenUnits: z.string().regex(/^\d+$/).optional(),
  allowUnlimitedApprovals: z.boolean().optional(),
  allowSetApprovalForAll: z.boolean().optional(),
  allowUnknownSelectors: z.boolean().optional(),
  maxBtcOutputSats: z.string().regex(/^\d+$/).optional(),
  maxDailyBtcSats: z.string().regex(/^\d+$/).optional(),
  requireTeeRiskCheck: z.boolean().optional(),
  daoAccount: z.string().min(2).max(64).optional(),
  derivationPath: z.string().min(1).max(128).optional()
});

export async function GET() {
  const svc = getFirewallService();
  return NextResponse.json({
    data: {
      policy: svc.getPolicy(),
      dailyTokenSpentUnits: svc.getDailyTokenSpentUnits(),
      dailyNativeSpentWei: svc.getDailyNativeSpentWei()
    }
  });
}

export async function PATCH(request: Request) {
  const auth = authorizeAdminRequest(request.headers);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: { code: auth.status === 503 ? 'ADMIN_AUTH_UNCONFIGURED' : 'UNAUTHORIZED', message: auth.reason } },
      { status: auth.status }
    );
  }

  try {
    const body = await request.json();
    const parsed = policyPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid policy parameters', details: parsed.error.issues } },
        { status: 400 }
      );
    }
    const svc = getFirewallService();
    const updated = svc.updatePolicy(parsed.data);
    return NextResponse.json({
      data: {
        policy: updated,
        dailyTokenSpentUnits: svc.getDailyTokenSpentUnits(),
        dailyNativeSpentWei: svc.getDailyNativeSpentWei()
      }
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: err instanceof Error ? err.message : 'Invalid JSON' } },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const auth = authorizeAdminRequest(request.headers);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: { code: auth.status === 503 ? 'ADMIN_AUTH_UNCONFIGURED' : 'UNAUTHORIZED', message: auth.reason } },
      { status: auth.status }
    );
  }

  const svc = getFirewallService();
  const state = svc.resetDemoState();
  return NextResponse.json({ data: state });
}
