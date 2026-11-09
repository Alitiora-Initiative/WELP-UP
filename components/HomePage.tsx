'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Bot, CheckCircle2, ChevronRight, CircleDollarSign, LockKeyhole, ScanSearch, ShieldCheck, Sparkles, Wallet } from 'lucide-react';

type MarketAsset = { symbol: string; priceUsd: number; priceChange24h: number; liquidityUsd?: number; volume24hUsd?: number };
type MarketResponse = { assets?: MarketAsset[] };

const quickLinks = [
  { href: '/markets', icon: ScanSearch, label: 'Market screener', copy: 'Search live Solana assets, liquidity and turnover.' },
  { href: '/signals', icon: BarChart3, label: 'Signal engine', copy: 'Review transparent scores and qualification blockers.' },
  { href: '/swap', icon: CircleDollarSign, label: 'Swap desk', copy: 'Inspect a Jupiter route before you approve it.' },
  { href: '/portfolio', icon: Wallet, label: 'Portfolio', copy: 'View wallet-derived balances and activity.' },
];

function formatPrice(value: number) {
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toPrecision(4)}`;
}

export function HomePage() {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [feedState, setFeedState] = useState<'loading' | 'live' | 'offline'>('loading');

  useEffect(() => {
    let mounted = true;
    fetch('/api/markets', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as MarketResponse;
        if (!response.ok) throw new Error('Market feed unavailable');
        if (mounted) { setAssets(Array.isArray(data.assets) ? data.assets.slice(0, 5) : []); setFeedState('live'); }
      })
      .catch(() => { if (mounted) setFeedState('offline'); });
    return () => { mounted = false; };
  }, []);

  const gainers = assets.filter((asset) => asset.priceChange24h >= 0).length;
  const totalVolume = assets.reduce((sum, asset) => sum + (asset.volume24hUsd ?? 0), 0);

  return (
    <main className="terminal-page home-dashboard">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> SOLANA MARKET INTELLIGENCE</p>
          <h1>See the market.<br /><span>Keep the keys.</span></h1>
          <p className="dashboard-lede">A non-custodial workspace for researching live Solana markets, reviewing transparent signals, and approving every transaction yourself.</p>
          <div className="dashboard-actions"><Link href="/markets" className="primary-action">Open market board <ArrowRight size={15} /></Link><Link href="/signals" className="text-link">Review signals <ArrowUpRight size={14} /></Link></div>
          <div className="dashboard-trust"><span><LockKeyhole size={14} /> Wallet-approved execution</span><span><ShieldCheck size={14} /> No unattended trading</span></div>
        </div>
        <div className="dashboard-command-card">
          <div className="command-card-header"><span><i /> WELP COMMAND CENTRE</span><span className="command-badge">NON-CUSTODIAL</span></div>
          <div className="command-card-title"><span>Market pulse</span><strong>{feedState === 'live' ? 'LIVE' : feedState === 'offline' ? 'OFFLINE' : 'CONNECTING'}</strong></div>
          <div className="pulse-grid"><div><small>Assets indexed</small><strong>{assets.length || '—'}</strong></div><div><small>Positive movers</small><strong>{assets.length ? `${gainers}/${assets.length}` : '—'}</strong></div><div><small>24h volume</small><strong>{totalVolume ? `$${(totalVolume / 1000000).toFixed(1)}M` : '—'}</strong></div></div>
          <div className="command-card-footer"><span className={feedState === 'live' ? 'status-live' : ''}><i /> {feedState === 'live' ? 'Market feed connected' : feedState === 'offline' ? 'Market feed unavailable' : 'Connecting to market feed'}</span><Link href="/system-status">System status <ChevronRight size={13} /></Link></div>
        </div>
      </section>

      <section className="dashboard-section market-snapshot-section">
        <div className="section-heading"><div><p className="eyebrow">LIVE SNAPSHOT</p><h2>Markets worth a closer look</h2></div><Link href="/markets" className="text-link">View all markets <ArrowRight size={14} /></Link></div>
        <div className="market-snapshot-grid">{assets.length ? assets.map((asset) => <Link href="/markets" className="snapshot-card" key={asset.symbol}><span className="asset-avatar">{asset.symbol.slice(0, 1)}</span><span><strong>{asset.symbol}</strong><small>{formatPrice(asset.priceUsd)}</small></span><em className={asset.priceChange24h >= 0 ? 'positive' : 'negative'}>{asset.priceChange24h >= 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%</em></Link>) : <div className="dashboard-empty"><Sparkles size={16} /><span>{feedState === 'offline' ? 'The live market feed is temporarily unavailable.' : 'Connecting to the live market feed…'}</span></div>}</div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">WORKSPACE</p><h2>One desk for every decision</h2></div><span className="section-note">Research first. Approve second.</span></div>
        <div className="quick-link-grid">{quickLinks.map(({ href, icon: Icon, label, copy }) => <Link href={href} className="quick-link-card" key={href}><span className="quick-link-icon"><Icon size={17} /></span><span><strong>{label}</strong><small>{copy}</small></span><ArrowUpRight className="quick-link-arrow" size={15} /></Link>)}</div>
      </section>

      <section className="dashboard-status-panel"><div className="status-panel-title"><span className="status-panel-icon"><CheckCircle2 size={18} /></span><div><p className="eyebrow">OPERATING MODEL</p><h2>Clear controls by default</h2></div></div><div className="status-panel-items"><span><Bot size={15} /><strong>AI analysis</strong><small>Read-only workspace</small></span><span><Wallet size={15} /><strong>Wallet access</strong><small>Connect when you choose</small></span><span><ShieldCheck size={15} /><strong>Vault execution</strong><small>Gated until verified</small></span></div></section>
    </main>
  );
}
