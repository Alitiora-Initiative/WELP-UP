export type DexCrossCheck = {
  provider: 'DexScreener';
  state: 'matched' | 'no_pair' | 'unavailable' | 'not_checked';
  pairAddress?: string;
  pairSide?: 'base' | 'quote';
  priceUsd?: number;
  liquidityUsd?: number | null;
  volume24hUsd?: number | null;
  priceDeltaPct?: number | null;
};

export type DexCrossCheckSummary = {
  provider: 'DexScreener';
  state: 'operational' | 'partial' | 'unavailable';
  checkedAssets: number;
  matchedAssets: number;
  requestedAssets: number;
  updatedAt: string;
  error?: string;
  records: Record<string, DexCrossCheck>;
};

type Row = Record<string, unknown>;
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function record(value: unknown): Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Row : {};
}
function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDexScreenerTokenPairs(
  mints: string[],
  primaryPrices: Record<string, number | null>,
  payload: unknown,
): Record<string, DexCrossCheck> {
  const rows = Array.isArray(payload) ? payload.map(record) : [];
  const records: Record<string, DexCrossCheck> = {};

  for (const mint of mints) {
    if (!MINT_RE.test(mint)) continue;
    const candidates: Array<{ pair: Row; pairSide: 'base' | 'quote'; priceUsd: number }> = rows.flatMap((pair): Array<{ pair: Row; pairSide: 'base' | 'quote'; priceUsd: number }> => {
      if (pair.chainId !== 'solana') return [];
      const base = record(pair.baseToken);
      const quote = record(pair.quoteToken);
      const basePriceUsd = finite(pair.priceUsd);
      if (base.address === mint && basePriceUsd !== null && basePriceUsd > 0) {
        return [{ pair, pairSide: 'base' as const, priceUsd: basePriceUsd }];
      }
      if (quote.address === mint) {
        const priceNative = finite(pair.priceNative);
        const quotePriceUsd = basePriceUsd !== null && basePriceUsd > 0 && priceNative !== null && priceNative > 0
          ? basePriceUsd / priceNative
          : null;
        if (quotePriceUsd !== null && Number.isFinite(quotePriceUsd) && quotePriceUsd > 0) {
          return [{ pair, pairSide: 'quote' as const, priceUsd: quotePriceUsd }];
        }
      }
      return [];
    });
    candidates.sort((a, b) =>
      (finite(record(b.pair.liquidity).usd) ?? 0) - (finite(record(a.pair.liquidity).usd) ?? 0),
    );
    const selected = candidates[0];

    if (!selected) {
      records[mint] = { provider: 'DexScreener', state: 'no_pair' };
      continue;
    }

    const { pair, pairSide, priceUsd } = selected;
    const liquidityUsd = finite(record(pair.liquidity).usd);
    const volume24hUsd = finite(record(pair.volume).h24);
    const primaryPrice = finite(primaryPrices[mint]);
    const priceDeltaPct = primaryPrice !== null && primaryPrice > 0
      ? ((priceUsd / primaryPrice) - 1) * 100
      : null;
    records[mint] = {
      provider: 'DexScreener',
      state: 'matched',
      pairAddress: typeof pair.pairAddress === 'string' ? pair.pairAddress : undefined,
      pairSide,
      priceUsd,
      liquidityUsd,
      volume24hUsd,
      priceDeltaPct: priceDeltaPct === null ? null : Math.round(priceDeltaPct * 100) / 100,
    };
  }
  return records;
}

export async function fetchDexScreenerCrossChecks(
  assets: Array<{ mint: string; priceUsd: number | null }>,
): Promise<DexCrossCheckSummary> {
  const updatedAt = new Date().toISOString();
  const batch = assets.filter((asset) => MINT_RE.test(asset.mint)).slice(0, 30);
  if (batch.length === 0) {
    return {
      provider: 'DexScreener',
      state: 'unavailable',
      checkedAssets: 0,
      matchedAssets: 0,
      requestedAssets: 0,
      updatedAt,
      error: 'No valid Solana mints were available for cross-checking.',
      records: {},
    };
  }

  try {
    const addresses = batch.map((asset) => encodeURIComponent(asset.mint)).join(',');
    const response = await fetch(
      `https://api.dexscreener.com/tokens/v1/solana/${addresses}`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 30 },
        signal: AbortSignal.timeout(3_500),
      },
    );
    if (!response.ok) throw new Error(`DexScreener returned HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('DexScreener returned an unexpected response format.');

    const primaryPrices = Object.fromEntries(batch.map((asset) => [asset.mint, asset.priceUsd]));
    const records = parseDexScreenerTokenPairs(batch.map((asset) => asset.mint), primaryPrices, payload);
    const matchedAssets = Object.values(records).filter((entry) => entry.state === 'matched').length;
    return {
      provider: 'DexScreener',
      state: matchedAssets === batch.length ? 'operational' : 'partial',
      checkedAssets: batch.length,
      matchedAssets,
      requestedAssets: batch.length,
      updatedAt: new Date().toISOString(),
      records,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DexScreener cross-check failed.';
    const records = Object.fromEntries(batch.map((asset) => [asset.mint, { provider: 'DexScreener' as const, state: 'unavailable' as const }]));
    return {
      provider: 'DexScreener',
      state: 'unavailable',
      checkedAssets: 0,
      matchedAssets: 0,
      requestedAssets: batch.length,
      updatedAt: new Date().toISOString(),
      error: message,
      records,
    };
  }
}
