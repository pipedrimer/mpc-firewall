import { buildPresetScenarios, getDefaultFirewallPolicy } from '@mpc-firewall/core';
import { HomeConsole } from '@/components/HomeConsole';

export default function HomePage() {
  const initialPresets = buildPresetScenarios();
  const initialPolicy = getDefaultFirewallPolicy();
  return <HomeConsole initialPresets={initialPresets} initialPolicy={initialPolicy} />;
}
