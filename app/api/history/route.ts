import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BASE58_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{40,100}$/;
const ALLOWED_LIMITS = new Set([10, 25, 50, 100]);
const LAMPORTS_PER_SOL = 1_000_000_000;

type SignatureRecord = {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized' | null;
};
type TokenBalance = {
  owner?: string;
  mint: string;
  uiTokenAmount: { amount: string; decimals: number; uiAmountString?: string };
};
type TransactionDetail = {
  slot: number;
  blockTime: number | null;
  meta: {
    err: unknown;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
  } | null;
  transaction: {
    message: { accountKeys: Array<string | { pubkey: string; signer?: boolean }> };
  };
};

function keyString(key: string | { pubkey: string }) {
  return typeof key === 'string' ? key : key.pubkey;
}

async function rpc<T>(endpoint: string, method: string, params: unknown[]) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('Solana mainnet RPC returned HTTP ' + response.status);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'Solana RPC request failed');
  return payload.result as T;
}

function tokenDeltas(owner: string, detail: TransactionDetail) {
  const before = new Map<string, { amount: bigint; decimals: number }>();
  const after = new Map<string, { amount: bigint; decimals: number }>();
  for (const item of detail.meta?.preTokenBalances ?? []) {
    if (item.owner === owner) before.set(item.mint, { amount: BigInt(item.uiTokenAmount.amount), decimals: item.uiTokenAmount.decimals });
  }
  for (const item of detail.meta?.postTokenBalances ?? []) {
    if (item.owner === owner) after.set(item.mint, { amount: BigInt(item.uiTokenAmount.amount), decimals: item.uiTokenAmount.decimals });
  }
  const mints = new Set([...before.keys(), ...after.keys()]);
  return [...mints].map((mint) => {
    const pre = before.get(mint);
    const post = after.get(mint);
    const decimals = post?.decimals ?? pre?.decimals ?? 0;
    const raw = (post?.amount ?? 0n) - (pre?.amount ?? 0n);
    return { mint, decimals, rawDelta: raw.toString(), direction: raw > 0n ? 'received' : raw < 0n ? 'sent' : 'unchanged' };
  }).filter((item) => item.rawDelta !== '0');
}

function classify(nativeDelta: number, tokens: ReturnType<typeof tokenDeltas>) {
  const incoming = tokens.some((item) => item.direction === 'received');
  const outgoing = tokens.some((item) => item.direction === 'sent');
  if (incoming && outgoing) return 'Token activity / possible swap';
  if (incoming) return 'Token received';
  if (outgoing) return 'Token sent';
  if (nativeDelta > 0) return 'SOL received';
  if (nativeDelta < 0) return 'SOL sent or program interaction';
  return 'Program interaction';
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const owner = search.get('owner') ?? '';
  const limitValue = Number(search.get('limit') ?? '10');
  const before = search.get('before') ?? '';
  if (!BASE58_ADDRESS.test(owner)) return NextResponse.json({ error: 'Wallet address is invalid.' }, { status: 400 });
  if (!ALLOWED_LIMITS.has(limitValue)) return NextResponse.json({ error: 'Choose a page size of 10, 25, 50, or 100.' }, { status: 400 });
  if (before && !BASE58_SIGNATURE.test(before)) return NextResponse.json({ error: 'History cursor is invalid.' }, { status: 400 });

  try {
    const endpoint = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    const params: [string, { limit: number; commitment: 'confirmed'; before?: string }] = [owner, { limit: limitValue, commitment: 'confirmed' }];
    if (before) params[1].before = before;
    const signatures = await rpc<SignatureRecord[]>(endpoint, 'getSignaturesForAddress', params);

    // Decode confirmed transaction metadata in bounded parallel batches. Missing/pruned
    // transaction data stays explicitly unclassified; it is never inferred as a trade.
    const decoded = [];
    for (let offset = 0; offset < signatures.length; offset += 8) {
      const batch = signatures.slice(offset, offset + 8);
      decoded.push(...await Promise.all(batch.map(async (record) => {
      try {
        const detail = await rpc<TransactionDetail | null>(endpoint, 'getTransaction', [
          record.signature,
          { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
        ]);
        if (!detail?.meta) return { ...record, failed: record.err != null, type: 'Details unavailable', nativeDeltaLamports: null, nativeDeltaSol: null, feeLamports: null, tokenDeltas: [], detailsAvailable: false };
        const keys = detail.transaction.message.accountKeys.map(keyString);
        const ownerIndex = keys.indexOf(owner);
        const nativeDelta = ownerIndex >= 0
          ? (detail.meta.postBalances[ownerIndex] ?? 0) - (detail.meta.preBalances[ownerIndex] ?? 0)
          : 0;
        const fee = ownerIndex === 0 ? detail.meta.fee : 0;
        const tokens = tokenDeltas(owner, detail);
        return {
          ...record,
          failed: detail.meta.err != null,
          type: detail.meta.err != null ? 'Failed transaction' : classify(nativeDelta, tokens),
          nativeDeltaLamports: String(nativeDelta),
          nativeDeltaSol: nativeDelta / LAMPORTS_PER_SOL,
          feeLamports: fee,
          tokenDeltas: tokens,
          detailsAvailable: true,
        };
      } catch {
        return { ...record, failed: record.err != null, type: 'Details unavailable', nativeDeltaLamports: null, nativeDeltaSol: null, feeLamports: null, tokenDeltas: [], detailsAvailable: false };
      }
      })));
    }

    return NextResponse.json({
      network: 'solana-mainnet',
      source: 'Solana JSON-RPC getSignaturesForAddress + getTransaction',
      transactions: decoded.map((transaction) => ({
        signature: transaction.signature,
        slot: transaction.slot,
        blockTime: transaction.blockTime,
        failed: transaction.failed,
        confirmationStatus: transaction.confirmationStatus,
        type: transaction.type,
        nativeDeltaLamports: transaction.nativeDeltaLamports,
        nativeDeltaSol: transaction.nativeDeltaSol,
        feeLamports: transaction.feeLamports,
        tokenDeltas: transaction.tokenDeltas,
        detailsAvailable: transaction.detailsAvailable,
      })),
      hasMore: signatures.length === limitValue,
      nextBefore: signatures.length === limitValue ? signatures[signatures.length - 1].signature : null,
      note: 'RPC history is address-scoped and provider-retention-limited. Token deltas are exact raw balance changes; classifications are indicative, not a complete accounting ledger or verified P&L.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load wallet transaction history.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
