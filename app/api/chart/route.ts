import { type NextRequest, NextResponse } from 'next/server';
import {
  getProvider,
  listProviders,
  type ChartAggregate,
  type ChartTimeframe,
} from '@/lib/chart-providers';

export const dynamic = 'force-dynamic';

const INTERVALS: Record<string, { timeframe: ChartTimeframe; aggregate: ChartAggregate }> = {
  '1m': { timeframe: 'minute', aggregate: 1 },
  '5m': { timeframe: 'minute', aggregate: 5 },
  '15m': { timeframe: 'minute', aggregate: 15 },
  '1h': { timeframe: 'hour', aggregate: 1 },
  '4h': { timeframe: 'hour', aggregate: 4 },
  '1d': { timeframe: 'day', aggregate: 1 },
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mint = searchParams.get('mint') ?? '';
  const providerName = searchParams.get('provider') ?? 'dexscreener';
  const interval = searchParams.get('interval') ?? '5m';
  if (!mint) return NextResponse.json({ error: 'mint parameter required' }, { status: 400 });

  const provider = getProvider(providerName);
  if (!provider) {
    return NextResponse.json(
      { error: `Unknown chart source. Available: ${listProviders().join(', ')}` },
      { status: 400 },
    );
  }
  const selectedInterval = INTERVALS[interval];
  if (!selectedInterval) {
    return NextResponse.json({ error: 'Choose one of the supported intervals: 1m, 5m, 15m, 1h, 4h, or 1d.' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const result = await provider.fetchCandles(
    mint,
    now - 24 * 60 * 60,
    now,
    selectedInterval.timeframe,
    selectedInterval.aggregate,
  );

  if (result.status === 'error') {
    return NextResponse.json(
      { error: result.error ?? 'OHLCV provider error', source: result.source, fetchedAt: result.fetchedAt },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json({
    source: result.source,
    fetchedAt: result.fetchedAt,
    poolAddress: result.poolAddress,
    poolLiquidityUsd: result.poolLiquidityUsd,
    interval,
    candles: result.data ?? [],
    stale: result.status === 'stale',
    ageMs: result.ageMs ?? 0,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
