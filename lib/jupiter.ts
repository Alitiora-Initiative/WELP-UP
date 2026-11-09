import { SOL_MINT } from '@/lib/constants';

export { SOL_MINT };
const SWAP_BASE = 'https://api.jup.ag/swap/v2';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function headers(): HeadersInit {
  const result: Record<string, string> = { Accept: 'application/json' };
  if (process.env.JUPITER_API_KEY) result['x-api-key'] = process.env.JUPITER_API_KEY;
  return result;
}

export async function requestOrder(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  taker: string;
  slippageBps: number;
  referralAccount?: string;
  referralFeeBps?: number;
}) {
  const url = new URL(`${SWAP_BASE}/order`);
  url.searchParams.set('inputMint', params.inputMint);
  url.searchParams.set('outputMint', params.outputMint);
  url.searchParams.set('amount', params.amount);
  url.searchParams.set('taker', params.taker);
  url.searchParams.set('slippageBps', String(params.slippageBps));
  // Jupiter V2 returns v0 transactions by default; pin the supported ceiling.
  url.searchParams.set('maxSupportedTransactionVersion', '0');
  if (params.referralAccount) {
    url.searchParams.set('referralAccount', params.referralAccount);
    if (params.referralFeeBps !== undefined) url.searchParams.set('referralFee', String(params.referralFeeBps));
  }
  const response = await fetch(url, { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  const payload: unknown = await response.json().catch(() => null);
  const data = isRecord(payload) ? payload : null;
  const apiError = data
    ? [data.errorMessage, data.error, data.message].find((value) => typeof value === 'string' && value.trim().length > 0)
    : undefined;
  const errorMessage = typeof apiError === 'string' ? apiError.trim() : '';
  const hasErrorCode = data?.errorCode !== undefined && data.errorCode !== null && Number(data.errorCode) !== 0;
  if (!response.ok || !data || data.error || hasErrorCode || errorMessage) {
    const errorCode = data?.errorCode === undefined ? '' : `, code ${String(data.errorCode)}`;
    const message = `Jupiter order failed (HTTP ${response.status}${errorCode}): ${errorMessage || 'provider rejected this quote.'}`;
    throw new Error(message);
  }
  if (typeof data.transaction !== 'string' || !data.transaction.trim() || typeof data.requestId !== 'string' || !data.requestId.trim()) {
    throw new Error('Jupiter returned a quote without a signable transaction.');
  }
  return data;
}

export async function executeOrder(signedTransaction: string, requestId: string) {
  const response = await fetch(`${SWAP_BASE}/execute`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction, requestId }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  const data = isRecord(payload) ? payload : null;
  if (!response.ok || !data) {
    const providerMessage = data
      ? [data.errorMessage, data.error, data.message].find((value) => typeof value === 'string' && value.trim().length > 0)
      : undefined;
    const message = typeof providerMessage === 'string' ? providerMessage.trim() : 'provider rejected the signed order.';
    throw new Error(`Jupiter execution failed (HTTP ${response.status}): ${message}`);
  }
  return data;
}
