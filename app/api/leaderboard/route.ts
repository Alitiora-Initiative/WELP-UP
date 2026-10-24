import { NextResponse } from 'next/server';

/**
 * Leaderboard API — returns real on-chain settlement data only.
 * Returns an empty list until live vaults have settlement records.
 * No demo/fixture data is served to users.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    bots: [],
    totalVaults: 0,
    status: 'pending_mainnet',
    message:
      'Leaderboard activates once vaults go live after STRIDE security review. ' +
      'Rankings are sourced from verified on-chain settlement records only.',
  });
}
