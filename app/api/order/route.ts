import { NextRequest, NextResponse } from 'next/server';
import { requestOrder } from '@/lib/jupiter';
import { SOL_MINT } from '@/lib/constants';
import { WELP_FEE_POLICY } from '@/lib/server/fee-policy';
import { EXECUTION_POLICY, validateSwapRisk } from '@/lib/server/execution-policy';
import { getWebacySolanaTokenScan } from '@/lib/server/webacy';
import { evaluateSolanaTokenScan } from '@/lib/server/webacy-policy';

export const runtime = 'nodejs';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(request: NextRequest) {
  // Never return a WELP-controlled order without an explicit referral destination.
  if (!WELP_FEE_POLICY.collectionEnabled) {
    return NextResponse.json({ error: 'WELP fee routing is not configured. Swaps are temporarily disabled until a referral account is configured.' }, { status: 503 });
  }
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
  // Fee destination and rate are server-owned; never accept browser overrides.
  const referralAccount = WELP_FEE_POLICY.referralAccount;
  const referralFeeBps = WELP_FEE_POLICY.referralFeeBps;
  if (referralAccount && !BASE58.test(referralAccount)) {
    return NextResponse.json({ error: 'Referral account is invalid.' }, { status: 400 });
  }
  if (referralAccount && (!Number.isInteger(referralFeeBps) || referralFeeBps < 50 || referralFeeBps > 255)) {
    return NextResponse.json({ error: 'Referral fee must be between 0.50% and 2.55%.' }, { status: 400 });
  }
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
  const riskError = validateSwapRisk({ inputMint, amount, slippageBps, solMint: SOL_MINT });
  if (riskError) {
    return NextResponse.json({ error: riskError, policy: { maxSlippageBps: EXECUTION_POLICY.maxSlippageBps, maxSolInputLamports: EXECUTION_POLICY.maxSolInputLamports } }, { status: 400 });
  }

  // A signable Jupiter order is never returned until Webacy Trading Lite
  // positively clears the non-SOL mint. Unknown provider results fail closed.
  const tokenMint = inputMint === SOL_MINT ? outputMint : inputMint;
  const webacyScan = await getWebacySolanaTokenScan(tokenMint);
  if (!webacyScan.ok) {
    return NextResponse.json(
      {
        error: 'WELP could not verify this token with Webacy. No signable swap order was created.',
        security: { provider: 'Webacy', state: 'unknown', reason: webacyScan.error },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const assessment = evaluateSolanaTokenScan(webacyScan.data);
  if (assessment.state !== 'allow') {
    return NextResponse.json(
      {
        error: assessment.reason || 'Webacy could not clear this token for swapping.',
        security: {
          provider: 'Webacy',
          state: assessment.state,
          riskScore: assessment.riskScore,
          isHoneypot: assessment.isHoneypot,
        },
      },
      { status: assessment.state === 'unknown' ? 503 : 422, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const order = await requestOrder({
      inputMint,
      outputMint,
      amount,
      taker,
      slippageBps,
      ...(referralAccount ? { referralAccount, referralFeeBps } : {}),
    });
    return NextResponse.json({
      ...order,
      taker,
      security: { provider: 'Webacy', state: 'passed', riskScore: assessment.riskScore, isHoneypot: false },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Order request failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
