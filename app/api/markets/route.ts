import { NextResponse } from 'next/server';
import { scoreToken } from '@/lib/market-scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FEED = 'https://api.jup.ag/tokens/v2/toporganicscore/24h?limit=100';

export async function GET() {
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (process.env.JUPITER_API_KEY) headers['x-api-key'] = process.env.JUPITER_API_KEY;
    const response = await fetch(FEED, {
      headers,
      cache: 'force-cache',
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Jupiter market feed returned ' + response.status + '.' }, { status: 502 });
    }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      return NextResponse.json({ error: 'Jupiter returned an unexpected market-feed format.' }, { status: 502 });
    }

    const assets = payload.map(scoreToken).filter((asset) => asset.mint.length > 0);
    assets.sort((a, b) => b.score - a.score || b.liquidityUsd - a.liquidityUsd);
    const eligible = assets.filter((asset) => asset.eligible).length;
    return NextResponse.json({
      source: 'Jupiter Token API v2',
      updatedAt: new Date().toISOString(),
      total: assets.length,
      eligible,
      blocked: assets.length - eligible,
      liquidityUsd: assets.reduce((sum, asset) => sum + asset.liquidityUsd, 0),
      volume24hUsd: assets.reduce((sum, asset) => sum + asset.volume24hUsd, 0),
      assets,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'The Jupiter market feed could not be reached.' }, { status: 502 });
  }
}
