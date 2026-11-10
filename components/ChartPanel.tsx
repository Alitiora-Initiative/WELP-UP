'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

type ChartData = {
  source: string;
  fetchedAt: number;
  poolAddress: string;
  poolLiquidityUsd: number;
  interval: Interval;
  candles: Candle[];
  stale: boolean;
};

type Props = { mint: string; name: string; symbol: string };


const INTERVALS: Array<{ key: Interval; label: string }> = [
  { key: '1m', label: '1m' },
  { key: '5m', label: '5m' },
  { key: '15m', label: '15m' },
  { key: '1h', label: '1h' },
  { key: '4h', label: '4h' },
  { key: '1d', label: '1D' },
];

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 7 });
const volumeFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });

function timeLabel(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

function candleLabel(candle: Candle) {
  return `${new Date(candle.time * 1000).toLocaleString()} · O ${currency.format(candle.open)} · H ${currency.format(candle.high)} · L ${currency.format(candle.low)} · C ${currency.format(candle.close)} · Vol ${volumeFormat.format(candle.volume)}`;
}

export function ChartPanel({ mint, name, symbol }: Props) {
  const [interval, setIntervalValue] = useState<Interval>('5m');
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const fetchChart = useCallback(async (quiet = false) => {
    if (!mint || inFlightRef.current) return;
    inFlightRef.current = true;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (!quiet) setLoading(true);
    setFetchError('');

    try {
      const url = `/api/chart?mint=${encodeURIComponent(mint)}&provider=dexscreener&interval=${interval}`;
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      const data = await response.json() as ChartData & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not load genuine pool OHLCV data.');
      if (!Array.isArray(data.candles) || data.candles.length === 0) {
        throw new Error('The data provider returned no OHLCV candles for this pool.');
      }
      setChartData(data);
      setActiveIndex(data.candles.length - 1);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setChartData(null);
      setFetchError(caught instanceof Error ? caught.message : 'Chart data unavailable.');
    } finally {
      if (requestRef.current === controller) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }, [mint, interval]);

  useEffect(() => {
    const initial = window.setTimeout(() => void fetchChart(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchChart(true);
    }, 60_000);
    const visible = () => {
      if (document.visibilityState === 'visible') void fetchChart(true);
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      requestRef.current?.abort();
      requestRef.current = null;
      inFlightRef.current = false;
    };
  }, [fetchChart]);

  const visibleCandles = useMemo(() => chartData?.candles.slice(-120) ?? [], [chartData]);
  const geometry = useMemo(() => {
    if (visibleCandles.length === 0) return [];
    const min = Math.min(...visibleCandles.map((candle) => candle.low));
    const max = Math.max(...visibleCandles.map((candle) => candle.high));
    const range = max - min || Math.max(max * 0.001, Number.EPSILON);
    const top = 20;
    const bottom = 270;
    const plotHeight = bottom - top;
    const left = 62;
    const plotWidth = 900;
    const step = plotWidth / visibleCandles.length;
    const bodyWidth = Math.max(2, Math.min(12, step * 0.62));
    const y = (value: number) => top + ((max - value) / range) * plotHeight;
    return visibleCandles.map((candle, index) => {
      const center = left + step * (index + 0.5);
      const openY = y(candle.open);
      const closeY = y(candle.close);
      return {
        candle,
        index,
        x: center,
        highY: y(candle.high),
        lowY: y(candle.low),
        bodyY: Math.min(openY, closeY),
        bodyHeight: Math.max(1.4, Math.abs(closeY - openY)),
        bodyWidth,
        up: candle.close >= candle.open,
      };
    });
  }, [visibleCandles]);

  const selectedIndex = activeIndex === null ? visibleCandles.length - 1 : Math.max(0, Math.min(activeIndex, visibleCandles.length - 1));
  const selectedCandle = visibleCandles[selectedIndex] ?? null;
  const lastCandle = visibleCandles[visibleCandles.length - 1] ?? null;
  const changePositive = lastCandle ? lastCandle.close >= lastCandle.open : true;

  return (
    <section className="chart-panel-live" aria-label={`Live candlestick chart for ${name} (${symbol})`}>
      <header className="chart-live-header">
        <div>
          <p className="chart-live-kicker">LIVE ON-CHAIN POOL OHLCV</p>
          <h2>{name} <span>{symbol}</span></h2>
          <p className="chart-live-mint">{mint}</p>
        </div>
        <div className="chart-live-controls">
          <label>
            Interval
            <select value={interval} onChange={(event) => setIntervalValue(event.target.value as Interval)} disabled={loading}>
              {INTERVALS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void fetchChart()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {chartData ? (
        <div className="chart-live-provenance">
          <span>Source: <strong>DexScreener live snapshot</strong></span>
          <span>Pool liquidity: <strong>{volumeFormat.format(chartData.poolLiquidityUsd)}</strong></span>
          <span>Updated: <time dateTime={new Date(chartData.fetchedAt).toISOString()}>{timeLabel(Math.floor(chartData.fetchedAt / 1000))}</time></span>
          <a href={`https://dexscreener.com/solana/${chartData.poolAddress}`} target="_blank" rel="noreferrer">
            Verify pair <ExternalLink size={13} />
          </a>
        </div>
      ) : null}

      {chartData?.stale ? (
        <div className="chart-live-warning" role="status"><AlertTriangle size={15} /> Latest pool candle is older than five minutes.</div>
      ) : null}

      {fetchError ? (
        <div className="chart-live-error" role="alert"><AlertTriangle size={16} /><span>{fetchError}</span></div>
      ) : null}

      <p className="chart-live-footnote">Self-hosted WELP chart surface. The snapshot is read-only and never authorizes a trade.</p>

      {geometry.length > 0 ? (
        <>
          <div className="chart-live-reading" aria-live="polite">
            {selectedCandle ? <span>{candleLabel(selectedCandle)}</span> : null}
            {lastCandle ? <strong className={changePositive ? 'is-up' : 'is-down'}>{currency.format(lastCandle.close)}</strong> : null}
          </div>
          <div className="chart-svg-wrap">
            <svg className="chart-candles-svg" viewBox="0 0 1000 320" role="group" aria-label="Pool candle backup. Focus a candle to read its OHLCV values.">
              {[0, 1, 2, 3, 4].map((step) => {
                const y = 20 + step * 62.5;
                return <g key={step}>
                  <line className="chart-grid-line" x1="62" x2="962" y1={y} y2={y} />
                  <text className="chart-axis-text" x="54" y={y + 4} textAnchor="end">{currency.format(Math.max(...visibleCandles.map((c) => c.high)) - step * (Math.max(...visibleCandles.map((c) => c.high)) - Math.min(...visibleCandles.map((c) => c.low))) / 4)}</text>
                </g>;
              })}
              {geometry.map((item) => (
                <g
                  key={item.candle.time}
                  className={item.up ? 'chart-candle-group is-up' : 'chart-candle-group is-down'}
                  role="button"
                  tabIndex={0}
                  aria-label={candleLabel(item.candle)}
                  onMouseEnter={() => setActiveIndex(item.index)}
                  onFocus={() => setActiveIndex(item.index)}
                >
                  <line className="chart-candle-wick" x1={item.x} x2={item.x} y1={item.highY} y2={item.lowY} />
                  <rect className="chart-candle-body" x={item.x - item.bodyWidth / 2} y={item.bodyY} width={item.bodyWidth} height={item.bodyHeight} rx="1" />
                </g>
              ))}
              {selectedCandle ? <line
                className="chart-crosshair"
                x1={geometry[selectedIndex]?.x ?? 0}
                x2={geometry[selectedIndex]?.x ?? 0}
                y1="18"
                y2="274"
              /> : null}
              <text className="chart-axis-text" x="62" y="300">{visibleCandles[0] ? new Date(visibleCandles[0].time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</text>
              <text className="chart-axis-text" x="962" y="300" textAnchor="end">{lastCandle ? new Date(lastCandle.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</text>
            </svg>
          </div>
          <p className="chart-live-footnote">{visibleCandles.length} verified market snapshot shown · refreshes every 60 seconds while this tab is visible · price display in USD</p>
        </>
      ) : loading ? (
        <div className="chart-live-empty">Loading verified pool candles…</div>
      ) : !fetchError ? (
        <div className="chart-live-empty">No pool candles are available for the selected mint and interval.</div>
      ) : null}
    </section>
  );
}
