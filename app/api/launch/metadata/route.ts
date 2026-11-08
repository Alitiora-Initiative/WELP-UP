import { NextRequest, NextResponse } from 'next/server';
import { brandLaunchName, brandLaunchSymbol } from '@/lib/launch-branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mint = params.get('mint') ?? '';
  const name = brandLaunchName(params.get('name') ?? '');
  const symbol = brandLaunchSymbol(params.get('symbol') ?? '');
  const description = (params.get('description') ?? 'Launched through WELP UP on Solana mainnet.').trim().slice(0, 500);
  if (!BASE58.test(mint) || !name || !symbol) {
    return NextResponse.json({ error: 'Launch metadata parameters are invalid.' }, { status: 400 });
  }
  return NextResponse.json({
    name,
    symbol,
    description,
    image: 'https://welpup.fun/token-icon.png',
    website: 'https://welpup.fun',
    createdOn: 'https://welpup.fun',
    mint,
  }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
