export type DexScreenerPair = {
  pairAddress: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  priceChange24h: number | null;
};

export type ProviderResult<T> = {
  status: 'ok' | 'error';
  source: 'DexScreener';
  fetchedAt: number;
  data?: T;
  error?: string;
};

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DEX_BASE = 'https://api.dexscreener.com/latest/dex/tokens';

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as RecordValue
    : {};
}

function number(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isValidMint(mint: string): boolean {
  return MINT_RE.test(mint);
}

export class DexScreenerProvider {
  readonly name = 'DexScreener' as const;

  async fetchPair(mint: string): Promise<ProviderResult<DexScreenerPair>> {
    const fetchedAt = Date.now();
    if (!isValidMint(mint)) {
      return { status: 'error', source: this.name, fetchedAt, error: 'Invalid Solana mint address.' };
    }

    try {
      const response = await fetch(`${DEX_BASE}/${encodeURIComponent(mint)}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        return { status: 'error', source: this.name, fetchedAt, error: `DexScreener returned HTTP ${response.status}.` };
      }

      const payload = record(await response.json());
      const pairs = Array.isArray(payload.pairs) ? payload.pairs.map(record) : [];
      const pair = pairs
        .filter((item) => {
          const pairAddress = String(item.pairAddress ?? '');
          const liquidity = number(record(item.liquidity).usd);
          const price = number(item.priceUsd);
          return item.chainId === 'solana' && isValidMint(pairAddress) &&
            liquidity !== null && liquidity > 0 && price !== null && price > 0;
        })
        .sort((left, right) =>
          (number(record(right.liquidity).usd) ?? 0) - (number(record(left.liquidity).usd) ?? 0),
        )[0];

      if (!pair) {
        return { status: 'error', source: this.name, fetchedAt, error: 'DexScreener returned no Solana liquidity pair for this mint.' };
      }

      const priceChange24h = number(record(pair.priceChange).h24);
      return {
        status: 'ok',
        source: this.name,
        fetchedAt,
        data: {
          pairAddress: String(pair.pairAddress),
          priceUsd: number(pair.priceUsd)!,
          liquidityUsd: number(record(pair.liquidity).usd)!,
          volume24hUsd: number(record(pair.volume).h24) ?? 0,
          priceChange24h,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        source: this.name,
        fetchedAt,
        error: error instanceof Error ? error.message : 'DexScreener request failed.',
      };
    }
  }
}

export const dexScreenerProvider = new DexScreenerProvider();
