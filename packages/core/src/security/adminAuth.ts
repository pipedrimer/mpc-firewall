import crypto from 'node:crypto';

export interface AdminAuthOptions {
  adminToken?: string;
  requireAdminAuth?: boolean;
}

export interface AdminAuthResult {
  authorized: boolean;
  status: 200 | 401 | 503;
  reason?: string;
}

function constantTimeEquals(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB) && a.length === b.length;
}

export function extractBearerOrHeaderToken(headers: Headers): string {
  const headerToken = headers.get('x-admin-token')?.trim();
  if (headerToken) return headerToken;

  const auth = headers.get('authorization')?.trim() || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

export function authorizeAdminRequest(
  headers: Headers,
  options?: AdminAuthOptions
): AdminAuthResult {
  const configuredToken = (options?.adminToken ?? process.env.MPC_FIREWALL_ADMIN_TOKEN ?? '').trim();
  const requireAuth =
    options?.requireAdminAuth ?? process.env.REQUIRE_ADMIN_AUTH?.trim() === 'true';

  if (!configuredToken) {
    if (requireAuth) {
      return {
        authorized: false,
        status: 503,
        reason: 'REQUIRE_ADMIN_AUTH=true but MPC_FIREWALL_ADMIN_TOKEN is not configured.'
      };
    }
    return { authorized: true, status: 200 };
  }

  const provided = extractBearerOrHeaderToken(headers);
  if (!provided || !constantTimeEquals(provided, configuredToken)) {
    return {
      authorized: false,
      status: 401,
      reason: 'Missing or invalid admin credentials (provide Authorization: Bearer <token> or x-admin-token).'
    };
  }

  return { authorized: true, status: 200 };
}

