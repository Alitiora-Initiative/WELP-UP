import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const signedTransaction = typeof body.signedTransaction === 'string' ? body.signedTransaction : '';
  if (!signedTransaction || signedTransaction.length > 200_000 || !/^[A-Za-z0-9+/=]+$/.test(signedTransaction)) {
    return NextResponse.json({ error: 'Signed launch transaction is invalid.' }, { status: 400 });
  }
  try {
    const endpoint = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: [signedTransaction, { encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 3 }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) return NextResponse.json({ error: payload.error?.message ?? 'Solana RPC rejected the launch transaction.' }, { status: 502 });
    const signature = typeof payload.result === 'string' ? payload.result : '';
    if (!signature) return NextResponse.json({ error: 'Solana RPC did not return a transaction signature.' }, { status: 502 });
    return NextResponse.json({ signature, status: 'submitted' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'The signed launch transaction could not be submitted.' }, { status: 502 });
  }
}
