import { NextRequest, NextResponse } from 'next/server';
import { loadSignals } from '@/lib/signals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get('owner') ?? '';
  if (!BASE58.test(owner)) return NextResponse.json({ error: 'Connect a valid Solana wallet to load quoted signals.' }, { status: 400 });
  try {
    const signals = await loadSignals(owner);
    return NextResponse.json({ signals }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load live signals.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
