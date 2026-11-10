'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChartPanel } from '@/components/ChartPanel';
import Link from 'next/link';
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  Copy,
  ChartNoAxesCombined,
  CircleGauge,
  Clock3,
  LockKeyhole,
  Rocket,
  Sparkles,
  Vault,
  Wallet,
} from 'lucide-react';

type Asset = {
  mint: string;
  name: string;
  symbol: string;
  logo?: string | null;
  priceUsd: number;
  priceChange24h: number;
  liquidityUsd: number;
  volume24hUsd: number;
  organicScore: number;
  score: number;
  verified: boolean;
  eligible: boolean;
  state: string;
};
type Feed = {
  assets: Asset[];
  total: number;
  eligible: number;
  blocked: number;
  liquidityUsd: number;
  volume24hUsd: number;
  updatedAt: string;
  solPriceUsd: number | null;
  provider?: { name: string; state: string; error?: string };
  priceProvider?: { name: string; state: string; error?: string };
  error?: string;
};
type DevelopmentFund = {
  recipient: string;
  goalLamports: number;
  balanceLamports: number | null;
  progressBps: number | null;
  checkedAt?: string;
  error?: string;
};
type ServiceCheck = { name: string; state: string; detail: string };
type ServiceStatus = { updatedAt: string; overall: string; error?: string; checks: ServiceCheck[] };

const money = (value: number) => value >= 1e9
  ? '$' + (value / 1e9).toFixed(1) + 'B'
  : value >= 1e6
    ? '$' + (value / 1e6).toFixed(1) + 'M'
    : value >= 1e3
      ? '$' + (value / 1e3).toFixed(1) + 'K'
      : '$' + value.toFixed(2);

const price = (value: number) => value >= 1000
  ? '$' + value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  : value >= 1
    ? '$' + value.toFixed(2)
    : value >= .01
      ? '$' + value.toFixed(4)
      : '$' + value.toPrecision(4);

const quickLinks = [
  { href: '/markets', icon: ChartNoAxesCombined, title: 'Market screener', copy: 'Search assets and compare live liquidity.' },
  { href: '/signals', icon: CircleGauge, title: 'Signal engine', copy: 'Review transparent scores and blockers.' },
  { href: '/swap', icon: ArrowDownUp, title: 'Swap desk', copy: 'Inspect a route before wallet approval.' },
  { href: '/launch-studio', icon: Rocket, title: 'Launch Studio', copy: 'Prepare a supported token launch.' },
  { href: '/automation', icon: Sparkles, title: 'Automation', copy: 'Build browser-local market watch policies.' },
  { href: '/portfolio', icon: Wallet, title: 'Portfolio', copy: 'Read balances from a connected wallet.' },
];

function checkState(status: ServiceStatus | null, name: string) {
  return status?.checks.find((check) => check.name.toLowerCase() === name.toLowerCase())?.state ?? 'Checking';
}

function stateTone(value: string) {
  if (/operational|enabled|live|ready/i.test(value)) return 'is-good';
  if (/not enabled|not configured|undeployed|disabled|unavailable|issue/i.test(value)) return 'is-warning';
  return 'is-neutral';
}

