export interface IntentsTokenInfo {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price?: number;
}

export interface IntentsQuotePreview {
  mode: 'near-intents-live' | 'near-intents-offline-fallback';
  depositType: 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  originAsset: string;
  destinationAsset: string;
  amount: string;
  confidentiality: 'none' | 'basic' | 'advanced';
  amountOut?: string;
  depositAddress?: string;
  raw?: unknown;
  error?: string;
}

export async function fetchIntentsTokens(): Promise<{
  live: boolean;
  tokens: IntentsTokenInfo[];
  error?: string;
}> {
  const baseUrl = process.env.NEAR_INTENTS_BASE_URL || 'https://1click.chaindefuser.com';
  try {
    const res = await fetch(`${baseUrl}/v0/tokens`, {
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as IntentsTokenInfo[];
    return { live: true, tokens: Array.isArray(data) ? data.slice(0, 50) : [] };
  } catch (err) {
    return {
      live: false,
      error: err instanceof Error ? err.message : 'Failed to reach 1Click API',
      tokens: [
        {
          assetId: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
          decimals: 6,
          blockchain: 'base',
          symbol: 'USDC'
        },
        {
          assetId: 'nep141:wrap.near',
          decimals: 24,
          blockchain: 'near',
          symbol: 'wNEAR'
        },
        {
          assetId: 'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near',
          decimals: 6,
          blockchain: 'arb',
          symbol: 'USDC'
        }
      ]
    };
  }
}

export async function previewIntentsQuote(params: {
  originAsset: string;
  destinationAsset: string;
  amount: string;
  recipient: string;
  refundTo: string;
  confidentiality?: 'none' | 'basic' | 'advanced';
}): Promise<IntentsQuotePreview> {
  const baseUrl = process.env.NEAR_INTENTS_BASE_URL || 'https://1click.chaindefuser.com';
  const apiKey = process.env.NEAR_INTENTS_API_KEY?.trim();
  const confidentiality = params.confidentiality ?? 'advanced';
  const depositType = apiKey && confidentiality === 'advanced' ? 'CONFIDENTIAL_INTENTS' : 'INTENTS';

  const body: Record<string, unknown> = {
    dry: true,
    swapType: 'EXACT_INPUT',
    depositType,
    originAsset: params.originAsset,
    destinationAsset: params.destinationAsset,
    amount: params.amount,
    recipient: params.recipient,
    recipientType: 'INTENTS',
    refundTo: params.refundTo,
    refundType: 'INTENTS',
    slippageTolerance: 100,
    deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  };

  if (confidentiality !== 'none' && apiKey) {
    body.confidentiality = confidentiality;
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const res = await fetch(`${baseUrl}/v0/quote`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(7000)
    });

    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.message || `HTTP ${res.status}`));
    }

    const quoteObj = (json.quote as Record<string, unknown>) || json;
    return {
      mode: 'near-intents-live',
      depositType,
      originAsset: params.originAsset,
      destinationAsset: params.destinationAsset,
      amount: params.amount,
      confidentiality: apiKey ? confidentiality : 'basic',
      amountOut: String(quoteObj.amountOut ?? ''),
      depositAddress: quoteObj.depositAddress ? String(quoteObj.depositAddress) : undefined,
      raw: json
    };
  } catch (err) {
    return {
      mode: 'near-intents-offline-fallback',
      depositType,
      originAsset: params.originAsset,
      destinationAsset: params.destinationAsset,
      amount: params.amount,
      confidentiality,
      error: err instanceof Error ? err.message : 'Quote unavailable offline'
    };
  }
}

