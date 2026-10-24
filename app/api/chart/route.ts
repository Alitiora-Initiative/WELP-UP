import { type NextRequest, NextResponse } from 'next/server';
import { getProvider, listProviders, fetchWithFallback } from '@/lib/chart-providers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mint = searchParams.get('mint') ?? '';
  const providerParam = searchParams.get('provider');

  if (!mint) {
    return NextResponse.json({ error: 'mint parameter required' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const from = now - 24 * 3600; // 24h window
  const to = now;

  let result;
  if (providerParam) {
    const provider = getProvider(providerParam);
    if (!provider) {
      return NextResponse.json(
        { error: `Unknown provider: ${providerParam}. Available: ${listProviders().join(', ')}` },
        { status: 400 },
      );
    }
    result = await provider.fetchCandles(mint, from, to);
  } else {
    result = await fetchWithFallback(mint, from, to);
  }

  if (result.status === 'error') {
    return NextResponse.json(
      { error: result.error ?? 'Provider error', source: result.source, fetchedAt: result.fetchedAt },
      { status: 502 },
    );
  }

  return NextResponse.json({
    source: result.source,
    fetchedAt: result.fetchedAt,
    candles: result.data ?? [],
    stale: result.status === 'stale',
    ageMs: result.ageMs ?? 0,
  });
}
