import os from 'node:os';
import path from 'node:path';
import { FirewallService } from '@mpc-firewall/core';

let instance: FirewallService | null = null;

export function getFirewallService(): FirewallService {
  if (!instance) {
    const isServerless = Boolean(
      process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
    );
    const dataDir = isServerless
      ? path.join(os.tmpdir(), 'mpc-firewall-data')
      : process.env.MPC_FIREWALL_DATA_DIR?.trim() ||
        path.join(process.cwd(), '..', '..', '.mpc-firewall-data');
    instance = new FirewallService({ dataDir });
  }
  return instance;
}

