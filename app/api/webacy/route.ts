import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE = 'https://api.webacy.com';
const EVM_CHAINS = new Set(['eth', 'base', 'bsc', 'pol', 'opt', 'arb']);
const ADDRESS_CHAINS = new Set(['sol', ...EVM_CHAINS]);
const MARKET_CHAINS = new Set(['sol', ...EVM_CHAINS]);
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SOL_TRANSACTION = /^[1-9A-HJ-NP-Za-km-z]{32,120}$/;
const EVM_TRANSACTION = /^0x[a-fA-F0-9]{64}$/;

type JsonRecord = Record<string, unknown>;
type UpstreamResult = {
  state: 'available' | 'unavailable';
  status: number;
  data?: unknown;
  error?: string;
};

function validAddress(value: unknown, chain: string): value is string {
  if (typeof value !== 'string') return false;
  return chain === 'sol' ? BASE58.test(value) : EVM_ADDRESS.test(value);
}

function validTransaction(value: unknown, chain: string): value is string {
  if (typeof value !== 'string') return false;
  return chain === 'sol' ? SOL_TRANSACTION.test(value) : EVM_TRANSACTION.test(value);
}

function queryString(values: Record<string, string | boolean | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}

async function webacy(path: string, options: { method?: 'GET' | 'POST'; body?: JsonRecord } = {}): Promise<UpstreamResult> {
  try {
    const response = await fetch(API_BASE + path, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': process.env.WEBACY_API_KEY!,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        state: 'unavailable',
        status: response.status,
        error: response.status === 401 || response.status === 403
          ? 'Webacy rejected the API credential or its permissions.'
          : response.status === 429
            ? 'Webacy rate limit reached. Retry after the provider limit resets.'
            : response.status >= 500
              ? 'Webacy is temporarily unavailable.'
              : 'Webacy could not complete this check for the supplied input.',
      };
    }
    return { state: 'available', status: response.status, data };
  } catch (error) {
    return {
      state: 'unavailable',
      status: 502,
      error: error instanceof Error && error.name === 'TimeoutError'
        ? 'Webacy request timed out.'
        : 'Could not reach Webacy. Check the connection and try again.',
    };
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ provider: 'Webacy', error: message, updatedAt: new Date().toISOString() }, { status });
}

