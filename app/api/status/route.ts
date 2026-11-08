import { NextResponse } from 'next/server';
import { WELP_FEE_POLICY } from '@/lib/server/fee-policy';
import { WELP_LAUNCHPAD_PROGRAM_ID } from '@/lib/launch-program';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function checkSolana() {
  const endpoint = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
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
  return { name: 'Solana mainnet RPC', state: 'Operational', detail: endpoint };
}
async function checkJupiter() {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.JUPITER_API_KEY) headers['x-api-key'] = process.env.JUPITER_API_KEY;
  const response = await fetch('https://lite-api.jup.ag/tokens/v2/toporganicscore/24h?limit=1', {
    headers, cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Jupiter returned ' + response.status);
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) throw new Error('Jupiter returned no token data');
  return { name: 'Jupiter Token API v2', state: 'Operational', detail: 'Live token feed reachable' };
}
async function checkVault() {
  const programId = process.env.WELP_VAULT_PROGRAM_ID || '';
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(programId)) {
    return { name: 'Vault program', state: 'Not configured', detail: 'No mainnet program address is configured. Funding remains disabled.' };
  }
  try {
    const response = await fetch(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [programId, { encoding: 'base64', commitment: 'confirmed' }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json();
    const executable = data?.result?.value?.executable === true;
    return { name: 'Vault program', state: executable ? 'Executable · audit still required' : 'Not deployed', detail: executable ? 'Program account is executable; this does not establish an independent audit or enable funding.' : 'Configured address did not return an executable program. Funding remains disabled.' };
  } catch {
    return { name: 'Vault program', state: 'Unable to verify', detail: 'Program status could not be confirmed. Funding remains disabled.' };
  }
}

/** Live mainnet deployment status of the WELP custom launchpad program. */
async function checkCustomLaunchProgram() {
  const programId = WELP_LAUNCHPAD_PROGRAM_ID;
  try {
    const response = await fetch(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [programId, { encoding: 'base64', commitment: 'confirmed' }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json();
    const value = data?.result?.value;
    const executable = value?.executable === true;
    const allowedLoader = ['BPFLoaderUpgradeab1e11111111111111111111111', 'BPFLoader2111111111111111111111111111111111'].includes(value?.owner ?? '');
    const enabled = executable && allowedLoader && process.env.WELP_LAUNCHPAD_ENABLED === 'true';
    return {
      name: 'Custom launch program',
      state: enabled ? 'Enabled by operator gate' : executable ? 'Executable; disabled' : 'Undeployed',
      detail: enabled
        ? 'Executable program and explicit operator gate detected. This is not an independent audit.'
        : 'Custom launch is disabled until an executable program and explicit operator gate are verified.',
    };
  } catch {
    return { name: 'Custom launch program', state: 'Unable to verify', detail: 'Custom launch program status could not be confirmed.' };
  }
}

export async function GET() {
  const checks = await Promise.all([
    checkSolana().catch((error) => ({ name: 'Solana mainnet RPC', state: 'Unavailable', detail: error instanceof Error ? error.message : 'RPC check failed' })),
    checkJupiter().catch((error) => ({ name: 'Jupiter Token API v2', state: 'Unavailable', detail: error instanceof Error ? error.message : 'Feed check failed' })),
    checkVault(),
    checkCustomLaunchProgram(),
    Promise.resolve({ name: 'Autonomous agents', state: 'Not enabled', detail: 'No production executor or unattended trading runtime is configured.' }),
    Promise.resolve({
      name: 'Fee routing',
      state: process.env.WELP_REFERRAL_ACCOUNT ? 'Jupiter referral configured' : 'Not configured',
      detail: process.env.WELP_REFERRAL_ACCOUNT
        ? `Jupiter referral fee is configured at ${(WELP_FEE_POLICY.swapFeeBps / 100).toFixed(2)}%; this is not atomic WELP on-chain fee enforcement.`
        : 'No Jupiter referral account is configured; no WELP swap fee is collected.',
    }),
  ]);
  const overall = checks.some((item) => item.state === 'Unavailable')
    ? 'Degraded · some checks unavailable'
    : 'Operational · limited features';
  return NextResponse.json({ updatedAt: new Date().toISOString(), overall, checks }, { headers: { 'Cache-Control': 'no-store' } });
}