export function TerminalHome() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [feedError, setFeedError] = useState('');
  const [fund, setFund] = useState<DevelopmentFund | null>(null);
  const [copiedRecipient, setCopiedRecipient] = useState(false);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [statusError, setStatusError] = useState('');

  const refresh = useCallback(async () => {
    try {
      let response = await fetch('/api/markets', { cache: 'no-store' });
      if (response.status === 429) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        response = await fetch('/api/markets', { cache: 'no-store' });
      }
      const data = await response.json() as Feed;
      if (!response.ok) throw new Error(data.error || 'Market feed unavailable.');
      setFeed(data);
      setFeedError('');
    } catch (caught) {
      setFeedError(caught instanceof Error ? caught.message : 'Market feed unavailable.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/development-fund', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as DevelopmentFund;
        if (!response.ok) throw new Error(data.error || 'Development fund balance unavailable.');
        if (alive) setFund(data);
      })
      .catch(() => {
        if (alive) setFund(null);
      });
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        const data = await response.json() as ServiceStatus;
        if (!response.ok) throw new Error(data.error || 'Service status unavailable.');
        if (alive) {
          setStatus(data);
          setStatusError('');
        }
      } catch (caught) {
        if (alive) setStatusError(caught instanceof Error ? caught.message : 'Service status unavailable.');
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  const featured = useMemo(
    () => (feed?.assets ?? []).filter((asset) => asset.eligible).sort((a, b) => b.score - a.score).slice(0, 5),
    [feed],
  );
  const solPriceUsd = feed?.solPriceUsd ?? feed?.assets.find((asset) => asset.symbol.toUpperCase() === 'SOL')?.priceUsd ?? null;
  const updated = feed?.updatedAt
    ? new Date(feed.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';
  const fundValue = fund?.balanceLamports === null || fund?.balanceLamports === undefined
    ? 'Unavailable'
    : (fund.balanceLamports / 1e9).toFixed(4) + ' SOL';
  const feedState = feedError ? 'Unavailable' : feed ? 'Operational' : 'Connecting';

  return (
    <main className="terminal-page home-command">
      <section className="home-command-heading">
        <div>
          <div className="eyebrow"><i className="eyebrow-dot" /> SOLANA MARKET INTELLIGENCE</div>
          <h1>Market clarity.<br /><span>Keys stay yours.</span></h1>
          <p>Research live Solana markets, review transparent signals and approve every supported transaction from your own wallet.</p>
        </div>
        <div className="home-command-actions">
          <Link className="primary-action" href="/markets">Explore markets <ArrowRight size={15} /></Link>
          <Link className="home-outline-action" href="/swap">Open trade desk <ArrowUpRight size={14} /></Link>
        </div>
      </section>

      <section className="home-overview-grid" aria-label="Live market overview and service status">
        <article className="home-market-feature">
          <div className="home-panel-topline">
            <span><i className="eyebrow-dot" /> MARKET PULSE</span>
            <span className={'home-state ' + stateTone(feedState)}>{feedState.toUpperCase()}</span>
          </div>
          <div className="home-sol-overview">
            <div>
              <span className="home-data-label">SOL / USD</span>
              <strong>{solPriceUsd !== null ? price(solPriceUsd) : '—'}</strong>
              {feed?.priceProvider?.state === 'Operational' ? (
                <small className="home-muted-note">SOL mark verified by {feed.priceProvider.name}</small>
              ) : (
                <small className="home-muted-note">{feed?.priceProvider?.error || feedError || 'Waiting for live price data'}</small>
              )}
            </div>
            <div className="home-market-source">
              <span>DATA SOURCE</span>
              <strong>Jupiter Lite Token API v2</strong>
              <small><Clock3 size={12} /> Updated {updated} · {feed?.provider?.state ?? 'PENDING'}</small>
            </div>
          </div>
          <div className="home-market-metrics">
            <div><span>TRACKED ASSETS</span><strong>{feed ? feed.total.toLocaleString() : '—'}</strong></div>
            <div><span>ELIGIBLE NOW</span><strong>{feed ? feed.eligible.toLocaleString() : '—'}</strong></div>
            <div><span>BLOCKED</span><strong>{feed ? feed.blocked.toLocaleString() : '—'}</strong></div>
          </div>
          <div className="home-market-foot">
            <span>Prices and eligibility are provider data, not forecasts.</span>
            <Link href="/system-status">View system status <ArrowUpRight size={13} /></Link>
          </div>
        </article>

        <aside className="home-readiness-panel">
          <div className="home-panel-topline">
            <span>PLATFORM STATUS</span>
            <span className="home-state is-neutral">{status?.overall ?? (statusError ? 'STATUS UNAVAILABLE' : 'CHECKING')}</span>
          </div>
          <div className="home-readiness-list">
            <div className="home-readiness-row">
              <span className="home-readiness-icon"><Activity size={15} /></span>
              <span><strong>Market data</strong><small>Jupiter Token API v2</small></span>
              <em className={stateTone(checkState(status, 'Jupiter Token API v2'))}>{checkState(status, 'Jupiter Token API v2')}</em>
            </div>
            <div className="home-readiness-row">
              <span className="home-readiness-icon"><Wallet size={15} /></span>
              <span><strong>Swap approval</strong><small>Connected wallet signs each trade</small></span>
              <em className="is-good">USER SIGNED</em>
            </div>
            <div className="home-readiness-row">
              <span className="home-readiness-icon"><Bot size={15} /></span>
              <span><strong>Autonomous agents</strong><small>Background execution runtime</small></span>
              <em className={stateTone(checkState(status, 'Autonomous agents'))}>{checkState(status, 'Autonomous agents')}</em>
            </div>
            <div className="home-readiness-row">
              <span className="home-readiness-icon"><Vault size={15} /></span>
              <span><strong>Vault funding</strong><small>Mainnet vault deployment</small></span>
              <em className={stateTone(checkState(status, 'Vault program'))}>{checkState(status, 'Vault program')}</em>
            </div>
          </div>
          {statusError ? <p className="home-inline-error">{statusError}</p> : null}
        </aside>
      </section>

      <section className="home-kpi-grid" aria-label="Tracked market statistics">
        <article className="home-kpi-card"><span>TRACKED LIQUIDITY</span><strong>{feed ? money(feed.liquidityUsd) : '—'}</strong><small>Across the current feed</small></article>
        <article className="home-kpi-card"><span>24H MARKET VOLUME</span><strong>{feed ? money(feed.volume24hUsd) : '—'}</strong><small>Provider-reported turnover</small></article>
        <article className="home-kpi-card"><span>ELIGIBLE ASSETS</span><strong>{feed ? feed.eligible.toLocaleString() : '—'}</strong><small>Passed the current hard rules</small></article>
        <article className="home-kpi-card"><span>BLOCKED ASSETS</span><strong>{feed ? feed.blocked.toLocaleString() : '—'}</strong><small>Excluded by at least one rule</small></article>
      </section>

      {feed?.assets[0] ? <ChartPanel mint={feed.assets[0].mint} name={feed.assets[0].name} symbol={feed.assets[0].symbol} /> : null}

      {feedError ? (
        <div className="feed-error home-feed-error" role="alert">
          {feedError} <Link href="/system-status">Inspect service status</Link>
        </div>
      ) : null}

      <section className="home-section-terminal home-candidates-section">
        <div className="home-section-heading">
          <div>
            <div className="eyebrow">RULE-QUALIFIED MARKETS</div>
            <h2>Current eligible candidates</h2>
            <p className="home-section-copy">Sorted by the current rule score. Eligibility is a filter result, not a recommendation or prediction.</p>
          </div>
          <Link href="/signals" className="text-action">Open signal engine <ArrowUpRight size={13} /></Link>
        </div>
        <div className="home-candidate-table">
          <div className="home-candidate-table-head"><span>ASSET</span><span>PRICE</span><span>24H</span><span>LIQUIDITY</span><span>SCORE</span><span /></div>
          {featured.length ? featured.map((asset) => (
            <div className="home-candidate-table-row" key={asset.mint}>
              <div className="home-candidate-asset">{asset.logo ? <img className="home-candidate-avatar home-candidate-avatar-image" src={asset.logo} alt="" loading="lazy" /> : <span className="home-candidate-avatar">{asset.symbol.slice(0, 1).toUpperCase()}</span>}<span><strong>{asset.symbol}</strong><small>{asset.name}</small></span></div>
              <strong className="home-candidate-price">{price(asset.priceUsd)}</strong>
              <strong className={asset.priceChange24h >= 0 ? 'positive' : 'negative'}>{asset.priceChange24h >= 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%</strong>
              <span className="home-candidate-liquidity">{money(asset.liquidityUsd)}</span>
              <span className="home-candidate-score">{asset.score}<small>/100</small></span>
              <Link href={'/swap?mint=' + encodeURIComponent(asset.mint)} className="home-candidate-route" aria-label={'Review ' + asset.symbol + ' swap route'}>Review <ArrowUpRight size={13} /></Link>
            </div>
          )) : (
            <div className="home-empty-state">
              <ChartNoAxesCombined size={20} />
              <strong>{feedError ? 'Market data unavailable' : feed ? 'No eligible assets in this snapshot' : 'Loading live market candidates'}</strong>
              <p>{feedError || (feed ? 'No asset currently passes every configured eligibility rule.' : 'The market table will populate when the provider responds.')}</p>
            </div>
          )}
        </div>
      </section>

      <section className="home-section-terminal home-tools-section">
        <div className="home-section-heading">
          <div><div className="eyebrow">YOUR WORKSPACE</div><h2>Tools for the next decision</h2></div>
          <span className="home-section-meta">Research · Review · Approve</span>
        </div>
        <div className="home-quick-grid">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="home-quick-card" href={item.href} key={item.href}>
                <span className="home-quick-icon"><Icon size={18} /></span>
                <span><strong>{item.title}</strong><small>{item.copy}</small></span>
                <ArrowUpRight className="home-quick-arrow" size={15} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-development-fund">
        <div className="home-development-copy">
          <div className="eyebrow">COMMUNITY DEVELOPMENT FUND</div>
          <h2>Help fund the program review and deployment.</h2>
          <p>Contributions go directly to the published development wallet. Copy the address below and send SOL from your wallet; WELP cannot move these funds.</p>
        </div>
        <div className="home-development-balance">
          <span>VERIFIED WALLET BALANCE</span>
          <strong>{fundValue}</strong>
          <small>Goal: {(fund?.goalLamports ?? 4_000_000_000) / 1e9} SOL</small>
          <div className="home-fund-progress"><span style={{ width: Math.max(0, Math.min(100, (fund?.progressBps ?? 0) / 100)) + '%' }} /></div>
          <div className="home-fund-bottom">
            <span>{fund?.progressBps == null ? 'Balance unavailable' : (fund.progressBps / 100).toFixed(2) + '% funded'}</span>
            {fund?.recipient ? (
              <div className="home-fund-links">
                <button type="button" className="home-copy-wallet" onClick={async () => { await navigator.clipboard.writeText(fund.recipient); setCopiedRecipient(true); window.setTimeout(() => setCopiedRecipient(false), 1800); }} aria-label="Copy development wallet address">
                  {copiedRecipient ? <Check size={12} /> : <Copy size={12} />} {copiedRecipient ? 'Copied' : 'Copy wallet'}
                </button>
                <a href={'https://solscan.io/account/' + encodeURIComponent(fund.recipient)} target="_blank" rel="noreferrer">Verify on Solscan <ArrowUpRight size={12} /></a>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="home-operating-note">
        <span><LockKeyhole size={16} /></span>
        <div><strong>Your wallet. Your approval.</strong><p>WELP does not request seed phrases or hold private keys. Every supported swap is reviewed and signed by the connected wallet. Vault funding and unattended execution remain gated by production checks.</p></div>
        <Link href="/safety">Read safety rules <ArrowUpRight size={13} /></Link>
      </section>
      <div className="home-page-updated"><span>MARKET SNAPSHOT · {updated}</span><span>{status?.updatedAt ? 'STATUS CHECKED ' + new Date(status.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'STATUS CHECK PENDING'}</span></div>
    </main>
  );
}
