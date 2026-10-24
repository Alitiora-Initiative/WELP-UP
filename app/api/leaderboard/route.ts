import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// DEMO FIXTURE DATA — clearly labelled as fixture/demo until real indexer exists
// per blueprint: leaderboard requires on-chain settlement records from a real indexer
const FIXTURE_BOTS = [
  {
    rank: 1,
    botName: 'Grid Master Alpha',
    creator: 'Grider.sol',
    creatorAddress: 'GriDxyzABCdefghijklmnopqrstuvwxyz12345678',
    strategy: 'Structured Grid',
    feeBps: 1500,
    strategyVersion: 3,
    maxPositionBps: 200,
    maxSlippageBps: 100,
    requiredFundingLamports: 500_000_000,
    roi7d: 4.2,
    roi30d: 18.7,
    roiAllTime: 142.3,
    tvlSol: 1250.5,
    copierCount: 47,
    winRate: 68.4,
    isDemo: true,
  },
  {
    rank: 2,
    botName: 'DCA Steady',
    creator: 'DCABot.sol',
    creatorAddress: 'DCABotXyzABCdefghijklmnopqrstuvwxyz12345',
    strategy: 'DCA',
    feeBps: 500,
    strategyVersion: 1,
    maxPositionBps: 100,
    maxSlippageBps: 50,
    requiredFundingLamports: 200_000_000,
    roi7d: 1.8,
    roi30d: 9.2,
    roiAllTime: 67.5,
    tvlSol: 892.3,
    copierCount: 112,
    winRate: 73.1,
    isDemo: true,
  },
  {
    rank: 3,
    botName: 'Rebalance Pro',
    creator: 'BalanceKing.sol',
    creatorAddress: 'BalKingXyzABCdefghijklmnopqrstuvwxyz12345',
    strategy: 'Rebalance',
    feeBps: 800,
    strategyVersion: 2,
    maxPositionBps: 150,
    maxSlippageBps: 75,
    requiredFundingLamports: 1_000_000_000,
    roi7d: 3.1,
    roi30d: 12.4,
    roiAllTime: 89.0,
    tvlSol: 2100.0,
    copierCount: 28,
    winRate: 61.2,
    isDemo: true,
  },
];

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    disclaimer: 'Demo data — live leaderboard requires on-chain settlement records from an indexer. This data is fixture/demo only and does not represent real trading results.',
    bots: FIXTURE_BOTS,
    updatedAt: new Date().toISOString(),
  });
}
