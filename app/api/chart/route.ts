import { type NextRequest, NextResponse } from 'next/server';
import { dexScreenerProvider, isValidMint } from '@/lib/chart-providers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const mint = request.nextUrl.searchParams.get('mint') ?? '';
  if (!isValidMint(mint)) {
    return NextResponse.json({ error: 'A valid Solana mint address is required.' }, { status: 400 });
  }

  const result = await dexScreenerProvider.fetchPair(mint);
  if (result.status === 'error' || !result.data) {
    return NextResponse.json(
      { error: result.error ?? 'DexScreener market data is unavailable.', source: result.source, fetchedAt: result.fetchedAt },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json({
    source: result.source,
    fetchedAt: result.fetchedAt,
    ...result.data,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
