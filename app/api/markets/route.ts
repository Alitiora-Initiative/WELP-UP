import { NextRequest, NextResponse } from 'next/server';
import { scoreToken } from '@/lib/market-scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_API = 'https://api.jup.ag/tokens/v2';
const UNIVERSES = ['toporganicscore', 'toptrending', 'toptraded', 'recent'] as const;
const INTERVALS = ['5m', '1h', '6h', '24h'] as const;
type Universe = typeof UNIVERSES[number];
type Interval = typeof INTERVALS[number];

function marketFeedUrl(universe: Universe, interval: Interval) {
  return universe === 'recent'
    ? TOKEN_API + '/recent?limit=100'
    : TOKEN_API + '/' + universe + '/' + interval + '?limit=100';
}
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const PRICE_FEED = `https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`;

async function fetchWithRetry(url: string, headers: Record<string, string>, attempts = 2) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, { headers, next: { revalidate: 30 }, signal: AbortSignal.timeout(15_000) });
    if (response.ok || response.status !== 429 || attempt === attempts - 1) return response;
    await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
  }
  throw new Error('Jupiter market feed retry failed.');
}

function providerFailure(error: string, status = 502) {
  return NextResponse.json({
    error,
    updatedAt: new Date().toISOString(),
    provider: { name: 'Jupiter Tokens API v2', state: 'Unavailable', error },
    dataQuality: 'unavailable',
    total: 0,
    eligible: 0,
    blocked: 0,
    assets: [],
  }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  const requestedUniverse = request.nextUrl.searchParams.get('universe') ?? 'toporganicscore';
  const requestedInterval = request.nextUrl.searchParams.get('interval') ?? '24h';
  if (!(UNIVERSES as readonly string[]).includes(requestedUniverse)) {
    return NextResponse.json({ error: 'Unsupported market discovery feed.' }, { status: 400 });
  }
  if (!(INTERVALS as readonly string[]).includes(requestedInterval)) {
    return NextResponse.json({ error: 'Unsupported market discovery interval.' }, { status: 400 });
  }
  const universe = requestedUniverse as Universe;
  const interval = requestedInterval as Interval;
  const feedUrl = marketFeedUrl(universe, interval);
  const fetchedAt = new Date().toISOString();
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (process.env.JUPITER_API_KEY) headers['x-api-key'] = process.env.JUPITER_API_KEY;
    const [feedResponse, priceResponse] = await Promise.all([
      fetchWithRetry(feedUrl, headers),
      fetch(PRICE_FEED, { headers, next: { revalidate: 20 }, signal: AbortSignal.timeout(10_000) }),
    ]);
    if (!feedResponse.ok) return providerFailure('Jupiter market feed returned ' + feedResponse.status + '.');
    const payload: unknown = await feedResponse.json();
    if (!Array.isArray(payload)) return providerFailure('Jupiter returned an unexpected market-feed format.');

    const assets = payload.map(scoreToken).filter((asset) => asset.mint.length > 0);
    assets.sort((a, b) => b.score - a.score || (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1));
    const eligible = assets.filter((asset) => asset.eligible).length;
    const pricePayload = priceResponse.ok ? await priceResponse.json().catch(() => null) : null;
    const solPrice = Number(pricePayload?.[SOL_MINT]?.usdPrice ?? pricePayload?.data?.[SOL_MINT]?.price);
    const solPriceUsd = Number.isFinite(solPrice) && solPrice > 0 ? solPrice : null;
    const priceState = solPriceUsd === null ? 'Unavailable' : 'Operational';
    return NextResponse.json({
      source: 'Jupiter Tokens API v2',
      discovery: { universe, interval: universe === 'recent' ? null : interval, endpoint: feedUrl },
      updatedAt: fetchedAt,
      provider: { name: 'Jupiter Tokens API v2 · ' + universe, state: 'Operational', fetchedAt },
      priceProvider: { name: 'Jupiter Price API v3', state: priceState, fetchedAt, error: solPriceUsd === null ? 'SOL price was not returned.' : undefined },
      dataQuality: priceState === 'Operational' ? 'complete' : 'partial',
      solPriceUsd,
      total: assets.length,
      eligible,
      blocked: assets.length - eligible,
      liquidityUsd: assets.length > 0 && assets.every((asset) => asset.liquidityUsd !== null)
        ? assets.reduce((sum, asset) => sum + (asset.liquidityUsd ?? 0), 0) : null,
      volume24hUsd: assets.length > 0 && assets.every((asset) => asset.volume24hUsd !== null)
        ? assets.reduce((sum, asset) => sum + (asset.volume24hUsd ?? 0), 0) : null,
      assets,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return providerFailure(error instanceof Error ? error.message : 'The Jupiter market feed could not be reached.');
  }
}
