'use client';

import useSWR from 'swr';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

type ChartData = {
  source: 'DexScreener';
  fetchedAt: number;
  pairAddress: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  priceChange24h: number | null;
};

type Props = { mint: string; name: string; symbol: string };

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumSignificantDigits: 7,
});
const volumeFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

async function fetchChartData(url: string): Promise<ChartData> {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json() as ChartData & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Could not load this DexScreener market.');
  if (!data.pairAddress || !Number.isFinite(data.priceUsd)) {
    throw new Error('DexScreener did not return a verified Solana liquidity pair.');
  }
  return data;
}

export function ChartPanel({ mint, name, symbol }: Props) {
  const key = mint ? `/api/chart?mint=${encodeURIComponent(mint)}` : null;
  const { data: chartData, error, isLoading, isValidating, mutate } = useSWR<ChartData>(key, fetchChartData, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  });
  const fetchError = error instanceof Error ? error.message : error ? 'DexScreener chart unavailable.' : '';
  const loading = isLoading || isValidating;
  const chartUrl = chartData
    ? `https://dexscreener.com/solana/${encodeURIComponent(chartData.pairAddress)}?embed=1&theme=dark&trades=0&info=0`
    : '';
  const pairUrl = chartData
    ? `https://dexscreener.com/solana/${encodeURIComponent(chartData.pairAddress)}`
    : '';

  return (
    <section className="chart-panel-live" aria-label={`DexScreener chart for ${name} (${symbol})`}>
      <header className="chart-live-header">
        <div>
          <p className="chart-live-kicker">LIVE DEXSCREENER MARKET</p>
          <h2>{name} <span>{symbol}</span></h2>
          <p className="chart-live-mint">{mint}</p>
        </div>
        <div className="chart-live-controls">
          <button type="button" onClick={() => void mutate()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {chartData ? (
        <div className="chart-live-provenance">
          <span>Price: <strong>{currency.format(chartData.priceUsd)}</strong></span>
          <span>Pool liquidity: <strong>{volumeFormat.format(chartData.liquidityUsd)}</strong></span>
          <span>24h volume: <strong>{volumeFormat.format(chartData.volume24hUsd)}</strong></span>
          {chartData.priceChange24h !== null ? (
            <span>24h change: <strong className={chartData.priceChange24h >= 0 ? 'positive' : 'negative'}>
              {chartData.priceChange24h >= 0 ? '+' : ''}{chartData.priceChange24h.toFixed(2)}%
            </strong></span>
          ) : null}
          <a href={pairUrl} target="_blank" rel="noreferrer">
            Open DexScreener <ExternalLink size={13} />
          </a>
        </div>
      ) : null}

      {fetchError ? (
        <div className="chart-live-error" role="status" aria-live="polite">
          <AlertTriangle size={16} /><span>{fetchError}</span>
        </div>
      ) : null}

      <p className="chart-live-footnote">
        Chart and market data are served by DexScreener. This read-only view never authorizes a trade.
      </p>

      {chartData ? (
        <iframe
          className="dexscreener-chart-frame"
          src={chartUrl}
          title={`DexScreener live chart for ${name} (${symbol})`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : loading ? (
        <div className="chart-live-empty">Loading the live DexScreener chart…</div>
      ) : !fetchError ? (
        <div className="chart-live-empty">No DexScreener pair is available for this mint.</div>
      ) : null}
      {chartData ? (
        <p className="chart-live-footnote">
          Pair selected by highest reported Solana liquidity · updated {new Date(chartData.fetchedAt).toLocaleTimeString()}.
        </p>
      ) : null}
    </section>
  );
}
