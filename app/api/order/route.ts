import { NextRequest, NextResponse } from 'next/server';
import { requestOrder } from '@/lib/jupiter';
import { SOL_MINT } from '@/lib/constants';

export const runtime = 'nodejs';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const inputMint = typeof body.inputMint === 'string' ? body.inputMint : '';
  const outputMint = typeof body.outputMint === 'string' ? body.outputMint : '';
  const taker = typeof body.taker === 'string' ? body.taker : '';
  const amount = typeof body.amount === 'string' ? body.amount : '';
  const slippageBps = Number(body.slippageBps ?? 100);
  if (!BASE58.test(inputMint) || !BASE58.test(outputMint) || !BASE58.test(taker) || inputMint === outputMint) {
    return NextResponse.json({ error: 'Wallet address or token mint is invalid.' }, { status: 400 });
  }
  if ((inputMint === SOL_MINT) === (outputMint === SOL_MINT)) {
    return NextResponse.json({ error: 'WELP swaps SOL with one token at a time.' }, { status: 400 });
  }
  if (!/^\d{1,22}$/.test(amount) || BigInt(amount) <= BigInt(0)) {
    return NextResponse.json({ error: 'Enter a valid positive amount.' }, { status: 400 });
  }
  if (inputMint === SOL_MINT && BigInt(amount) < BigInt(1_000_000)) {
    return NextResponse.json({ error: 'The minimum buy is 0.001 SOL.' }, { status: 400 });
  }
  if (inputMint === SOL_MINT && BigInt(amount) > BigInt(20_000_000)) {
    return NextResponse.json({ error: 'The maximum WELP entry is 0.02 SOL.' }, { status: 400 });
  }
  if (!Number.isInteger(slippageBps) || slippageBps < 10 || slippageBps > 300) {
    return NextResponse.json({ error: 'Slippage must be between 0.10% and 3.00%.' }, { status: 400 });
  }

  try {
    const order = await requestOrder({ inputMint, outputMint, amount, taker, slippageBps });
    if (typeof order.transaction !== 'string' || typeof order.requestId !== 'string') {
      return NextResponse.json({ error: 'Jupiter did not return a signable order.' }, { status: 502 });
    }
    return NextResponse.json({ ...order, taker }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Order request failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
