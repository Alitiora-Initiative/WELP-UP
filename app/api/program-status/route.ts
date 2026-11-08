import { NextResponse } from 'next/server';
import { WELP_LAUNCHPAD_PROGRAM_ID } from '@/lib/launch-program';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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
    const payload = (await response.json()) as { result?: { value?: { owner: string } | null } };
    const owner = payload.result?.value?.owner ?? null;
    // The BPF loader 21111111111111111111111111111111 owner confirms a real
    // deployed program, not a dormant or wallet-owned account.
    const deployed =
      BASE58.test(owner ?? '') && owner === '21111111111111111111111111111111';
    return NextResponse.json(
      {
        programId: WELP_LAUNCHPAD_PROGRAM_ID,
        deployed,
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
        owner: null,
        checkedAt: new Date().toISOString(),
        error: 'Solana RPC was unreachable for the deployment check.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
