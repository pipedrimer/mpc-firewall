import path from 'node:path';
import { FirewallService } from '@mpc-firewall/core';

let instance: FirewallService | null = null;

export function getFirewallService(): FirewallService {
  if (!instance) {
    const dataDir =
      process.env.MPC_FIREWALL_DATA_DIR || path.join(process.cwd(), '..', '..', '.mpc-firewall-data');
    instance = new FirewallService({ dataDir });
  }
  return instance;
}

