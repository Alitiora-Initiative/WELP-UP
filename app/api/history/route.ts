import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BASE58_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{40,100}$/;
const ALLOWED_LIMITS = new Set([10, 25, 50, 100]);

type SignatureRecord = {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized' | null;
};

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const owner = search.get('owner') ?? '';
  const limitValue = Number(search.get('limit') ?? '10');
  const before = search.get('before') ?? '';
  if (!BASE58_ADDRESS.test(owner)) return NextResponse.json({ error: 'Wallet address is invalid.' }, { status: 400 });
  if (!ALLOWED_LIMITS.has(limitValue)) return NextResponse.json({ error: 'Choose a page size of 10, 25, 50, or 100.' }, { status: 400 });
  if (before && !BASE58_SIGNATURE.test(before)) return NextResponse.json({ error: 'History cursor is invalid.' }, { status: 400 });

  try {
    const params: [string, { limit: number; commitment: 'confirmed'; before?: string }] = [owner, { limit: limitValue, commitment: 'confirmed' }];
    if (before) params[1].before = before;
    const response = await fetch(process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Solana RPC is temporarily unavailable.');
    const payload = await response.json();
    if (payload.error || !Array.isArray(payload.result)) throw new Error('Solana RPC could not load this wallet history.');
    const transactions = payload.result as SignatureRecord[];
    return NextResponse.json({
      transactions: transactions.map((transaction) => ({
        signature: transaction.signature,
        slot: transaction.slot,
        blockTime: transaction.blockTime,
        failed: transaction.err != null,
        confirmationStatus: transaction.confirmationStatus,
      })),
      hasMore: transactions.length === limitValue,
      nextBefore: transactions.length === limitValue ? transactions[transactions.length - 1].signature : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load wallet transaction history.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
