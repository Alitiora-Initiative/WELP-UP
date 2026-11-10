import { NextResponse } from 'next/server';
import { WELP_LAUNCHPAD_PROGRAM_ID } from '@/lib/launch-program';

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
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [WELP_LAUNCHPAD_PROGRAM_ID, { encoding: 'base64' }],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Solana RPC returned an error.');
    const payload = (await response.json()) as { result?: { value?: { owner?: string; executable?: boolean } | null }; error?: { message?: string } };
    if (payload.error) throw new Error(payload.error.message ?? 'Solana RPC returned an error.');
    const value = payload.result?.value ?? null;
    const owner = value?.owner ?? null;
    const executable = value?.executable === true;
    // Presence is insufficient: require an executable account owned by a known
    // Solana BPF loader and an explicit operator enable flag before unlocking.
    const programPresent = executable && BASE58.test(owner ?? '') && ACCEPTED_PROGRAM_LOADERS.has(owner ?? '');
    const deployed = programPresent && process.env.WELP_LAUNCHPAD_ENABLED === 'true';
    return NextResponse.json(
      {
        programId: WELP_LAUNCHPAD_PROGRAM_ID,
        deployed,
        executable,
        launchEnabled: deployed,
        detail: deployed
          ? 'Executable program detected and operator launch gate enabled; this is not an independent security audit.'
          : programPresent
            ? 'Executable program detected, but the launch rail remains disabled until reviewed deployment configuration enables it.'
            : 'No executable program is verified at the configured ID; custom launch is disabled.',
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
