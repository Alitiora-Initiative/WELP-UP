'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpRight, ChevronDown, Menu, X } from 'lucide-react';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';

type Ticker = { mint: string; symbol: string; priceUsd: number; priceChange24h: number };
type Feed = { assets?: Ticker[] };
const nav = [
  { label: 'Markets', href: '/markets' }, { label: 'Trade', href: '/swap' },
  { label: 'Automate', href: '/automation' }, { label: 'Vault', href: '/vault' },
  { label: 'Console', href: '/dashboard' }, { label: 'Docs', href: '/docs' },
];
const tickerSymbols = ['SOL', 'USDC', 'PUMP', 'USDT', 'WBTC', 'TTWO', 'HYPE', 'JUP', 'BONK', 'cbBTC'];
function price(value: number) {
  if (value >= 1000) return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (value >= 1) return '$' + value.toFixed(2);
  if (value >= 0.01) return '$' + value.toFixed(4);
  return '$' + value.toPrecision(4);
}
function TickerStrip() {
  const [assets, setAssets] = useState<Ticker[]>([]);
  const [status, setStatus] = useState('connecting');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/markets', { cache: 'no-store' });
        const data = await response.json() as Feed;
        if (!response.ok) throw new Error('feed unavailable');
        const rows = Array.isArray(data.assets) ? data.assets : [];
        const selected = tickerSymbols.map((symbol) => rows.find((row) => row.symbol.toUpperCase() === symbol.toUpperCase())).filter((row): row is Ticker => Boolean(row));
        if (active) { setAssets(selected); setStatus('live'); }
      } catch { if (active) setStatus('offline'); }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return <div className="ticker-strip"><div className="ticker-track">
    {[0, 1].map((copy) => <div className="ticker-group" key={copy} aria-hidden={copy === 1}>
      {assets.map((asset) => <span className="ticker-item" key={copy + asset.mint}><strong>{asset.symbol}</strong><span>{price(asset.priceUsd)}</span><em className={asset.priceChange24h >= 0 ? 'positive' : 'negative'}>{asset.priceChange24h >= 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%</em></span>)}
    </div>)}
    {!assets.length ? <span className="ticker-status">{status === 'offline' ? 'Market feed unavailable' : 'Loading live market feed…'}</span> : null}
  </div><span className={'ticker-live ' + (status === 'live' ? 'is-live' : '')}><i />{status === 'live' ? 'LIVE FEED' : status === 'offline' ? 'FEED ISSUE' : 'CONNECTING'}</span></div>;
}

export function TerminalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href + '/'));
  return <div className="terminal-site">
    <header className="site-header">
      <Link href="/" className="site-brand"><span className="site-brand-mark">W</span><strong>WELP UP!</strong><span className="network-badge"><i /> MAINNET</span></Link>
      <nav className={'site-nav' + (open ? ' is-open' : '')} aria-label="Main navigation">
        {nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={isActive(item.href) ? 'is-active' : ''}>{item.label}{item.label === 'Console' || item.label === 'Docs' ? <ChevronDown size={12} /> : null}</Link>)}
      </nav>
      <div className="site-header-actions"><Link className="desk-link" href="/swap">Open trade desk <ArrowUpRight size={14} /></Link><WalletConnectionControl /><button className="mobile-nav-toggle" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close navigation' : 'Open navigation'}>{open ? <X size={18} /> : <Menu size={18} />}</button></div>
    </header>
    <TickerStrip />
    <div className="site-main">{children}</div>
    <footer className="site-footer">
      <div className="footer-brand"><span className="site-brand-mark">W</span><div><strong>WELP UP!</strong><p>A Solana market console. Live pools, published rules, wallet-approved execution. WELP never holds keys and never trades on your behalf.</p><small>Operator · Alitiora Initiative · Kenya</small></div></div>
      <div className="footer-column"><strong>PRODUCT</strong><Link href="/markets">Market board</Link><Link href="/signals">Signal engine</Link><Link href="/swap">Swap desk</Link><Link href="/portfolio">Portfolio</Link></div>
      <div className="footer-column"><strong>AUTOMATION</strong><Link href="/automation">Signal policies</Link><Link href="/agent">Market agent</Link><Link href="/vault">Vault console</Link><Link href="/strategy-marketplace">Strategy marketplace</Link></div>
      <div className="footer-column"><strong>CONSOLE</strong><Link href="/profile">Profile</Link><Link href="/history">Transaction history</Link><Link href="/activity-logs">Activity logs</Link><Link href="/support">Support centre</Link><Link href="/system-status">System status</Link></div>
      <div className="footer-column"><strong>RECORD</strong><Link href="/docs">Documentation</Link><Link href="/whitepaper">Whitepaper</Link><Link href="/safety">Safety limits</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div>
      <div className="footer-bottom"><span>© 2026 WELP UP! · MIT licensed interface source.</span><span>Not investment advice. Digital assets can lose all value.</span><span>Solana mainnet · non-custodial</span></div>
    </footer>
  </div>;
}
