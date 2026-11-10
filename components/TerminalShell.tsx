'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  ArrowDownUp,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  CircleHelp,
  Coins,
  FileText,
  Gauge,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  UserRound,
  Vault,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';

type Ticker = { mint: string; symbol: string; priceUsd: number; priceChange24h: number };
type Feed = { assets?: Ticker[] };
type NavItem = { label: string; href: string; description: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'WORKSPACE',
    items: [
      { label: 'Overview', href: '/', description: 'Command centre and live market pulse', icon: LayoutDashboard },
      { label: 'Markets', href: '/markets', description: 'Browse live Solana markets', icon: BarChart3 },
      { label: 'Signals', href: '/signals', description: 'Review rule-based opportunities', icon: Activity },
      { label: 'Swap desk', href: '/swap', description: 'Review and approve a Jupiter swap', icon: ArrowDownUp },
      { label: 'Launch Studio', href: '/launch-studio', description: 'Create and inspect token launches', icon: Coins },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { label: 'Automation policies', href: '/automation', description: 'Configure browser-local market watches', icon: Gauge },
      { label: 'AI analyst', href: '/agent', description: 'Read-only market analysis', icon: Bot },
      { label: 'Agent monitor', href: '/autonomous', description: 'Runtime and execution permissions', icon: Activity },
      { label: 'Strategy marketplace', href: '/strategy-marketplace', description: 'Explore strategy listings and status', icon: Search },
      { label: 'Token explorer', href: '/token-explorer', description: 'Inspect token and mint information', icon: Search },
      { label: 'Risk dashboard', href: '/risk-dashboard', description: 'Review risk checks and exposure', icon: ShieldCheck },
      { label: 'Leaderboard', href: '/leaderboard', description: 'Compare tracked market activity', icon: Trophy },
    ],
  },
  {
    label: 'ASSETS',
    items: [
      { label: 'Vault console', href: '/vault', description: 'Vault authority and release gates', icon: Vault },
      { label: 'Portfolio', href: '/portfolio', description: 'Wallet balances and snapshots', icon: Wallet },
      { label: 'Transaction history', href: '/history', description: 'Public on-chain transaction records', icon: ArrowUpRight },
      { label: 'Activity logs', href: '/activity-logs', description: 'Browser-local activity records', icon: FileText },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { label: 'Profile', href: '/profile', description: 'Wallet profile and preferences', icon: UserRound },
      { label: 'Settings', href: '/settings', description: 'Appearance and account settings', icon: Settings },
      { label: 'API keys', href: '/api-keys', description: 'API access information', icon: Search },
      { label: 'Referral programme', href: '/referral', description: 'Referral programme information', icon: Coins },
      { label: 'Governance', href: '/governance', description: 'Governance information', icon: ShieldCheck },
    ],
  },
  {
    label: 'RESOURCES',
    items: [
      { label: 'System status', href: '/system-status', description: 'Live service checks', icon: Activity },
      { label: 'Support centre', href: '/support', description: 'Help and troubleshooting', icon: CircleHelp },
      { label: 'Documentation', href: '/docs', description: 'Architecture, limits and runbook', icon: BookOpen },
      { label: 'Whitepaper', href: '/whitepaper', description: 'Technical design and disclosures', icon: FileText },
      { label: 'Safety rules', href: '/safety', description: 'Transaction checks and risk limits', icon: ShieldCheck },
      { label: 'Terms', href: '/terms', description: 'Service terms', icon: FileText },
      { label: 'Privacy', href: '/privacy', description: 'Privacy policy', icon: ShieldCheck },
    ],
  },
];

const tickerSymbols = ['SOL', 'USDC', 'PUMP', 'USDT', 'WBTC', 'JUP', 'BONK', 'JitoSOL'];

function price(value: number) {
  if (value >= 1000) return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (value >= 1) return '$' + value.toFixed(2);
  if (value >= 0.01) return '$' + value.toFixed(4);
  return '$' + value.toPrecision(4);
}

function TickerStrip() {
  const [assets, setAssets] = useState<Ticker[]>([]);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/markets', { cache: 'no-store' });
        const data = await response.json() as Feed;
        if (!response.ok) throw new Error('Market feed unavailable');
        const rows = Array.isArray(data.assets) ? data.assets : [];
        const selected = tickerSymbols
          .map((symbol) => rows.find((row) => row.symbol.toUpperCase() === symbol.toUpperCase()))
          .filter((row): row is Ticker => Boolean(row));
        if (active) {
          setAssets(selected);
          setStatus('live');
        }
      } catch {
        if (active) setStatus('offline');
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="ticker-strip command-ticker">
      <div className="ticker-track">
        {assets.length ? (
          [0, 1].map((copy) => (
            <div className="ticker-group" key={copy} aria-hidden={copy === 1}>
              {assets.map((asset) => (
                <span className="ticker-item" key={copy + asset.mint}>
                  <strong>{asset.symbol}</strong>
                  <span>{price(asset.priceUsd)}</span>
                  <em className={asset.priceChange24h >= 0 ? 'positive' : 'negative'}>
                    {asset.priceChange24h >= 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%
                  </em>
                </span>
              ))}
            </div>
          ))
        ) : (
          <span className="ticker-status">
            {status === 'offline' ? 'Market feed unavailable' : 'Connecting to live Solana markets…'}
          </span>
        )}
      </div>
      <span className={'ticker-live ' + (status === 'live' ? 'is-live' : '')}>
        <i />{status === 'live' ? 'LIVE DATA' : status === 'offline' ? 'FEED ISSUE' : 'CONNECTING'}
      </span>
    </div>
  );
}

