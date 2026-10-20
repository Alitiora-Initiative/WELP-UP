import { SOL_MINT } from '@/lib/constants';

export { SOL_MINT };
const SWAP_BASE = 'https://api.jup.ag/swap/v2';

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
}) {
  const url = new URL(`${SWAP_BASE}/order`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.error || data.errorCode || data.errorMessage) {
    const message = typeof data?.errorMessage === 'string' ? data.errorMessage : 'Jupiter could not create this order.';
    throw new Error(message);
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
