import { NextResponse } from 'next/server';
import { scoreToken } from '@/lib/market-scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FEED = 'https://api.jup.ag/tokens/v2/toporganicscore/24h?limit=100';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const PRICE_FEED = `https://api.jup.ag/price/v2?ids=${SOL_MINT}`;

function providerFailure(error: string, status = 502) {
  return NextResponse.json({
    error,
    updatedAt: new Date().toISOString(),
    provider: { name: 'Jupiter Token API v2', state: 'Unavailable', error },
    dataQuality: 'unavailable',
    total: 0,
    eligible: 0,
    blocked: 0,
    assets: [],
  }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  const fetchedAt = new Date().toISOString();
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (process.env.JUPITER_API_KEY) headers['x-api-key'] = process.env.JUPITER_API_KEY;
    const [feedResponse, priceResponse] = await Promise.all([
      fetch(FEED, { headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) }),
      fetch(PRICE_FEED, { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) }),
    ]);
    if (!feedResponse.ok) return providerFailure('Jupiter market feed returned ' + feedResponse.status + '.');
    const payload: unknown = await feedResponse.json();
    if (!Array.isArray(payload)) return providerFailure('Jupiter returned an unexpected market-feed format.');

    const assets = payload.map(scoreToken).filter((asset) => asset.mint.length > 0);
    assets.sort((a, b) => b.score - a.score || b.liquidityUsd - a.liquidityUsd);
    const eligible = assets.filter((asset) => asset.eligible).length;
    const pricePayload = priceResponse.ok ? await priceResponse.json().catch(() => null) : null;
    const solPrice = Number(pricePayload?.data?.[SOL_MINT]?.price);
    const solPriceUsd = Number.isFinite(solPrice) && solPrice > 0 ? solPrice : null;
    const priceState = solPriceUsd === null ? 'Unavailable' : 'Operational';
    return NextResponse.json({
      source: 'Jupiter Token API v2',
      updatedAt: fetchedAt,
      provider: { name: 'Jupiter Token API v2', state: 'Operational', fetchedAt },
      priceProvider: { name: 'Jupiter Price API v2', state: priceState, fetchedAt, error: solPriceUsd === null ? 'SOL price was not returned.' : undefined },
      dataQuality: priceState === 'Operational' ? 'complete' : 'partial',
      solPriceUsd,
      total: assets.length,
      eligible,
      blocked: assets.length - eligible,
      liquidityUsd: assets.reduce((sum, asset) => sum + asset.liquidityUsd, 0),
      volume24hUsd: assets.reduce((sum, asset) => sum + asset.volume24hUsd, 0),
      assets,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return providerFailure(error instanceof Error ? error.message : 'The Jupiter market feed could not be reached.');
  }
}