function isActivePath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

export function TerminalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const currentPage = navGroups.flatMap((group) => group.items).find((item) => isActivePath(pathname, item.href));
  const activeGroup = navGroups.find((group) =>
    group.items.some((item) => isActivePath(pathname, item.href)),
  )?.label;
  const pageTitle = currentPage?.label ?? 'WELP UP';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function toggleSidebar() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setMobileOpen((value) => !value);
      return;
    }
    setCollapsed((value) => !value);
  }

  function toggleGroup(label: string) {
    setExpandedGroups((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  }

  return (
    <div className={'terminal-site command-site' + (collapsed ? ' sidebar-collapsed' : '')}>
      <aside className={'command-sidebar' + (mobileOpen ? ' is-open' : '')} id="welp-app-navigation">
        <div className="command-brand">
          <Link href="/" className="command-brand-link" aria-label="WELP UP overview">
            <Image src="/welp-up-logo.svg" alt="" width={38} height={38} priority />
            <span><strong>WELP UP!</strong><small>MARKET INTELLIGENCE</small></span>
          </Link>
          <span className="command-network"><i /> MAINNET</span>
        </div>

        <nav className="command-nav" aria-label="Application navigation">
          {navGroups.map((group, groupIndex) => {
            const expanded = group.label === 'WORKSPACE' || expandedGroups.includes(group.label) || group.label === activeGroup;
            const groupActive = group.items.some((item) => isActivePath(pathname, item.href));
            return (
              <section className={'command-nav-group' + (groupIndex === 0 ? ' command-nav-primary' : '')} key={group.label}>
                {groupIndex === 0 ? (
                  <p className="command-nav-label">{group.label}</p>
                ) : (
                  <button
                    type="button"
                    className={'command-nav-label command-nav-toggle' + (groupActive ? ' has-active' : '')}
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={expanded}
                  >
                    <span>{group.label}</span>
                    <ChevronDown size={13} />
                  </button>
                )}
                {expanded ? (
                  <div className="command-nav-items">
                    {group.items.map((item) => {
                      const active = isActivePath(pathname, item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          href={item.href}
                          key={item.href}
                          className={'command-nav-link' + (active ? ' is-active' : '')}
                          onClick={() => setMobileOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          title={collapsed ? item.label : undefined}
                        >
                          <Icon size={17} strokeWidth={1.8} />
                          <span>{item.label}</span>
                          {active ? <i className="command-nav-active-indicator" /> : null}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </nav>

        <div className="command-sidebar-bottom">
          <div className="command-security-card">
            <span className="command-security-icon"><ShieldCheck size={16} /></span>
            <div><strong>Wallet-controlled</strong><small>Every supported swap needs your approval.</small></div>
          </div>
          <Link href="/system-status" className="command-sidebar-status">
            <span className="command-status-dot" /> Service status <ArrowUpRight size={13} />
          </Link>
        </div>
      </aside>

      {mobileOpen ? (
        <button className="command-scrim" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
      ) : null}

      <div className="command-content">
        <header className="command-header">
          <div className="command-header-left">
            <button
              type="button"
              className="command-menu-button"
              onClick={toggleSidebar}
              aria-label="Toggle application navigation"
              aria-expanded={mobileOpen || !collapsed}
              aria-controls="welp-app-navigation"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="command-breadcrumb">
              <span>WELP UP</span><i>/</i><strong>{pageTitle}</strong>
            </div>
          </div>
          <nav className="command-top-nav" aria-label="Primary navigation">
            <Link href="/markets">Markets</Link>
            <Link href="/swap">Trade</Link>
            <Link href="/automation">Automate</Link>
            <Link href="/vault">Vault</Link>
            <Link href="/portfolio">Console</Link>
            <Link href="/docs">Docs</Link>
          </nav>
          <div className="command-header-actions">
            <span className="command-header-network"><i /> SOLANA MAINNET</span>
            <Link href="/swap" className="command-trade-link">Open trade desk <ArrowUpRight size={14} /></Link>
            <WalletConnectionControl />
          </div>
        </header>

        <TickerStrip />
        <div className="site-main">{children}</div>

        <footer className="command-footer">
          <div className="command-footer-brand">
            <Image src="/welp-up-logo.svg" alt="" width={25} height={25} />
            <strong>WELP UP!</strong>
            <span>Solana market intelligence</span>
          </div>
          <div className="command-footer-links">
            <Link href="/docs">Docs</Link>
            <Link href="/whitepaper">Whitepaper</Link>
            <Link href="/safety">Safety</Link>
            <a href="https://github.com/Alitiora-Initiative/WELP-UP" target="_blank" rel="noreferrer">Source <ArrowUpRight size={12} /></a>
          </div>
          <small>Digital assets can lose all value. Review every wallet transaction.</small>
        </footer>
      </div>
    </div>
  );
}
