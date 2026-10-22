'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react';
import { AppSidebar } from '@/components/AppSidebar';
import { client } from '@/components/Providers';
import { getWalletHistory, recordEquityPoint, recordSignalScan, type EquityPoint, type WalletHistory } from '@/lib/activity';
import { currentTime } from '@/lib/time';

type WalletSnapshot = { sol: number; solPrice: number; equityUsd: number };
type LiveSignal = { mint: string; symbol: string; score: number; eligible: boolean };

const EMPTY_HISTORY: WalletHistory = { events: [], points: [] };

function chartCoordinates(points: EquityPoint[]) {
  if (!points.length) return { line: '', area: '', minimum: 0, maximum: 0 };
  const values = points.map((point) => point.equityUsd);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = Math.max(maximum - minimum, Math.max(maximum * 0.015, 0.01));
  const line = points.map((point, index) => {
    const x = points.length === 1 ? 450 : 12 + (index / (points.length - 1)) * 876;
    const y = 224 - ((point.equityUsd - minimum) / spread) * 190;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = `12,240 ${line} 888,240`;
  return { line, area, minimum, maximum };
}

function timeLabel(value: number) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(value);
}

function eventTime(value: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value);
}

export function ActivityPage() {
  const connected = useConnectedWallet(client);
  const walletAddress = connected?.account.address ?? '';
  const [history, setHistory] = useState<WalletHistory>(EMPTY_HISTORY);
  const [historyOwner, setHistoryOwner] = useState('');
  const [snapshot, setSnapshot] = useState<{ owner: string; value: WalletSnapshot } | null>(null);
  const [eligibleCount, setEligibleCount] = useState<{ owner: string; value: number } | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!walletAddress || refreshInFlight.current) return;
    refreshInFlight.current = true;
    setHistory(getWalletHistory(walletAddress));
    setHistoryOwner(walletAddress);
    setLoading(true);
    setError('');
    try {
      const [walletResponse, signalsResponse] = await Promise.all([
        fetch(`/api/wallet?owner=${encodeURIComponent(walletAddress)}`, { cache: 'no-store' }),
        fetch(`/api/signals?owner=${encodeURIComponent(walletAddress)}`, { cache: 'no-store' }),
      ]);
      const [walletData, signalsData] = await Promise.all([walletResponse.json(), signalsResponse.json()]);
      if (!walletResponse.ok) throw new Error(walletData.error || 'Wallet snapshot is unavailable.');
      const nextSnapshot = walletData as WalletSnapshot;
      setSnapshot({ owner: walletAddress, value: nextSnapshot });
      recordEquityPoint(walletAddress, { at: currentTime(), equityUsd: nextSnapshot.equityUsd, sol: nextSnapshot.sol });

      if (signalsResponse.ok) {
        const signals = Array.isArray(signalsData.signals) ? signalsData.signals as LiveSignal[] : [];
        setEligibleCount({ owner: walletAddress, value: signals.filter((signal) => signal.eligible).length });
        recordSignalScan(walletAddress, signals);
      } else {
        setEligibleCount(null);
      }
      setHistory(getWalletHistory(walletAddress));
      setHistoryOwner(walletAddress);
      setUpdatedAt(currentTime());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not refresh wallet activity.');
    } finally {
      refreshInFlight.current = false;
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
    };
  }, [walletAddress, refresh]);

  const currentHistory = historyOwner === walletAddress ? history : EMPTY_HISTORY;
  const currentSnapshot = snapshot?.owner === walletAddress ? snapshot.value : null;
  const currentEligibleCount = eligibleCount?.owner === walletAddress ? eligibleCount.value : null;
  const chart = useMemo(() => chartCoordinates(currentHistory.points), [currentHistory.points]);
  const earliestPoint = currentHistory.points[0];
  const latestPoint = currentHistory.points[currentHistory.points.length - 1];
  const changeUsd = earliestPoint && latestPoint ? latestPoint.equityUsd - earliestPoint.equityUsd : null;

  return (
    <main className="app-shell">
      <AppSidebar active="activity" status={loading ? 'Refreshing wallet activity' : 'Strategy scan · no auto-trading'} />
      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb"><span>PORTFOLIO</span><span className="crumb-slash">/</span><strong>Activity</strong></div>
          <div className="topbar-right">
            <span className="market-open"><span className="market-pip" /> WALLET ACTIVITY</span>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><Activity size={14} /> WALLET-SCOPED PORTFOLIO</p>
              <h1>Portfolio <em>activity.</em></h1>
              <p className="welcome-copy">See wallet value snapshots, rule scans and swaps you approved. A signal is analysis, never a submitted trade.</p>
            </div>
            <button className="refresh-button activity-refresh" onClick={() => void refresh()} disabled={!walletAddress || loading}>
              {loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Refresh now
            </button>
          </section>

          <div className="autopilot-notice" role="note">
            <ShieldCheck size={18} />
            <div><strong>Automatic trading is not enabled.</strong><span>WELP currently scans markets and prepares user-approved swaps. The proposed revocable, capped vault still needs to be built, reviewed and audited before it can trade unattended.</span></div>
          </div>

          {!walletAddress ? (
            <section className="panel activity-connect">
              <div className="empty-icon"><Wallet size={20} /></div>
              <h2>Portfolio stays locked</h2>
              <p>History is kept separately for each public wallet address in this browser, and only after the site wallet session is active.</p>
            </section>
          ) : (
            <>
              {error ? <div className="inline-error activity-error" role="alert">{error}</div> : null}
              <section className="portfolio-summary-grid" aria-label="Portfolio summary">
                <article className="panel portfolio-summary-card">
                  <div className="portfolio-card-heading"><span>ESTIMATED WALLET VALUE</span><Wallet size={15} /></div>
                  <strong>{currentSnapshot ? `$${currentSnapshot.equityUsd.toFixed(2)}` : '—'}</strong>
                  <small>{currentSnapshot ? `${currentSnapshot.sol.toFixed(4)} SOL · SOL $${currentSnapshot.solPrice.toFixed(2)}` : 'Loading latest wallet balance'}</small>
                </article>
                <article className="panel portfolio-summary-card">
                  <div className="portfolio-card-heading"><span>CHANGE IN RECORDED WINDOW</span><Activity size={15} /></div>
                  <strong className={changeUsd === null ? '' : changeUsd >= 0 ? 'positive' : 'negative'}>{changeUsd === null ? '—' : `${changeUsd >= 0 ? '+' : '−'}$${Math.abs(changeUsd).toFixed(2)}`}</strong>
                  <small>{earliestPoint ? `Since ${eventTime(earliestPoint.at)} · observed wallet value, not trade P&L` : 'Collecting wallet snapshots while this page is open'}</small>
                </article>
                <article className="panel portfolio-summary-card">
                  <div className="portfolio-card-heading"><span>ELIGIBLE STRATEGY SIGNALS</span><Sparkles size={15} /></div>
                  <strong>{currentEligibleCount === null ? '—' : currentEligibleCount.toString().padStart(2, '0')}</strong>
                  <small>Latest scan · each swap still needs Phantom approval</small>
                </article>
              </section>

              <section className="panel portfolio-chart-panel">
                <div className="panel-heading">
                  <div><p className="eyebrow">RECORDED WALLET SNAPSHOTS</p><h2>Estimated equity</h2></div>
                  <span className="chart-window">{currentHistory.points.length ? `${currentHistory.points.length} snapshots` : 'No history yet'}</span>
                </div>
                {currentHistory.points.length ? (
                  <>
                    <div className="portfolio-chart-wrap">
                      <div className="chart-y-labels"><span>${chart.maximum.toFixed(2)}</span><span>${((chart.maximum + chart.minimum) / 2).toFixed(2)}</span><span>${chart.minimum.toFixed(2)}</span></div>
                      <svg className="portfolio-chart" viewBox="0 0 900 250" role="img" aria-label="Recorded estimated wallet equity over time">
                        <defs><linearGradient id="equity-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#b9f36d" stopOpacity=".22" /><stop offset="100%" stopColor="#b9f36d" stopOpacity="0" /></linearGradient></defs>
                        <path className="chart-gridline" d="M12 34H888 M12 129H888 M12 224H888" />
                        <polygon points={chart.area} fill="url(#equity-fill)" />
                        <polyline points={chart.line} fill="none" stroke="#b9f36d" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="chart-x-labels"><span>{timeLabel(currentHistory.points[0].at)}</span><span>{timeLabel(currentHistory.points[Math.floor(currentHistory.points.length / 2)].at)}</span><span>{timeLabel(currentHistory.points[currentHistory.points.length - 1].at)}</span></div>
                  </>
                ) : (
                  <div className="activity-chart-empty"><Activity size={21} /><strong>Wallet history starts here</strong><p>WELP records a balance snapshot every two minutes while this page is open. It does not backfill previous balances.</p></div>
                )}
                <div className="panel-foot"><span>Public SOL and stablecoin balances × current SOL mark</span><span>{updatedAt ? `Updated ${timeLabel(updatedAt)}` : 'Waiting for first refresh'}</span></div>
              </section>

              <section className="panel activity-feed-panel">
                <div className="panel-heading"><div><p className="eyebrow">LATEST STRATEGY AND WALLET EVENTS</p><h2>Activity</h2></div><span className="chart-window">{currentHistory.events.length} events · this browser</span></div>
                {!currentHistory.events.length ? (
                  <div className="activity-chart-empty activity-feed-empty"><Activity size={21} /><strong>No activity recorded yet</strong><p>Successful wallet-approved swaps and strategy scan updates will appear here.</p></div>
                ) : (
                  <div className="activity-event-list">
                    {currentHistory.events.map((event) => (
                      <article className="activity-event" key={event.id}>
                        <span className={`activity-event-icon${event.type === 'trade' ? ' activity-event-trade' : ''}`}>{event.type === 'trade' ? event.side === 'sell' ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} /> : <Sparkles size={15} />}</span>
                        <div className="activity-event-copy"><strong>{event.title}</strong><p>{event.detail}</p></div>
                        <time dateTime={new Date(event.at).toISOString()}>{eventTime(event.at)}</time>
                        {event.signature ? <a className="activity-explorer-link" href={`https://explorer.solana.com/tx/${encodeURIComponent(event.signature)}`} target="_blank" rel="noreferrer" aria-label="View transaction on Solana Explorer"><ExternalLink size={14} /></a> : null}
                      </article>
                    ))}
                  </div>
                )}
                <div className="activity-storage-note"><ShieldCheck size={14} /><span>History is stored locally and keyed by public wallet address. It is not synced across browsers or devices, and it is not a complete on-chain portfolio ledger.</span></div>
              </section>
            </>
          )}

          <footer className="footer"><span>WELP UP · Solana mainnet</span><span>Wallet history is a local estimate; trading can lose all value.</span><a href="/terms">Terms &amp; Conditions</a></footer>
        </div>
      </section>
    </main>
  );
}
