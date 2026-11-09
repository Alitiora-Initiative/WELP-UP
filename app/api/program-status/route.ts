import { NextResponse } from 'next/server';
import { WELP_LAUNCHPAD_PROGRAM_ID } from '@/lib/launch-program';
import { address, getAddressEncoder } from '@solana/kit';
import { createHash } from 'node:crypto';
import { deriveTreasuryAddresses } from '@/lib/launch-program';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ACCEPTED_PROGRAM_LOADERS = new Set([
  'BPFLoaderUpgradeab1e11111111111111111111111',
  'BPFLoader2111111111111111111111111111111111',
]);

/**
 * Live mainnet deployment check for the WELP launchpad program. The custom
 * supply/decimals rail must stay disabled on the website until this program
 * returns a real on-chain owner, so no fake state is ever shown.
 */
export async function GET() {
  const endpoint = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  try {
    const { treasury, treasuryVault } = await deriveTreasuryAddresses();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getMultipleAccounts',
        params: [[WELP_LAUNCHPAD_PROGRAM_ID, treasury, treasuryVault], { encoding: 'base64', commitment: 'confirmed' }],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Solana RPC returned an error.');
    const payload = (await response.json()) as { result?: { value?: Array<{ owner?: string; executable?: boolean; lamports?: number; data?: [string, string] } | null> }; error?: { message?: string } };
    if (payload.error) throw new Error(payload.error.message ?? 'Solana RPC returned an error.');
    const [programInfo, treasuryInfo, vaultInfo] = payload.result?.value ?? [];
    const owner = programInfo?.owner ?? null;
    const executable = programInfo?.executable === true;
    // Presence is insufficient: require an executable account owned by a known
    // Solana BPF loader and an explicit operator enable flag before unlocking.
    const programPresent = executable && BASE58.test(owner ?? '') && ACCEPTED_PROGRAM_LOADERS.has(owner ?? '');
    const treasuryBytes = typeof treasuryInfo?.data?.[0] === 'string'
      ? Buffer.from(treasuryInfo.data[0], 'base64')
      : Buffer.alloc(0);
    const addressBytes = getAddressEncoder();
    const expectedDeveloper = addressBytes.encode(address('ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG'));
    const expectedVault = addressBytes.encode(treasuryVault);
    const expectedDiscriminator = createHash('sha256').update('account:TreasuryAccount').digest().subarray(0, 8);
    const treasuryInitialized = treasuryInfo?.owner === WELP_LAUNCHPAD_PROGRAM_ID &&
      treasuryBytes.length >= 106 &&
      treasuryBytes.subarray(0, 8).equals(expectedDiscriminator) &&
      treasuryBytes.subarray(8, 40).equals(Buffer.from(expectedDeveloper)) &&
      treasuryBytes.subarray(40, 72).equals(Buffer.from(expectedVault));
    const vaultInitialized = vaultInfo?.owner === '11111111111111111111111111111111' &&
      vaultInfo.executable !== true &&
      vaultInfo.lamports !== undefined && vaultInfo.lamports > 0 &&
      typeof vaultInfo.data?.[0] === 'string' && Buffer.from(vaultInfo.data[0], 'base64').length === 0;
    const deployed = programPresent;
    const launchEnabled = programPresent && treasuryInitialized && vaultInitialized && process.env.WELP_LAUNCHPAD_ENABLED === 'true';
    return NextResponse.json(
      {
        programId: WELP_LAUNCHPAD_PROGRAM_ID,
        deployed,
        executable,
        launchEnabled,
        treasuryInitialized,
        vaultInitialized,
        detail: launchEnabled
          ? 'Executable program, initialized treasury accounts, and operator launch gate verified. This is not an independent security audit.'
          : !programPresent
            ? 'No executable program is verified at the configured ID; custom launch is disabled.'
            : !treasuryInitialized || !vaultInitialized
              ? 'Executable program detected, but its treasury state and vault are not initialized or do not match the expected accounts; custom launch is disabled.'
              : 'Program and treasury accounts are verified, but the operator launch gate is off.',
        owner,
        checkedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      {
        programId: WELP_LAUNCHPAD_PROGRAM_ID,
        deployed: false,
        executable: false,
        launchEnabled: false,
        owner: null,
        checkedAt: new Date().toISOString(),
        error: 'Solana RPC was unreachable for the deployment check.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
