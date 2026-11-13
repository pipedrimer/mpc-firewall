export interface NearRpcAccountCheck {
  ok: boolean;
  networkId: string;
  rpcUrl: string;
  accountId: string;
  exists: boolean;
  amountYocto?: string;
  codeHash?: string;
  mpcRootPublicKey?: string;
  firewallContractId?: string;
  firewallContractDeployed?: boolean;
  firewallCodeHash?: string;
  firewallAllowedChainIds?: number[];
  error?: string;
}

const EMPTY_CODE_HASH = '11111111111111111111111111111111';

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

async function nearJsonRpcWithFallback(
  rpcUrls: string[],
  method: string,
  params: Record<string, unknown>
): Promise<{ rpcUrl: string; data: Awaited<ReturnType<typeof nearJsonRpc>> }> {
  let lastErr: unknown;
  for (const url of rpcUrls) {
    try {
      const data = await nearJsonRpc(url, method, params);
      return { rpcUrl: url, data };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All NEAR RPC endpoints unreachable');
}

export async function inspectNearAccountAndSigner(
  accountId: string,
  signerContractId = process.env.MPC_SIGNER_CONTRACT_ID || 'v1.signer-prod.testnet',
  firewallContractId = process.env.MPC_FIREWALL_CONTRACT_ID || 'mpc-firewall.testnet'
): Promise<NearRpcAccountCheck> {
  const networkId = process.env.NEAR_NETWORK_ID || 'testnet';
  const rpcCandidates = Array.from(
    new Set(
      [
        process.env.NEAR_RPC_URL,
        'https://rpc.testnet.near.org',
        'https://test.rpc.fastnear.com'
      ].filter((u): u is string => Boolean(u && u.trim()))
    )
  );

  try {
    const { rpcUrl: activeRpc, data: accountRes } = await nearJsonRpcWithFallback(
      rpcCandidates,
      'query',
      {
        request_type: 'view_account',
        finality: 'final',
        account_id: accountId
      }
    );

    if (accountRes.error) {
      return {
        ok: true,
        networkId,
        rpcUrl: activeRpc,
        accountId,
        exists: false,
        error: accountRes.error.cause?.name || accountRes.error.message || 'Account not found'
      };
    }

    let mpcRootPublicKey: string | undefined;
    try {
      const pkRes = await nearJsonRpc(activeRpc, 'query', {
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

    let firewallCodeHash: string | undefined;
    let firewallContractDeployed = false;
    let firewallAllowedChainIds: number[] | undefined;
    try {
      const fwRes = await nearJsonRpc(activeRpc, 'query', {
        request_type: 'view_account',
        finality: 'final',
        account_id: firewallContractId
      });
      if (!fwRes.error && fwRes.result?.code_hash) {
        firewallCodeHash = String(fwRes.result.code_hash);
        firewallContractDeployed = firewallCodeHash !== EMPTY_CODE_HASH;
        if (firewallContractDeployed) {
          const polRes = await nearJsonRpc(activeRpc, 'query', {
            request_type: 'call_function',
            finality: 'final',
            account_id: firewallContractId,
            method_name: 'get_policy',
            args_base64: Buffer.from('{}', 'utf8').toString('base64')
          });
          const polBytes = polRes.result?.result;
          if (Array.isArray(polBytes)) {
            const parsed = JSON.parse(Buffer.from(polBytes as number[]).toString('utf8')) as {
              allowed_chain_ids?: number[];
            };
            if (Array.isArray(parsed.allowed_chain_ids)) {
              firewallAllowedChainIds = parsed.allowed_chain_ids;
            }
          }
        }
      }
    } catch {
      // Optional firewall probe
    }

    return {
      ok: true,
      networkId,
      rpcUrl: activeRpc,
      accountId,
      exists: true,
      amountYocto: String(accountRes.result?.amount ?? '0'),
      codeHash: String(accountRes.result?.code_hash ?? ''),
      mpcRootPublicKey,
      firewallContractId,
      firewallContractDeployed,
      firewallCodeHash,
      firewallAllowedChainIds
    };
  } catch (err) {
    return {
      ok: false,
      networkId,
      rpcUrl: rpcCandidates[0] || 'https://rpc.testnet.near.org',
      accountId,
      exists: false,
      error: err instanceof Error ? err.message : 'RPC unreachable'
    };
  }
}

