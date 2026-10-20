import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const TOKEN_PROGRAMS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];

async function rpc<T>(method: string, params: unknown[]) {
  const response = await fetch(process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error('Solana RPC unavailable');
  const payload = await response.json();
  if (payload.error) throw new Error('Solana RPC rejected the balance request');
  return payload.result as T;
}

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get('owner') ?? '';
  if (!BASE58.test(owner)) return NextResponse.json({ error: 'Wallet address is invalid.' }, { status: 400 });
  try {
    const [balance, accountResults] = await Promise.all([
      rpc<{ value: number }>('getBalance', [owner, { commitment: 'confirmed' }]),
      Promise.all(TOKEN_PROGRAMS.map((programId) => rpc<{ value: Array<{ account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmountString?: string } } } } } }> }>(
        'getTokenAccountsByOwner', [owner, { programId }, { encoding: 'jsonParsed', commitment: 'confirmed' }],
      ))),
    ]);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (process.env.JUPITER_API_KEY) headers['x-api-key'] = process.env.JUPITER_API_KEY;
    const priceUrl = new URL('https://lite-api.jup.ag/price/v3');
    priceUrl.searchParams.set('ids', SOL_MINT);
    const priceResponse = await fetch(priceUrl, { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!priceResponse.ok) throw new Error('Solana price is temporarily unavailable');
    const prices = await priceResponse.json();
    const solPrice = Number(prices?.[SOL_MINT]?.usdPrice);
    if (!Number.isFinite(solPrice) || solPrice <= 0) throw new Error('Solana price is temporarily unavailable');
    let stableUsd = 0;
    for (const result of accountResults) {
      for (const row of result.value ?? []) {
        const info = row.account?.data?.parsed?.info;
        if (info?.mint === USDC_MINT || info?.mint === USDT_MINT) stableUsd += Number(info.tokenAmount?.uiAmountString ?? 0);
      }
    }
    const sol = balance.value / 1_000_000_000;
    return NextResponse.json({ sol, solPrice, stableUsd, equityUsd: sol * solPrice + stableUsd }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read wallet balance.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
