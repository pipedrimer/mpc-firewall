import { NextResponse } from 'next/server';
import { z } from 'zod';
import { previewIntentsQuote } from '@mpc-firewall/core';

const quoteSchema = z.object({
  originAsset: z.string().min(4),
  destinationAsset: z.string().min(4),
  amount: z.string().regex(/^\d+$/),
  recipient: z.string().min(2),
  refundTo: z.string().min(2),
  confidentiality: z.enum(['none', 'basic', 'advanced']).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = quoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid quote request', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const quote = await previewIntentsQuote(parsed.data);
    return NextResponse.json({ data: quote });
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'QUOTE_ERROR', message: err instanceof Error ? err.message : 'Quote failed' } },
      { status: 500 }
    );
  }
}

