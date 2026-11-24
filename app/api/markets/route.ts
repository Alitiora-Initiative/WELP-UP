import { NextResponse } from 'next/server';
import { scoreToken } from '@/lib/market-scoring';
import { fetchDexScreenerCrossChecks } from '@/lib/dexscreener-cross-check';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FEED = 'https://api.jup.ag/tokens/v2/toporganicscore/24h?limit=100';
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
    liquidityUsd: null,
    liquidityReportedAssets: 0,
    volume24hUsd: null,
    volumeReportedAssets: 0,
    priceReportedAssets: 0,
    priceChangeReportedAssets: 0,
    marketIntegrity: { provider: 'DexScreener', state: 'unavailable', checkedAssets: 0, matchedAssets: 0, requestedAssets: 0, updatedAt: new Date().toISOString(), error },
    dataCoverage: { totalAssets: 0, coreScreeningCompleteAssets: 0, liquidityReportedAssets: 0, volumeReportedAssets: 0, priceReportedAssets: 0, priceChangeReportedAssets: 0 },
    assets: [],
  }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  const fetchedAt = new Date().toISOString();
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (process.env.JUPITER_API_KEY) headers['x-api-key'] = process.env.JUPITER_API_KEY;
    const [feedResponse, priceResponse] = await Promise.all([
      fetchWithRetry(FEED, headers),
      fetch(PRICE_FEED, { headers, next: { revalidate: 20 }, signal: AbortSignal.timeout(10_000) }),
    ]);
    if (!feedResponse.ok) return providerFailure('Jupiter market feed returned ' + feedResponse.status + '.');
    const payload: unknown = await feedResponse.json();
    if (!Array.isArray(payload)) return providerFailure('Jupiter returned an unexpected market-feed format.');

    const assets = payload.map(scoreToken).filter((asset) => asset.mint.length > 0);
    if (assets.length === 0) return providerFailure('Jupiter returned no valid market assets.');
    assets.sort((a, b) => b.score - a.score || (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1));
    // Independently compare the 30 highest-ranked rows. Cross-check data never changes
    // the primary provider's values, deterministic score, or eligibility decision.
    const marketIntegrity = await fetchDexScreenerCrossChecks(assets.slice(0, 30));
    const crossCheckedAssets = assets.map((asset) => ({
      ...asset,
      marketCrossCheck: marketIntegrity.records[asset.mint] ?? { provider: 'DexScreener' as const, state: 'not_checked' as const },
    }));
    const eligible = assets.filter((asset) => asset.eligible).length;
    const blocked = assets.filter((asset) => asset.state === 'Blocked').length;
    const watch = assets.filter((asset) => asset.state === 'Watch').length;
    const coreScreeningCompleteAssets = assets.filter((asset) => asset.screeningDataComplete).length;
    const liquidityReportedAssets = assets.filter((asset) => asset.liquidityUsd !== null).length;
    const volumeReportedAssets = assets.filter((asset) => asset.volume24hUsd !== null).length;
    const priceReportedAssets = assets.filter((asset) => asset.priceUsd !== null).length;
    const priceChangeReportedAssets = assets.filter((asset) => asset.priceChange24h !== null).length;
    const pricePayload = priceResponse.ok ? await priceResponse.json().catch(() => null) : null;
    const solPrice = Number(pricePayload?.[SOL_MINT]?.usdPrice ?? pricePayload?.data?.[SOL_MINT]?.price);
    const solPriceUsd = Number.isFinite(solPrice) && solPrice > 0 ? solPrice : null;
    const priceState = solPriceUsd === null ? 'Unavailable' : 'Operational';
    return NextResponse.json({
      source: 'Jupiter Tokens API v2',
      updatedAt: fetchedAt,
      observedAt: fetchedAt,
      freshness: { upstreamCacheSeconds: 30, note: 'Observed by WELP at this time; provider data may be served from the shared 30-second cache window.' },
      provider: { name: 'Jupiter Tokens API v2', state: 'Operational', access: process.env.JUPITER_API_KEY ? 'api-key' : 'keyless-limited', fetchedAt },
      priceProvider: { name: 'Jupiter Price API v3', state: priceState, fetchedAt, error: solPriceUsd === null ? 'SOL price was not returned.' : undefined },
      dataQuality: priceState === 'Operational' && coreScreeningCompleteAssets === assets.length ? 'complete' : 'partial',
      dataCoverage: {
        totalAssets: assets.length,
        coreScreeningCompleteAssets,
        liquidityReportedAssets,
        volumeReportedAssets,
        priceReportedAssets,
        priceChangeReportedAssets,
      },
      solPriceUsd,
      total: assets.length,
      eligible,
      blocked,
      watch,
      // Aggregates sum only values actually supplied by Jupiter. Counts make
      // incomplete coverage visible instead of coercing null fields to zero.
      liquidityUsd: liquidityReportedAssets ? assets.reduce((sum, asset) => sum + (asset.liquidityUsd ?? 0), 0) : null,
      liquidityReportedAssets,
      volume24hUsd: volumeReportedAssets ? assets.reduce((sum, asset) => sum + (asset.volume24hUsd ?? 0), 0) : null,
      volumeReportedAssets,
      priceReportedAssets,
      priceChangeReportedAssets,
      marketIntegrity: {
        provider: marketIntegrity.provider,
        state: marketIntegrity.state,
        checkedAssets: marketIntegrity.checkedAssets,
        matchedAssets: marketIntegrity.matchedAssets,
        requestedAssets: marketIntegrity.requestedAssets,
        updatedAt: marketIntegrity.updatedAt,
        error: marketIntegrity.error,
      },
      assets: crossCheckedAssets,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return providerFailure(error instanceof Error ? error.message : 'The Jupiter market feed could not be reached.');
  }
}