export async function POST(request: NextRequest) {
  if (!process.env.WEBACY_API_KEY) {
    return jsonError('Webacy is not configured on the server. Add WEBACY_API_KEY to the Vercel project environment.', 503);
  }

  let body: JsonRecord;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return jsonError('Invalid request body.', 400);
    body = parsed as JsonRecord;
  } catch {
    return jsonError('Invalid request body.', 400);
  }

  const action = typeof body.action === 'string' ? body.action : '';
  const chain = typeof body.chain === 'string' ? body.chain : 'sol';
  const address = body.address;
  const updatedAt = new Date().toISOString();

  if (action === 'token' || action === 'holders' || action === 'tokenPools' || action === 'contract') {
    const requiredChain = action === 'token' ? 'sol' : chain;
    if (action === 'token' && chain !== 'sol') return jsonError('The Webacy trading-lite endpoint currently supports Solana only.', 400);
    if (action === 'contract' && !EVM_CHAINS.has(chain)) return jsonError('Webacy contract analysis is available here for EVM chains only.', 400);
    if (action !== 'contract' && !MARKET_CHAINS.has(requiredChain)) return jsonError('Unsupported chain for this Webacy operation.', 400);
    if (!validAddress(address, requiredChain)) return jsonError('Enter a valid token, contract or mint address for the selected chain.', 400);

    let path = '';
    if (action === 'token') {
      path = '/trading-lite/' + encodeURIComponent(address) + '?' + queryString({ chain: 'sol', refreshCache: body.refreshCache === true });
    } else if (action === 'holders') {
      path = '/holder-analysis/' + encodeURIComponent(address) + '?' + queryString({ chain, useCache: true, maxHolders: 10000 });
    } else if (action === 'tokenPools') {
      path = '/tokens/' + encodeURIComponent(address) + '/pools?' + queryString({ chain });
    } else {
      path = '/contracts/' + encodeURIComponent(address) + '?' + queryString({ chain });
    }

    const result = await webacy(path);
    return NextResponse.json({ provider: 'Webacy', action, chain: requiredChain, updatedAt, ...result }, { status: result.state === 'available' ? 200 : result.status });
  }

  if (action === 'wallet') {
    if (!ADDRESS_CHAINS.has(chain)) return jsonError('Unsupported chain for wallet screening.', 400);
    if (!validAddress(address, chain)) return jsonError('Enter a valid wallet address for the selected chain.', 400);
    const encoded = encodeURIComponent(address);
    const jobs: Array<[string, Promise<UpstreamResult>]> = [
      ['threats', webacy('/addresses/' + encoded + '?' + queryString({ chain, show_low_risk: true }))],
      ['exposure', webacy('/quick-profile/' + encoded + '?' + queryString({ chain, withApprovals: true }))],
      ['sanctions', webacy('/addresses/sanctioned/' + encoded + '?' + queryString({ chain }))],
    ];
    if (EVM_CHAINS.has(chain)) {
      jobs.push(['approvals', webacy('/addresses/' + encoded + '/approvals?' + queryString({ chain }))]);
      jobs.push(['poisoning', webacy('/addresses/' + encoded + '/poisoning?' + queryString({ chain, useCache: true }))]);
    }
    const settled = await Promise.all(jobs.map(async ([key, promise]) => [key, await promise] as const));
    const results = Object.fromEntries(settled);
    const available = settled.some(([, result]) => result.state === 'available');
    return NextResponse.json({
      provider: 'Webacy',
      action,
      chain,
      updatedAt,
      results,
      unsupported: chain === 'sol' ? ['Standalone token-approval listing and address-poisoning scan are documented for EVM chains, so they were not called for this Solana wallet.'] : [],
      state: available ? 'partial_or_complete' : 'unavailable',
    }, { status: available ? 200 : 502 });
  }

  if (action === 'transaction') {
    if (!ADDRESS_CHAINS.has(chain)) return jsonError('Unsupported chain for transaction risk analysis.', 400);
    if (!validTransaction(body.transaction, chain)) return jsonError('Enter a valid transaction hash or Solana signature for the selected network.', 400);
    const result = await webacy('/transactions/' + encodeURIComponent(body.transaction) + '?' + queryString({ chain }));
    return NextResponse.json({ provider: 'Webacy', action, chain, updatedAt, ...result }, { status: result.state === 'available' ? 200 : result.status });
  }

  if (action === 'url') {
    if (typeof body.url !== 'string' || body.url.length > 2048) return jsonError('Enter a valid URL no longer than 2,048 characters.', 400);
    let url: URL;
    try { url = new URL(body.url); } catch { return jsonError('Enter a complete http or https URL.', 400); }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return jsonError('Only http and https URLs can be checked.', 400);
    const result = await webacy('/url', { method: 'POST', body: { url: url.toString() } });
    return NextResponse.json({ provider: 'Webacy', action, updatedAt, ...result }, { status: result.state === 'available' ? 200 : result.status });
  }

  if (action === 'pool') {
    if (!MARKET_CHAINS.has(chain)) return jsonError('Unsupported chain for pool analysis.', 400);
    if (!validAddress(address, chain)) return jsonError('Enter a valid liquidity pool address.', 400);
    const timeFrame = body.timeFrame === 'minute' || body.timeFrame === 'hour' ? body.timeFrame : 'day';
    const limit = Math.max(1, Math.min(100, Number.isInteger(body.limit) ? Number(body.limit) : 30));
    const result = await webacy('/tokens/pools/' + encodeURIComponent(address) + '?' + queryString({ chain, timeFrame, limit }));
    return NextResponse.json({ provider: 'Webacy', action, chain, updatedAt, ...result }, { status: result.state === 'available' ? 200 : result.status });
  }

  if (action === 'trendingTokens') {
    const result = await webacy('/tokens/trending');
    return NextResponse.json({ provider: 'Webacy', action, updatedAt, ...result }, { status: result.state === 'available' ? 200 : result.status });
  }

  if (action === 'trendingPools') {
    if (!MARKET_CHAINS.has(chain)) return jsonError('Unsupported chain for trending pool analysis.', 400);
    const result = await webacy('/tokens/pools/trending?' + queryString({ chain }));
    return NextResponse.json({ provider: 'Webacy', action, chain, updatedAt, ...result }, { status: result.state === 'available' ? 200 : result.status });
  }

  if (action === 'usage') {
    const result = await webacy('/usage/current');
    return NextResponse.json({ provider: 'Webacy', action, updatedAt, ...result }, { status: result.state === 'available' ? 200 : result.status });
  }

  return jsonError('Unknown Webacy operation.', 400);
}
