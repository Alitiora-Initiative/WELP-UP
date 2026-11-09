import { NextRequest, NextResponse } from 'next/server';
import { requestOrder } from '@/lib/jupiter';
import { SOL_MINT } from '@/lib/constants';
import { getReferralFeeConfig } from '@/lib/server/fee-policy';
import { checkReferralAccountReadiness } from '@/lib/server/referral-readiness';

export const runtime = 'nodejs';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function feeSetupMessage(kind: string): string {
  switch (kind) {
    case 'referral_account_missing': return 'The configured Jupiter referral account is not present on Solana mainnet.';
    case 'wrong_referral_program': return 'The configured referral address is not owned by Jupiter’s referral program.';
    case 'mint_missing': return 'Jupiter selected a fee mint that does not exist on Solana mainnet.';
    case 'unsupported_token_program': return 'Jupiter selected a fee mint with an unsupported token program.';
    case 'token_account_missing': return 'The Jupiter referral token account for this quote’s fee mint has not been initialized.';
    case 'token_account_invalid': return 'The Jupiter referral token account for this quote has invalid mint or owner data.';
    case 'invalid_address': return 'The Jupiter quote returned an invalid referral account or fee mint.';
    default: return 'Solana RPC could not verify that the Jupiter referral fee account is ready.';
  }
}

export async function POST(request: NextRequest) {
  // Fee destinations and rate are server-owned; browser input cannot override them.
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
  const referralConfig = getReferralFeeConfig();
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

  const baseOrderParams = {
      inputMint,
      outputMint,
      amount,
      taker,
      slippageBps,
    };

  try {
    if (referralConfig.kind === 'disabled') {
      const order = await requestOrder(baseOrderParams);
      return NextResponse.json({ ...order, taker, welpReferral: { state: 'not_configured' } }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (referralConfig.kind === 'invalid') {
      const order = await requestOrder(baseOrderParams);
      return NextResponse.json({
        ...order,
        taker,
        welpReferral: { state: 'not_collected', reason: referralConfig.reason },
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    try {
      const order = await requestOrder({
        ...baseOrderParams,
        referralAccount: referralConfig.account,
        referralFeeBps: referralConfig.feeBps,
      });
      const returnedReferral = typeof order.referralAccount === 'string' ? order.referralAccount : '';
      const feeMint = typeof order.feeMint === 'string' ? order.feeMint : '';
      if (returnedReferral === referralConfig.account && BASE58.test(feeMint)) {
        const readiness = await checkReferralAccountReadiness({ referralAccount: referralConfig.account, feeMint });
        if (readiness.kind === 'ready') {
          return NextResponse.json({
            ...order,
            taker,
            welpReferral: {
              state: 'included',
              feeBps: referralConfig.feeBps,
              feeMint,
              tokenAccount: readiness.tokenAccount,
            },
          }, { headers: { 'Cache-Control': 'no-store' } });
        }
        const feeFreeOrder = await requestOrder(baseOrderParams);
        return NextResponse.json({
          ...feeFreeOrder,
          taker,
          welpReferral: { state: 'not_collected', reason: feeSetupMessage(readiness.kind) },
        }, { headers: { 'Cache-Control': 'no-store' } });
      }
    } catch {
      // A missing referral account must not make an otherwise available swap unusable.
      // The returned quote below is explicitly fee-free and labels the setup failure.
    }

    const feeFreeOrder = await requestOrder(baseOrderParams);
    return NextResponse.json({
      ...feeFreeOrder,
      taker,
      welpReferral: { state: 'not_collected', reason: 'Jupiter did not return a verifiable WELP referral quote.' },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Order request failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
