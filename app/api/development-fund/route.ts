import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const recipient = 'ETuGxX6Znxr9q59THJtcYDJKt6RvCfN7wp79tRnbG1xG';
const goalLamports = 4_000_000_000;

export async function GET() {
  const endpoint = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [recipient, { commitment: 'confirmed' }] }),
      cache: 'no-store', signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error('Solana RPC returned an error.');
    const payload = await response.json() as { result?: { value?: number }; error?: { message?: string } };
    if (payload.error || !Number.isSafeInteger(payload.result?.value)) throw new Error(payload.error?.message ?? 'Balance response was invalid.');
    const lamports = payload.result!.value!;
    return NextResponse.json({ recipient, goalLamports, balanceLamports: lamports, progressBps: Math.min(10_000, Math.floor(lamports * 10_000 / goalLamports)), source: 'Solana confirmed account balance', checkedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ recipient, goalLamports, balanceLamports: null, progressBps: null, error: 'Donation balance is temporarily unavailable; no amount is being estimated.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
