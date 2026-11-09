import { NextRequest, NextResponse } from 'next/server';
import { executeOrder } from '@/lib/jupiter';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const signedTransaction = typeof body.signedTransaction === 'string' ? body.signedTransaction : '';
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  if (!signedTransaction || signedTransaction.length > 100_000 || !/^[A-Za-z0-9_-]{8,256}$/.test(requestId)) {
    return NextResponse.json({ error: 'Signed order or order ID is invalid.' }, { status: 400 });
  }

  try {
    const result = await executeOrder(signedTransaction, requestId);
    if (result.status !== 'Success' || typeof result.signature !== 'string') {
      const providerMessage = [result.errorMessage, result.error, result.message]
        .find((value) => typeof value === 'string' && value.trim().length > 0);
      return NextResponse.json({
        error: typeof providerMessage === 'string' ? providerMessage.trim() : 'Jupiter did not confirm the swap.',
        status: typeof result.status === 'string' ? result.status : 'Failed',
        ...(typeof result.code === 'number' ? { code: result.code } : {}),
      }, { status: 502 });
    }
    return NextResponse.json({ status: result.status, signature: result.signature });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Jupiter could not submit this swap.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
