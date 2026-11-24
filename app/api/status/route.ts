import { NextResponse } from 'next/server';
import { WELP_FEE_POLICY } from '@/lib/server/fee-policy';
import { WELP_LAUNCHPAD_PROGRAM_ID } from '@/lib/launch-program';
import { EXECUTION_POLICY, executionReadiness } from '@/lib/server/execution-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACCEPTED_PROGRAM_LOADERS = new Set([
  'BPFLoaderUpgradeab1e11111111111111111111111',
  'BPFLoader2111111111111111111111111111111111',
]);

async function checkSolana() {
  const hasDedicatedRpc = Boolean(process.env.SOLANA_RPC_URL?.trim());
  const endpoint = process.env.SOLANA_RPC_URL?.trim() || 'https://api.mainnet.solana.com';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('RPC returned ' + response.status);
  const data = await response.json();
  if (data.error || data.result !== 'ok') throw new Error('RPC did not report healthy');
  return {
    name: 'Solana mainnet RPC',
    state: hasDedicatedRpc ? 'Operational · dedicated RPC' : 'Not configured · shared public RPC only',
    detail: hasDedicatedRpc
      ? 'Configured RPC health check passed.'
      : 'The shared public RPC responded, but Solana documents public RPC as unsuitable for production applications. Configure a dedicated private RPC before production wallet and transaction traffic.',
  };
}

function checkWalletRpcConfiguration() {
  const clientEndpointConfigured = Boolean(process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim());
  return {
    name: 'Browser wallet RPC',
    state: clientEndpointConfigured ? 'Configured · public client endpoint' : 'Not configured · shared public RPC fallback',
    detail: clientEndpointConfigured
      ? 'A browser RPC endpoint is present in the build environment. Browser-side CORS, rate limits and transaction submission must still be tested from a real wallet session; the endpoint value is not exposed here.'
      : 'The browser wallet client falls back to Solana shared public RPC. Configure NEXT_PUBLIC_SOLANA_RPC_URL with an origin-restricted provider endpoint for production wallet reads and submissions.',
  };
}

async function checkJupiter() {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.JUPITER_API_KEY) headers['x-api-key'] = process.env.JUPITER_API_KEY;
  const response = await fetch('https://api.jup.ag/tokens/v2/toporganicscore/24h?limit=100', {
    headers, next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Jupiter returned ' + response.status);
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) throw new Error('Jupiter returned no token data');
  return { name: 'Jupiter Tokens API v2', state: process.env.JUPITER_API_KEY ? 'Operational · API key' : 'Operational · keyless limited rate', detail: process.env.JUPITER_API_KEY ? 'Live token feed reachable with a project API key.' : 'Live token feed reachable without a project key; Jupiter documents keyless access at 0.5 requests per second. Add a production API key for higher limits and usage visibility.' };
}
async function checkVault() {
  const programId = process.env.WELP_VAULT_PROGRAM_ID || '';
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(programId)) {
    return { name: 'Vault program', state: 'Not configured', detail: 'No mainnet program address is configured. Funding remains disabled.' };
  }
  try {
    const response = await fetch(process.env.SOLANA_RPC_URL || 'https://api.mainnet.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [programId, { encoding: 'base64', commitment: 'confirmed' }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('RPC returned ' + response.status);
    const data = await response.json();
    if (data?.error) throw new Error('RPC could not verify the program account.');
    const value = data?.result?.value;
    const executable = value?.executable === true && ACCEPTED_PROGRAM_LOADERS.has(value?.owner ?? '');
    return { name: 'Vault program', state: executable ? 'Executable · audit still required' : 'Not deployed', detail: executable ? 'Program account is executable under a supported loader; this does not establish an independent audit or enable funding.' : 'Configured address did not return a supported executable program. Funding remains disabled.' };
  } catch {
    return { name: 'Vault program', state: 'Unable to verify', detail: 'Program status could not be confirmed. Funding remains disabled.' };
  }
}

/** Live mainnet deployment status of the WELP custom launchpad program. */
async function checkCustomLaunchProgram() {
  const programId = WELP_LAUNCHPAD_PROGRAM_ID;
  try {
    const response = await fetch(process.env.SOLANA_RPC_URL || 'https://api.mainnet.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [programId, { encoding: 'base64', commitment: 'confirmed' }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('RPC returned ' + response.status);
    const data = await response.json();
    if (data?.error) throw new Error('RPC could not verify the program account.');
    const value = data?.result?.value;
    const executable = value?.executable === true;
    const allowedLoader = ['BPFLoaderUpgradeab1e11111111111111111111111', 'BPFLoader2111111111111111111111111111111111'].includes(value?.owner ?? '');
    const securityReviewed = process.env.WELP_LAUNCHPAD_SECURITY_REVIEWED === 'true';
    const enabled = executable && allowedLoader &&
      process.env.WELP_LAUNCHPAD_ENABLED === 'true' && securityReviewed;
    return {
      name: 'Custom launch program',
      state: enabled ? 'Enabled by operator gate' : executable ? 'Executable; disabled' : 'Undeployed',
      detail: enabled
        ? 'Executable program and explicit operator gate detected. This is not an independent audit.'
        : 'Custom launch is disabled until an executable program, deployment gate, and independent security-review gate are verified.',
    };
  } catch {
    return { name: 'Custom launch program', state: 'Unable to verify', detail: 'Custom launch program status could not be confirmed.' };
  }
}

export async function GET() {
  const checks = await Promise.all([
    checkSolana().catch((error) => ({ name: 'Solana server RPC', state: 'Unavailable', detail: error instanceof Error ? error.message : 'RPC check failed' })),
    Promise.resolve(checkWalletRpcConfiguration()),
    checkJupiter().catch((error) => ({ name: 'Jupiter Tokens API v2', state: 'Unavailable', detail: error instanceof Error ? error.message : 'Feed check failed' })),
    checkVault(),
    checkCustomLaunchProgram(),
    Promise.resolve({
      name: 'Execution safety rails',
      state: executionReadiness().ready ? 'Ready for operator review' : 'Blocked by safety prerequisites',
      detail: executionReadiness().blockers.join(' ') || `Private RPC configured; max slippage ${(EXECUTION_POLICY.maxSlippageBps / 100).toFixed(2)}%; max daily drawdown ${(EXECUTION_POLICY.maxDailyDrawdownBps / 100).toFixed(2)}%.`,
    }),
    Promise.resolve({ name: 'Autonomous agents', state: 'Not enabled', detail: 'No production executor or unattended trading runtime is configured.' }),
    Promise.resolve({
      name: 'Fee routing',
      state: WELP_FEE_POLICY.collectionEnabled ? 'Referral account configured · order validation required' : 'Not configured · swap routes disabled',
      detail: WELP_FEE_POLICY.collectionEnabled
        ? `Jupiter orders must include a ${(WELP_FEE_POLICY.referralFeeBps / 100).toFixed(2)}% referral fee before a quote is returned. Configuration shape is checked here; this is not WELP-program fee enforcement or 60/40 treasury settlement.`
        : WELP_FEE_POLICY.collectionDisabledReason,
    }),
  ]);
  const overall = checks.some((item) => item.state === 'Unavailable')
    ? 'Degraded · some checks unavailable'
    : checks.some((item) => item.state.includes('Blocked') || item.state.includes('Not configured') || item.state.includes('Undeployed'))
      ? 'Operational · execution blocked by safety gates'
      : 'Operational · limited features';
  return NextResponse.json({ updatedAt: new Date().toISOString(), overall, checks }, { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45' } });
}
