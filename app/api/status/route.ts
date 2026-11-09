import { NextResponse } from 'next/server';
import { getReferralFeeConfig, WELP_FEE_POLICY } from '@/lib/server/fee-policy';
import { checkReferralAccountReadiness } from '@/lib/server/referral-readiness';
import { WELP_LAUNCHPAD_PROGRAM_ID } from '@/lib/launch-program';
import { SOL_MINT } from '@/lib/constants';

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
async function checkJupiterSwapApi() {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.JUPITER_API_KEY) headers['x-api-key'] = process.env.JUPITER_API_KEY;
  const url = new URL('https://api.jup.ag/swap/v2/order');
  url.searchParams.set('inputMint', SOL_MINT);
  url.searchParams.set('outputMint', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  url.searchParams.set('amount', '1000000');
  url.searchParams.set('maxSupportedTransactionVersion', '0');
  const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Jupiter Swap API returned HTTP ${response.status}.`);
  if (!isRecord(data) || typeof data.outAmount !== 'string' || !/^\d+$/.test(data.outAmount)) {
    throw new Error('Jupiter Swap API did not return a quote-only SOL/USDC amount.');
  }
  return { name: 'Jupiter Swap API v2', state: 'Operational', detail: 'Quote-only SOL/USDC check succeeded; no transaction was assembled or signed.' };
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

async function checkTreasuryProgram() {
  const endpoint = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [WELP_LAUNCHPAD_PROGRAM_ID, { encoding: 'base64', commitment: 'confirmed' }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('RPC returned ' + response.status);
    const data: unknown = await response.json();
    const value = isRecord(data) && isRecord(data.result) && isRecord(data.result.value) ? data.result.value : null;
    const executable = value?.executable === true;
    return {
      name: 'Treasury program',
      state: executable ? 'Deployed; distribution not verified' : 'Not deployed',
      detail: executable
        ? 'The configured program account is executable. Treasury initialization, fee deposits and epoch payouts must be verified separately.'
        : 'The configured launch/treasury program account is not executable; no on-chain treasury PDA or epoch split is active.',
    };
  } catch {
    return { name: 'Treasury program', state: 'Unable to verify', detail: 'Treasury program deployment could not be verified from Solana RPC.' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function checkReferralFee() {
  const config = getReferralFeeConfig();
  if (config.kind === 'disabled') {
    return { name: 'Jupiter referral fees', state: 'Not configured', detail: WELP_FEE_POLICY.collectionDisabledReason };
  }
  if (config.kind === 'invalid') {
    return { name: 'Jupiter referral fees', state: 'Invalid configuration', detail: config.reason };
  }
  const readiness = await checkReferralAccountReadiness({ referralAccount: config.account, feeMint: SOL_MINT });
  if (readiness.kind === 'ready') {
    return {
      name: 'Jupiter referral fees',
      state: 'SOL fee account ready',
      detail: `The referral account and SOL token account are verified for a ${ (config.feeBps / 100).toFixed(2) }% Jupiter referral quote. Quotes verify their actual fee mint before signing. Fees are claimable by the configured referral partner; this is not the WELP treasury epoch split.`,
    };
  }
  return {
    name: 'Jupiter referral fees',
    state: readiness.kind === 'rpc_unavailable' ? 'Unable to verify' : 'Setup incomplete',
    detail: readiness.kind === 'rpc_unavailable'
      ? 'Solana RPC could not verify the referral account and token account.'
      : readiness.kind === 'token_account_missing'
        ? 'The referral account exists, but its SOL fee token account is not initialized.'
        : `Referral account setup failed verification: ${readiness.kind.replaceAll('_', ' ')}.`,
  };
}

export async function GET() {
  const checks = await Promise.all([
    checkSolana().catch((error) => ({ name: 'Solana mainnet RPC', state: 'Unavailable', detail: error instanceof Error ? error.message : 'RPC check failed' })),
    checkJupiter().catch((error) => ({ name: 'Jupiter Token API v2', state: 'Unavailable', detail: error instanceof Error ? error.message : 'Feed check failed' })),
    checkJupiterSwapApi().catch((error) => ({ name: 'Jupiter Swap API v2', state: 'Unavailable', detail: error instanceof Error ? error.message : 'Swap API check failed' })),
    checkVault(),
    checkCustomLaunchProgram(),
    checkTreasuryProgram(),
    Promise.resolve({ name: 'Autonomous agents', state: 'Not enabled', detail: 'No production executor or unattended trading runtime is configured.' }),
    checkReferralFee(),
  ]);
  const overall = checks.some((item) => item.state === 'Unavailable')
    ? 'Degraded · some checks unavailable'
    : 'Operational · limited features';
  return NextResponse.json({ updatedAt: new Date().toISOString(), overall, checks }, { headers: { 'Cache-Control': 'no-store' } });
}
