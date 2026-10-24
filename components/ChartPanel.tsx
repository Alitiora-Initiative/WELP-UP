'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ChartData = {
  source: string;
  fetchedAt: number;
  candles: Candle[];
  stale: boolean;
  error: string | null;
};

type Props = {
  mint: string;
  providerNames: string[];
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ChartPanel({ mint, providerNames }: Props) {
  const [selectedProvider, setSelectedProvider] = useState<string>(providerNames[0] ?? 'jupiter');
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const fetchChart = useCallback(async (provider: string) => {
    if (!mint) return;
    setLoading(true);
    setFetchError('');
    try {
      const url = `/api/chart?mint=${encodeURIComponent(mint)}&provider=${encodeURIComponent(provider)}`;
      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json() as ChartData & { error?: string };
      if (!response.ok) {
        setFetchError(data.error ?? 'Failed to load chart data.');
        setChartData(null);
      } else {
        setChartData(data);
        setFetchError('');
      }
    } catch {
      setFetchError('Network error loading chart data.');
      setChartData(null);
    } finally {
      setLoading(false);
    }
  }, [mint]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchChart(selectedProvider);
  }, [selectedProvider, fetchChart]);

  function handleProviderChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedProvider(event.target.value);
  }

  const lastUpdateTime = chartData ? formatTime(chartData.fetchedAt) : null;
  const hasCandles = chartData && chartData.candles.length > 0;
  const latestCandle = hasCandles ? chartData!.candles[chartData!.candles.length - 1] : null;

  return (
    <section className="chart-panel" aria-label="Price chart panel">
      <div className="chart-panel-header">
        <h3 className="chart-panel-title">Price Chart</h3>
        <div className="chart-panel-controls">
          <label htmlFor="chart-provider-select" className="visually-hidden">
            Chart data source
          </label>
          <select
            id="chart-provider-select"
            value={selectedProvider}
            onChange={handleProviderChange}
            aria-label="Select chart data source"
            className="chart-provider-select"
            disabled={loading}
          >
            {providerNames.map((name) => (
              <option key={name} value={name}>
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </option>
            ))}
          </select>
          <button
            onClick={() => void fetchChart(selectedProvider)}
            disabled={loading}
            aria-label="Refresh chart data"
            className="chart-refresh-button"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Source and timestamp provenance */}
      {chartData && (
        <div className="chart-provenance" aria-live="polite">
          <span className="chart-source-label">
            Source: <strong>{chartData.source}</strong>
          </span>
          {lastUpdateTime && (
            <span className="chart-updated-label">
              Last update: <time dateTime={new Date(chartData.fetchedAt).toISOString()}>{lastUpdateTime}</time>
            </span>
          )}
        </div>
      )}

      {/* Stale data banner */}
      {chartData?.stale && (
        <div className="chart-stale-banner" role="alert" aria-live="assertive">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>Chart data may be stale (older than 5 minutes). Refresh for the latest prices.</span>
        </div>
      )}

      {/* Missing / error banner */}
      {(!hasCandles && !loading && !fetchError) && (
        <div className="chart-missing-banner" role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>No chart data available for this token from {selectedProvider}.</span>
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="chart-error-banner" role="alert">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Candle summary — lightweight display without a charting library */}
      {hasCandles && latestCandle && (
        <div className="chart-data-summary" aria-label="Latest candle data">
          <div className="chart-candle-row">
            <span className="chart-label">Close</span>
            <strong className="chart-value">${latestCandle.close.toPrecision(6)}</strong>
          </div>
          <div className="chart-candle-row">
            <span className="chart-label">High</span>
            <strong className="chart-value">${latestCandle.high.toPrecision(6)}</strong>
          </div>
          <div className="chart-candle-row">
            <span className="chart-label">Low</span>
            <strong className="chart-value">${latestCandle.low.toPrecision(6)}</strong>
          </div>
          <div className="chart-candle-row">
            <span className="chart-label">Volume</span>
            <strong className="chart-value">{latestCandle.volume.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>
          </div>
          <div className="chart-candle-row">
            <span className="chart-label">Candles</span>
            <strong className="chart-value">{chartData!.candles.length}</strong>
          </div>
        </div>
      )}

      {/* Mandatory disclaimer — charts never authorize trades */}
      <p className="chart-disclaimer" role="note">
        Chart data is read-only and does not authorize trades.
      </p>
    </section>
  );
}
