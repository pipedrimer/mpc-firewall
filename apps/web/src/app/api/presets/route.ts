import { NextResponse } from 'next/server';
import { buildPresetScenarios } from '@mpc-firewall/core';
import { getFirewallService } from '@/lib/firewallRuntime';

export async function GET() {
  const svc = getFirewallService();
  return NextResponse.json({
    data: {
      presets: buildPresetScenarios(),
      history: svc.getHistory(),
      policy: svc.getPolicy(),
      dailyTokenSpentUnits: svc.getDailyTokenSpentUnits()
    }
  });
}

