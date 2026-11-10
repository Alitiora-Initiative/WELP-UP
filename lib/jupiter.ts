import { SOL_MINT } from '@/lib/constants';

export { SOL_MINT };
const SWAP_BASE = 'https://lite-api.jup.ag/swap/v2';

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
  if (params.referralAccount) {
    url.searchParams.set('referralAccount', params.referralAccount);
    if (params.referralFeeBps !== undefined) url.searchParams.set('referralFee', String(params.referralFeeBps));
  }
  const response = await fetch(url, { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  const data = await response.json().catch(() => null);
  const errorMessage = typeof data?.errorMessage === 'string' ? data.errorMessage.trim() : '';
  const hasErrorCode = data?.errorCode !== undefined && data.errorCode !== null && Number(data.errorCode) !== 0;
  if (!response.ok || !data || data.error || hasErrorCode || errorMessage) {
    const message = errorMessage || 'Jupiter could not create this order.';
    throw new Error(message);
  }
  if (typeof data.transaction !== 'string' || !data.transaction.trim() || typeof data.requestId !== 'string' || !data.requestId.trim()) {
    throw new Error('Jupiter returned a quote without a signable transaction.');
  }
  return data as Record<string, unknown>;
}

export async function executeOrder(signedTransaction: string, requestId: string) {
  const response = await fetch(`${SWAP_BASE}/execute`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction, requestId }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error('Jupiter could not submit the signed order.');
  return data as Record<string, unknown>;
}
