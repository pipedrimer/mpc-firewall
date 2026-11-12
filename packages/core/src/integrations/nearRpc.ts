export interface NearRpcAccountCheck {
  ok: boolean;
  networkId: string;
  rpcUrl: string;
  accountId: string;
  exists: boolean;
  amountYocto?: string;
  codeHash?: string;
  mpcRootPublicKey?: string;
  error?: string;
}

async function nearJsonRpc(rpcUrl: string, method: string, params: Record<string, unknown>) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'mpc-firewall',
      method,
      params
    }),
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) {
    throw new Error(`NEAR RPC HTTP ${res.status}`);
  }
  return (await res.json()) as {
    result?: Record<string, unknown>;
    error?: { message?: string; cause?: { name?: string } };
  };
}

export async function inspectNearAccountAndSigner(
  accountId: string,
  signerContractId = process.env.MPC_SIGNER_CONTRACT_ID || 'v1.signer-prod.testnet'
): Promise<NearRpcAccountCheck> {
  const networkId = process.env.NEAR_NETWORK_ID || 'testnet';
  const rpcUrl = process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';

  try {
    const accountRes = await nearJsonRpc(rpcUrl, 'query', {
      request_type: 'view_account',
      finality: 'final',
      account_id: accountId
    });

    if (accountRes.error) {
      return {
        ok: true,
        networkId,
        rpcUrl,
        accountId,
        exists: false,
        error: accountRes.error.cause?.name || accountRes.error.message || 'Account not found'
      };
    }

    let mpcRootPublicKey: string | undefined;
    try {
      const pkRes = await nearJsonRpc(rpcUrl, 'query', {
        request_type: 'call_function',
        finality: 'final',
        account_id: signerContractId,
        method_name: 'public_key',
        args_base64: Buffer.from('{}', 'utf8').toString('base64')
      });
      const rawBytes = pkRes.result?.result;
      if (Array.isArray(rawBytes)) {
        const text = Buffer.from(rawBytes as number[]).toString('utf8');
        mpcRootPublicKey = JSON.parse(text) as string;
      }
    } catch {
      // Optional view call
    }

    return {
      ok: true,
      networkId,
      rpcUrl,
      accountId,
      exists: true,
      amountYocto: String(accountRes.result?.amount ?? '0'),
      codeHash: String(accountRes.result?.code_hash ?? ''),
      mpcRootPublicKey
    };
  } catch (err) {
    return {
      ok: false,
      networkId,
      rpcUrl,
      accountId,
      exists: false,
      error: err instanceof Error ? err.message : 'RPC unreachable'
    };
  }
}

