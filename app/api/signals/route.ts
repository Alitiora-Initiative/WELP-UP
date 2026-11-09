import { NextRequest, NextResponse } from 'next/server';
import { loadSignals } from '@/lib/signals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get('owner') ?? '';
  if (!BASE58.test(owner)) return NextResponse.json({ error: 'Connect a valid Solana wallet to load quoted signals.' }, { status: 400 });
  const updatedAt = new Date().toISOString();
  try {
    const signals = await loadSignals(owner);
    return NextResponse.json({
      signals,
      count: signals.length,
      eligibleCount: signals.filter((signal) => signal.eligible).length,
      updatedAt,
      provider: { name: 'GeckoTerminal + Jupiter Swap API v2', state: 'Operational', fetchedAt: updatedAt },
      dataQuality: 'complete',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load live signals.';
    return NextResponse.json({
      error: message,
      signals: [],
      count: 0,
      eligibleCount: 0,
      updatedAt,
      provider: { name: 'GeckoTerminal + Jupiter Swap API v2', state: 'Unavailable', error: message },
      dataQuality: 'unavailable',
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
