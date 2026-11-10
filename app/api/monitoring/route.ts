import { NextResponse } from 'next/server';
import { WELP_FEE_POLICY } from '@/lib/server/fee-policy';
import { EXECUTION_POLICY, executionReadiness } from '@/lib/server/execution-policy';
import { solanaRpc } from '@/lib/server/solana-rpc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const checkedAt = new Date().toISOString();
  const alerts: Array<{ level: 'critical' | 'warning'; code: string; message: string }> = [];
  const rpc = await solanaRpc<string>('getHealth').then((result) => result === 'ok').catch(() => false);
  if (!rpc) alerts.push({ level: 'critical', code: 'RPC_UNHEALTHY', message: 'Solana RPC health check failed.' });
  if (!EXECUTION_POLICY.privateRpcConfigured) alerts.push({ level: 'warning', code: 'PUBLIC_RPC', message: 'A private Solana RPC endpoint is not configured.' });
  if (!WELP_FEE_POLICY.collectionEnabled) alerts.push({ level: 'critical', code: 'FEE_ROUTE_DISABLED', message: 'Swap routes are fail-closed until the treasury referral destination is verified.' });
  const readiness = executionReadiness();
  for (const blocker of readiness.blockers) alerts.push({ level: 'warning', code: 'EXECUTION_GATE', message: blocker });
  return NextResponse.json({
    checkedAt,
    state: alerts.some((alert) => alert.level === 'critical') ? 'critical' : alerts.length ? 'warning' : 'healthy',
    alerts,
    heartbeat: { service: 'welp-up-api', checkedAt },
    execution: {
      maxSlippageBps: EXECUTION_POLICY.maxSlippageBps,
      maxPriorityFeeLamports: EXECUTION_POLICY.maxPriorityFeeLamports,
      maxDailyDrawdownBps: EXECUTION_POLICY.maxDailyDrawdownBps,
      maxAllocationBps: EXECUTION_POLICY.maxAllocationBps,
      readiness,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
