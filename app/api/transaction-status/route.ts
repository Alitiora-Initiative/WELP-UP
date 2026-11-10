import { NextRequest, NextResponse } from 'next/server';
import { getFinalizedSignatureStatus } from '@/lib/server/solana-rpc';

export const runtime = 'nodejs';

const BASE58_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{80,100}$/;

export async function GET(request: NextRequest) {
  const signature = request.nextUrl.searchParams.get('signature')?.trim() || '';
  if (!BASE58_SIGNATURE.test(signature)) {
    return NextResponse.json({ error: 'A valid Solana transaction signature is required.' }, { status: 400 });
  }
  try {
    const status = await getFinalizedSignatureStatus(signature);
    return NextResponse.json({ ...status, reconciledAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Transaction status could not be reconciled.' }, { status: 502 });
  }
}
