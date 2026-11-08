'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownUp, ArrowRight, ArrowUpRight, Bot, ChartNoAxesCombined, CircleGauge, LockKeyhole, ShieldCheck, Sparkles, Wallet } from 'lucide-react';

type Asset = {
  mint: string; name: string; symbol: string; priceUsd: number; priceChange24h: number;
  liquidityUsd: number; volume24hUsd: number; organicScore: number; score: number; verified: boolean; eligible: boolean;
};
type Feed = { assets: Asset[]; total: number; eligible: number; blocked: number; liquidityUsd: number; volume24hUsd: number; updatedAt: string; error?: string };
const money = (value: number) => value >= 1e9 ? '$' + (value / 1e9).toFixed(1) + 'B' : value >= 1e6 ? '$' + (value / 1e6).toFixed(1) + 'M' : value >= 1e3 ? '$' + (value / 1e3).toFixed(1) + 'K' : '$' + value.toFixed(2);
const price = (value: number) => value >= 1000 ? '$' + value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value >= 1 ? '$' + value.toFixed(2) : value >= .01 ? '$' + value.toFixed(4) : '$' + value.toPrecision(4);
const links = [
  { href: '/markets', icon: ChartNoAxesCombined, number: '01', title: 'Market board', description: 'Liquidity, turnover, holder depth and organic activity across the tracked Solana universe.', tag: 'LIVE FEED' },
  { href: '/signals', icon: CircleGauge, number: '02', title: 'Signal engine', description: 'Every tracked pool scored against published rules, with the reason it passed or was blocked.', tag: 'LIVE RULES' },
  { href: '/swap', icon: ArrowDownUp, number: '03', title: 'Swap desk', description: 'Review a Jupiter route, inspect the checks, then approve one transaction in your wallet.', tag: 'WALLET SIGNED' },
  { href: '/portfolio', icon: Wallet, number: '04', title: 'Portfolio', description: 'Read public wallet balances and transaction history from Solana mainnet.', tag: 'PUBLIC CHAIN DATA' },
  { href: '/automation', icon: Sparkles, number: '05', title: 'Automation policies', description: 'Save browser-local watch rules and evaluate them against the current market snapshot.', tag: 'NO AUTO-TRADING' },
  { href: '/agent', icon: Bot, number: '06', title: 'Market agent', description: 'See what is currently available for market analysis and what requires a hosted runtime.', tag: 'ANALYSIS BOUNDARIES' },
];

