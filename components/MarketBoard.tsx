'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDownWideNarrow, ArrowUpRight, ChevronLeft, ChevronRight, CircleHelp, Download, LoaderCircle, RefreshCw, Search, Star } from 'lucide-react';
import { ChartPanel } from '@/components/ChartPanel';

type Asset = {
  mint: string; name: string; symbol: string; logo: string | null; priceUsd: number; priceChange24h: number;
  liquidityUsd: number; volume24hUsd: number; holders: number; organicScore: number; score: number;
  verified: boolean; state: 'Eligible' | 'Watch' | 'Blocked'; eligible: boolean; blockers: string[]; warnings: string[];
};
type Feed = { updatedAt: string; total: number; eligible: number; blocked: number; liquidityUsd: number; volume24hUsd: number; assets: Asset[]; error?: string };
type Filter = 'All' | 'Eligible' | 'Blocked' | 'Score 90+' | 'Verified';
const compact = (value: number) => value >= 1e9 ? '$' + (value / 1e9).toFixed(1) + 'B' : value >= 1e6 ? '$' + (value / 1e6).toFixed(1) + 'M' : value >= 1e3 ? '$' + (value / 1e3).toFixed(value >= 1e5 ? 0 : 1) + 'K' : '$' + value.toFixed(2);
const price = (value: number) => value >= 1000 ? '$' + value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value >= 1 ? '$' + value.toFixed(2) : value >= .01 ? '$' + value.toFixed(4) : '$' + value.toPrecision(4);
const short = (value: string) => value.slice(0, 5) + '…' + value.slice(-5);
const EMPTY_ASSETS: Asset[] = [];
function csvCell(value: string | number | boolean) {
  const text = String(value);
  const safe = typeof value === 'string' && /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function MarketBoard() {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [sort, setSort] = useState<'score' | 'liquidity' | 'volume'>('score');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [chartMint, setChartMint] = useState('');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const pageSize = 8;
  useEffect(() => { const timer = window.setTimeout(() => { try { setWatchlist(JSON.parse(localStorage.getItem('welp-watchlist') || '[]') as string[]); } catch { setWatchlist([]); } }, 0); return () => window.clearTimeout(timer); }, []);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/markets', { cache: 'no-store' });
      const data = await response.json() as Feed;
      if (!response.ok) throw new Error(data.error || 'Could not load the live market feed.');
      setFeed(data);
      setChartMint((current) => current || data.assets[0]?.mint || '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Market feed unavailable.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(true), 60_000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(true); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);

  const assets = feed?.assets ?? EMPTY_ASSETS;
  const chartAsset = assets.find((asset) => asset.mint === chartMint) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filteredRows = assets.filter((asset) => {
      const matchesText = !q || asset.symbol.toLowerCase().includes(q) || asset.name.toLowerCase().includes(q) || asset.mint.toLowerCase().includes(q);
      const matchesTab = filter === 'All' || (filter === 'Eligible' && asset.eligible) || (filter === 'Blocked' && !asset.eligible) || (filter === 'Score 90+' && asset.score >= 90) || (filter === 'Verified' && asset.verified);
      return matchesText && matchesTab;
    });
    return filteredRows.sort((a, b) => sort === 'liquidity' ? b.liquidityUsd - a.liquidityUsd : sort === 'volume' ? b.volume24hUsd - a.volume24hUsd : b.score - a.score);
  }, [assets, query, filter, sort]);
  const selectedAssets = assets.filter((asset) => selected.includes(asset.mint));
  const exportRows = selected.length ? selectedAssets : filtered;
  const canTradeSelected = selected.length === 1 && selectedAssets[0]?.eligible === true;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  function toggleWatch(mint: string) {
    setWatchlist((current) => {
      const next = current.includes(mint) ? current.filter((item) => item !== mint) : [...current, mint];
      try { localStorage.setItem('welp-watchlist', JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function exportCsv() {
    const columns = ['Symbol', 'Name', 'Mint', 'Price USD', '24h Change %', 'Liquidity USD', '24h Volume USD', 'Organic Score', 'Rule Score', 'State', 'Eligible', 'Blockers', 'Warnings'];
    const lines = [
      columns.map(csvCell).join(','),
      ...exportRows.map((asset) => [
        asset.symbol, asset.name, asset.mint, asset.priceUsd, asset.priceChange24h, asset.liquidityUsd,
        asset.volume24hUsd, asset.organicScore, asset.score, asset.state, asset.eligible ? 'yes' : 'no',
        asset.blockers.join('; '), asset.warnings.join('; '),
      ].map(csvCell).join(',')),
    ];
    const blobUrl = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `welp-market-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  }
  const updated = feed?.updatedAt ? new Date(feed.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  const tabs: Array<{ key: Filter; value: number }> = [
    { key: 'All', value: feed?.total ?? 0 }, { key: 'Eligible', value: feed?.eligible ?? 0 },
    { key: 'Blocked', value: feed?.blocked ?? 0 }, { key: 'Score 90+', value: assets.filter((a) => a.score >= 90).length },
    { key: 'Verified', value: assets.filter((a) => a.verified).length },
  ];

  return <main className="terminal-page market-page">
    <div className="market-intro-row"><div>
      <div className="eyebrow"><i className="eyebrow-dot" /> LIVE MARKET BOARD · SOLANA MAINNET</div>
      <h1>Every tracked pool, <span>one screen.</span></h1>
      <p>Prices, liquidity, turnover and holder depth read from Jupiter’s live token feed. The engine scores each asset against published rules; nothing is reordered by hand.</p>
    </div><div className="feed-actions"><span className={'live-status ' + (feed && !error ? 'is-live' : 'is-muted')}><i />{loading && !feed ? 'CONNECTING' : error ? 'FEED ISSUE' : 'LIVE FEED'}</span><button className="outline-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh</button></div></div>

    <section className="market-stats">
      <div><span>TRACKED ASSETS</span><strong>{feed ? feed.total.toFixed(0) : '—'}</strong><small>Top organic Solana assets from the live feed</small></div>
      <div><span>ELIGIBLE NOW</span><strong>{feed ? feed.eligible : '—'}</strong><small>Passed every hard rule</small></div>
      <div><span>TRACKED LIQUIDITY</span><strong>{feed ? compact(feed.liquidityUsd) : '—'}</strong><small>Sum across the tracked set</small></div>
      <div><span>24H VOLUME</span><strong>{feed ? compact(feed.volume24hUsd) : '—'}</strong><small>Feed updated {updated}</small></div>
    </section>

    {error ? <div className="feed-error" role="alert"><strong>Market feed unavailable</strong><span>{error}</span><button className="text-action" onClick={() => void refresh()}>Try again</button></div> : null}
    <div className="market-toolbar"><label className="market-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search symbol, name or mint" aria-label="Search symbol, name or mint" /></label><div className="market-sort"><span>Sorted by</span><select value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }} aria-label="Sort assets"><option value="score">Engine score</option><option value="liquidity">Liquidity</option><option value="volume">24h volume</option></select><button className="text-action" onClick={() => setRulesOpen((value) => !value)}><CircleHelp size={14} /> Why a row is blocked</button></div></div>

    {rulesOpen ? <div className="rules-explainer"><div><strong>Hard rules</strong><span>Active freeze authority · liquidity below $100k · 24h volume below $100k · top holders above 60%.</span></div><div><strong>Warnings</strong><span>Liquidity below $250k · 24h drawdown beyond −25% · concentrated holders · incomplete feed data.</span></div><button onClick={() => setRulesOpen(false)} aria-label="Close explanation">×</button></div> : null}

    <section className="market-board">
      <div className="market-board-heading"><div><h2>market board</h2><span>{feed ? feed.total + ' assets' : '—'} · {pageSize} per page · {updated}</span></div></div>
      <div className="market-tabs">{tabs.map((tab) => <button key={tab.key} className={filter === tab.key ? 'selected' : ''} onClick={() => { setFilter(tab.key); setPage(1); }}><span>{tab.key === 'Eligible' ? <i className="tab-dot green" /> : tab.key === 'Blocked' ? <i className="tab-dot red" /> : tab.key === 'Score 90+' ? <i className="tab-dot blue" /> : tab.key === 'Verified' ? <i className="tab-dot violet" /> : null}{tab.key}</span><b>{tab.value}</b></button>)}</div>
      <div className="selection-bar"><span>{selected.length} selected</span><div className="selection-actions">
        <button className="outline-button small" disabled={!exportRows.length} onClick={exportCsv}><Download size={13} /> Export CSV ({exportRows.length})</button>
        <button className="outline-button small" disabled={!canTradeSelected} title={!canTradeSelected ? 'Select exactly one eligible token.' : undefined} onClick={() => { const asset = selectedAssets[0]; if (asset?.eligible) router.push('/swap?mint=' + encodeURIComponent(asset.mint)); }}>Trade selected</button>
        <button className="text-action" disabled={!selected.length} onClick={() => setSelected([])}>Clear</button>
      </div></div>
      <div className="market-table-wrap"><table className="market-table"><thead><tr>
        <th><input aria-label="Select all rows on this page" type="checkbox" checked={rows.length > 0 && rows.every((row) => selected.includes(row.mint))} onChange={(event) => setSelected((current) => event.target.checked ? Array.from(new Set([...current, ...rows.map((row) => row.mint)])) : current.filter((id) => !rows.some((row) => row.mint === id)))} /></th>
        <th>ASSET</th><th>PRICE</th><th>24H</th><th>LIQUIDITY</th><th>24H VOL</th><th>ORGANIC</th><th><button className="sort-heading" onClick={() => setSort('score')}>SCORE <ArrowDownWideNarrow size={12} /></button></th><th>STATE</th><th>CHART</th><th />
      </tr></thead><tbody>
        {rows.map((asset) => <tr key={asset.mint}>
          <td><input type="checkbox" aria-label={'Select ' + asset.symbol} checked={selected.includes(asset.mint)} onChange={() => setSelected((current) => current.includes(asset.mint) ? current.filter((id) => id !== asset.mint) : [...current, asset.mint])} /></td>
          <td><div className="asset-cell">{asset.logo ? <img src={asset.logo} alt="" loading="lazy" /> : <span className="asset-avatar">{asset.symbol.slice(0,1)}</span>}<div><strong>{asset.symbol}{asset.verified ? <span className="verified-mark" title="Feed-verified"> V</span> : null}</strong><small>{asset.name}</small><code title={asset.mint}>{short(asset.mint)}</code></div></div></td>
          <td className="numeric">{price(asset.priceUsd)}</td><td className={'numeric ' + (asset.priceChange24h >= 0 ? 'positive' : 'negative')}>{asset.priceChange24h >= 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%</td>
          <td className="numeric">{compact(asset.liquidityUsd)}</td><td className="numeric">{compact(asset.volume24hUsd)}</td><td className="numeric">{asset.organicScore}</td><td className="score-cell">{asset.score}</td>
          <td><span className={'asset-state state-' + asset.state.toLowerCase()}>{asset.state}</span><small className="state-reason">{asset.blockers[0] || asset.warnings[0] || ''}</small></td>
          <td><button type="button" className="market-chart-button" aria-pressed={chartMint === asset.mint} onClick={() => setChartMint(asset.mint)}>Chart</button></td>
          <td><Link className="outline-button" href={'/swap?mint=' + encodeURIComponent(asset.mint)}>{asset.eligible ? 'Buy' : 'Review'}</Link></td>
          <td><button className={'watch-button ' + (watchlist.includes(asset.mint) ? 'is-watched' : '')} aria-label={watchlist.includes(asset.mint) ? 'Remove from watchlist' : 'Add to watchlist'} onClick={() => toggleWatch(asset.mint)}><Star size={15} fill={watchlist.includes(asset.mint) ? 'currentColor' : 'none'} /></button></td>
        </tr>)}
        {!rows.length ? <tr><td colSpan={11} className="empty-table">{loading ? <><LoaderCircle className="spin" size={18} /> Loading Jupiter assets…</> : error ? 'Waiting for the feed to recover.' : 'No assets match this search or filter.'}</td></tr> : null}
      </tbody></table></div>
      <div className="market-pagination"><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /></button><span>Page {page} of {pages}</span><button aria-label="Next page" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}><ChevronRight size={15} /></button></div></div>
    </section>
    {chartAsset ? <ChartPanel mint={chartAsset.mint} name={chartAsset.name} symbol={chartAsset.symbol} /> : null}
    <div className="market-disclosures"><section><span>FEED CONTRACT</span><p>Prices, liquidity and volume come from Jupiter Token API v2. This page refreshes every 60 seconds and when the tab becomes visible. Venue fees, market hours and outages belong to the venue.</p></section><section><span>WHAT THE SCORE MEANS</span><p>The score is a weighted read of live fields — organic activity, depth, turnover, holder spread, buy pressure and short-term calm — mapped into an 80–98 band. It is not a probability of profit.</p></section><section><span>BEFORE YOU ROUTE AN ORDER</span><p>A qualified row is still a volatile asset. Review the route and price impact on the swap desk, then sign one transaction at a time in your wallet.</p><Link href="/swap">Open trade desk <ArrowUpRight size={13} /></Link></section></div>
  </main>;
}
