import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const SEARCH_URL = 'https://lite-api.jup.ag/tokens/v2/search';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2 || query.length > 64) {
    return NextResponse.json({ tokens: [] });
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.JUPITER_API_KEY) headers['x-api-key'] = process.env.JUPITER_API_KEY;
  try {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('query', query);
    const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return NextResponse.json({ error: 'Token search is temporarily unavailable.' }, { status: 502 });
    const data = await response.json();
    const rows = Array.isArray(data) ? data : Array.isArray(data?.tokens) ? data.tokens : [];
    const tokens = rows.slice(0, 8).flatMap((row: Record<string, unknown>) => {
      const mint = typeof row.id === 'string' ? row.id : typeof row.address === 'string' ? row.address : '';
      const decimals = Number(row.decimals);
      if (!mint || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return [];
      return [{
        mint,
        symbol: String(row.symbol || 'TOKEN').slice(0, 16),
        name: String(row.name || row.symbol || 'Token').slice(0, 64),
        decimals,
        logo: typeof row.icon === 'string' ? row.icon : null,
        price: Number.isFinite(Number(row.usdPrice)) ? Number(row.usdPrice) : null,
      }];
    });
    return NextResponse.json({ tokens }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Token search timed out. Please try again.' }, { status: 504 });
  }
}
