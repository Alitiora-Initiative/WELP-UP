'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LoaderCircle, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

type Asset = {
  mint: string; name: string; symbol: string; priceUsd: number; priceChange24h: number;
  liquidityUsd: number; volume24hUsd: number; holders: number; organicScore: number;
  score: number; verified: boolean; state: 'Eligible' | 'Watch' | 'Blocked'; eligible: boolean;
  blockers: string[]; warnings: string[];
};
type Feed = { assets: Asset[]; updatedAt: string; eligible: number; blocked: number; error?: string };
const cash = (value: number) => value >= 1e6 ? '$' + (value / 1e6).toFixed(1) + 'M' : value >= 1e3 ? '$' + (value / 1e3).toFixed(1) + 'K' : '$' + value.toFixed(2);
const quote = (value: number) => value >= 1 ? '$' + value.toFixed(2) : value >= .01 ? '$' + value.toFixed(4) : '$' + value.toPrecision(4);

export function SignalsBoard() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [updated, setUpdated] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'All' | 'Eligible' | 'Blocked'>('All');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/markets', { cache: 'no-store' });
      const data = await response.json() as Feed;
      if (!response.ok) throw new Error(data.error || 'Market feed unavailable');
      setAssets(data.assets || []); setUpdated(data.updatedAt || '');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not refresh signals.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  const shown = assets.filter((asset) => filter === 'All' || (filter === 'Eligible' && asset.eligible) || (filter === 'Blocked' && !asset.eligible));
  return <main className="terminal-page feature-page">
    <div className="page-heading"><div><div className="eyebrow"><i className="eyebrow-dot" /> DETERMINISTIC RULE ENGINE · NO PREDICTION</div><h1>Signals with <span>the reason attached.</span></h1><p>Each tracked asset is tested against published hard rules, then scored on live fields. A blocked row names the rule that stopped it.</p></div><button className="outline-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Re-scan</button></div>
    <section className="market-stats three"><div><span>SCANNED</span><strong>{assets.length || '—'}</strong><small>Live assets read from Jupiter</small></div><div><span>ELIGIBLE</span><strong>{assets.filter((a) => a.eligible).length}</strong><small>Passed all hard rules</small></div><div><span>BLOCKED</span><strong>{assets.filter((a) => !a.eligible).length}</strong><small>At least one hard rule failed</small></div></section>
    <div className="filter-row">{(['All', 'Eligible', 'Blocked'] as const).map((value) => <button key={value} className={filter === value ? 'filter-chip active' : 'filter-chip'} onClick={() => setFilter(value)}>{value}</button>)}<span className="muted-note">Feed checked {updated ? new Date(updated).toLocaleTimeString() : '—'}</span></div>
    {error ? <div className="feed-error" role="alert">{error}</div> : null}
    <div className="signal-cards">{shown.map((asset) => <article className="signal-card" key={asset.mint}>
      <div className="signal-card-top"><div><span className="signal-symbol">{asset.symbol}</span>{asset.verified ? <span className="verified-mark">V</span> : null}<small>{asset.name}</small></div><div className="signal-score"><small>SCORE</small><strong>{asset.score}</strong></div></div>
      <div className="signal-metrics"><div><small>PRICE</small><strong>{quote(asset.priceUsd)}</strong></div><div><small>24H</small><strong className={asset.priceChange24h >= 0 ? 'positive' : 'negative'}>{asset.priceChange24h >= 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%</strong></div><div><small>LIQUIDITY</small><strong>{cash(asset.liquidityUsd)}</strong></div><div><small>24H VOLUME</small><strong>{cash(asset.volume24hUsd)}</strong></div><div><small>HOLDERS</small><strong>{asset.holders.toLocaleString()}</strong></div><div><small>ORGANIC</small><strong>{asset.organicScore}</strong></div></div>
      <div className={'signal-result ' + (asset.eligible ? 'pass' : 'blocked')}>{asset.eligible ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}<span>{asset.blockers[0] || asset.warnings[0] || 'Passed every hard rule with no open warnings'}</span></div>
      <Link className="signal-route" href={'/swap?mint=' + encodeURIComponent(asset.mint)}>Route <ArrowUpRight size={13} /></Link>
    </article>)}</div>
    {!shown.length && !loading ? <div className="empty-panel">No assets match this filter.</div> : null}
    {loading && !assets.length ? <div className="empty-panel"><LoaderCircle className="spin" /> Loading live signal snapshot…</div> : null}
    <section className="market-disclosures"><div><span>HOW THE SCORE IS BUILT</span><p>Organic activity 32% · liquidity depth 20% · turnover 15% · holder spread 13% · buy pressure 12% · short-term calm 8%. The score ranks feed quality; it does not predict a return.</p></div><div><span>HARD RULES</span><p>Freeze authority active, liquidity below $100k, 24-hour volume below $100k, or top holders above 60% blocks a row. Sharp drawdown and thin depth produce warnings.</p></div><div><span>SCOPE</span><p>The engine reads public market data only. It does not know your wallet, sign transactions or place orders.</p></div></section>
  </main>;
}
