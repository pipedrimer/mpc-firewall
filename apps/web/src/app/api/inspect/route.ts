import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getFirewallService } from '@/lib/firewallRuntime';

const inspectSchema = z.object({
  chainKind: z.enum(['evm', 'bitcoin']),
  rawUnsignedHex: z.string().min(8),
  agentIntent: z.string().min(3).max(500)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = inspectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid inspection input', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const svc = getFirewallService();
    const record = await svc.inspectAndDispatch(parsed.data);
    return NextResponse.json({
      data: {
        record,
        dailyTokenSpentUnits: svc.getDailyTokenSpentUnits(),
        dailyNativeSpentWei: svc.getDailyNativeSpentWei()
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to inspect raw transaction';
    const isTxError = message.startsWith('ERR_');
    return NextResponse.json(
      { error: { code: isTxError ? 'INVALID_RAW_TX' : 'INSPECTION_ERROR', message } },
      { status: isTxError ? 422 : 500 }
    );
  }
}