export function TerminalHome() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/markets', { cache: 'no-store' });
      const data = await response.json() as Feed;
      if (!response.ok) throw new Error(data.error || 'Market feed unavailable.');
      setFeed(data); setError('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Market feed unavailable.'); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); const interval = window.setInterval(() => void refresh(), 60_000); return () => { window.clearTimeout(timer); window.clearInterval(interval); }; }, [refresh]);
  const featured = (feed?.assets || []).filter((asset) => asset.eligible).slice(0, 5);
  const sol = feed?.assets?.find((asset) => asset.symbol === 'SOL');
  const updated = feed?.updatedAt ? new Date(feed.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  return <main className="terminal-page home-terminal">
    <section className="home-hero-terminal">
      <div className="home-hero-copy">
        <div className="eyebrow"><i className="eyebrow-dot" /> SOLANA MAINNET · NON-CUSTODIAL</div>
        <h1>Stay in control.<br /><span>See every move.</span></h1>
        <p>WELP reads live Solana markets, scores them against rules you can audit, and prepares a Jupiter route for your wallet to sign. Balances, quotes and swaps stay locked until your wallet session is open.</p>
        <div className="home-actions"><Link className="primary-action" href="/markets">Open market board <ArrowRight size={14} /></Link><Link className="home-secondary-link" href="/whitepaper">Read the whitepaper <ArrowUpRight size={13} /></Link></div>
        <div className="home-proof"><span><LockKeyhole size={13} /> Wallet signs every transaction</span><span><ShieldCheck size={13} /> No unattended trading</span></div>
      </div>
      <div className="home-market-card">
        <div className="home-market-card-top"><span><i /> SOL / USD · LIVE</span><span>{error ? 'FEED ISSUE' : feed ? 'JUPITER FEED' : 'CONNECTING'}</span></div>
        <strong>{sol ? price(sol.priceUsd) : '—'}</strong>
        {sol ? <em className={sol.priceChange24h >= 0 ? 'positive' : 'negative'}>{sol.priceChange24h >= 0 ? '+' : ''}{sol.priceChange24h.toFixed(2)}% <small>24H</small></em> : <small>Awaiting live market data</small>}
        <div className="home-market-snapshot">
          <div><span>TRACKED POOLS</span><strong>{feed ? feed.total : '—'}</strong></div>
          <div><span>ELIGIBLE NOW</span><strong>{feed ? feed.eligible : '—'}</strong></div>
          <div><span>BLOCKED</span><strong>{feed ? feed.blocked : '—'}</strong></div>
        </div>
        <div className="home-market-candidates">
          {(feed?.assets || []).filter((asset) => asset.eligible).slice(0, 4).map((asset) => <Link href={'/swap?mint=' + encodeURIComponent(asset.mint)} key={asset.mint}>
            <span className="home-market-rank">{asset.score}</span><strong>{asset.symbol}</strong><em>ELIGIBLE</em><small>{price(asset.priceUsd)}</small>
          </Link>)}
          {!feed?.assets?.length ? <p>{error || 'Loading current market snapshot…'}</p> : null}
        </div>
        <div className="home-market-card-foot"><span>Source · Jupiter Token API v2</span><span>Updated {updated}</span></div>
      </div>
    </section>
    {error ? <div className="feed-error">{error} <Link href="/system-status">Check system status</Link></div> : null}
    <section className="home-stat-strip">
      <div><span>TRACKED POOLS</span><strong>{feed ? feed.total : '—'}</strong><small>Organic Solana assets in the current feed</small></div>
      <div><span>ELIGIBLE NOW</span><strong>{feed ? feed.eligible : '—'}</strong><small>Passed every configured hard rule</small></div>
      <div><span>TRACKED LIQUIDITY</span><strong>{feed ? money(feed.liquidityUsd) : '—'}</strong><small>Sum across the tracked set</small></div>
      <div><span>24H VOLUME</span><strong>{feed ? money(feed.volume24hUsd) : '—'}</strong><small>Live feed · {updated}</small></div>
    </section>
    <section className="home-section-terminal">
      <div className="home-section-heading"><div><div className="eyebrow">THE WORKSPACE</div><h2>Every tool has its own page.</h2></div><Link href="/markets" className="text-action">Open market board <ArrowUpRight size={13} /></Link></div>
      <div className="home-tools-grid">{links.map((item) => <Link className="home-tool-card" href={item.href} key={item.href}><div className="home-tool-top"><span>{item.number}</span><item.icon size={18} /></div><h3>{item.title}</h3><p>{item.description}</p><small>{item.tag}</small><ArrowUpRight className="home-tool-arrow" size={14} /></Link>)}</div>
    </section>
    <section className="home-section-terminal">
      <div className="home-section-heading"><div><div className="eyebrow">CURRENT MARKET READ</div><h2>Live candidates. Published rules.</h2><p className="home-section-copy">The strongest eligible entries in the current feed. A score is a filter result, not a forecast or recommendation.</p></div><Link href="/signals" className="text-action">View all signals <ArrowUpRight size={13} /></Link></div>
      <div className="home-candidate-list">{featured.map((asset) => <div className="home-candidate" key={asset.mint}><div><strong>{asset.symbol}</strong><small>{asset.name}</small></div><span>{price(asset.priceUsd)}</span><span className={asset.priceChange24h >= 0 ? 'positive' : 'negative'}>{asset.priceChange24h >= 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%</span><b>{asset.score}</b><Link href={'/swap?mint=' + encodeURIComponent(asset.mint)}>Route <ArrowUpRight size={12} /></Link></div>)}{!featured.length ? <div className="empty-panel">{error || 'Loading current market snapshot…'}</div> : null}</div>
    </section>
    <section className="home-section">
      <div className="home-section-heading">
        <div>
          <div className="eyebrow">THE PIPELINE</div>
          <h2>From signal to signed move.</h2>
          <p>Three boundaries. Read, score, sign.</p>
        </div>
        <Link href="/swap" className="text-action">Open trade desk <ArrowUpRight size={13} /></Link>
      </div>
      <div className="home-steps">
        <div className="home-step">
          <div className="home-step-top"><span className="home-step-number">01</span><span className="home-step-icon"><ChartNoAxesCombined size={16} /></span></div>
          <h3>Read the market</h3>
          <p>Live tracked Solana pools and prices from the Jupiter Token API feed.</p>
        </div>
        <div className="home-step">
          <div className="home-step-top"><span className="home-step-number">02</span><span className="home-step-icon"><CircleGauge size={16} /></span></div>
          <h3>Score the setup</h3>
          <p>Deterministic signals from 80 to 98 with every blocker shown.</p>
        </div>
        <div className="home-step">
          <div className="home-step-top"><span className="home-step-number">03</span><span className="home-step-icon"><ArrowDownUp size={16} /></span></div>
          <h3>Sign the swap</h3>
          <p>A Jupiter route is prepared and your wallet approves the transaction.</p>
        </div>
      </div>
    </section>
    <section className="home-safety-banner"><div><ShieldCheck size={20} /><div><strong>Your wallet. Your approval.</strong><p>WELP never asks for a seed phrase. Every available swap is reviewed and signed by your connected wallet. Vault funding and autonomous execution remain disabled.</p></div></div><Link href="/safety">Read safety limits <ArrowUpRight size={13} /></Link></section>
  </main>;
}
