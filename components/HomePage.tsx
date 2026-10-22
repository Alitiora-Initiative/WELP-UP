'use client';

import Link from 'next/link';
import { ArrowDownUp, ArrowRight, Activity, BookOpenCheck, Bot, ChartNoAxesCombined, CircleDollarSign, ExternalLink, LockKeyhole, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';

const steps = [
  { number: '01', icon: Wallet, title: 'Site wallet session', copy: 'Balances, signals, and swaps stay locked until the wallet session on this website is active.' },
  { number: '02', icon: Activity, title: 'Review the market', copy: 'The current rule engine checks live Solana pools and surfaces candidates with the reasons behind each score.' },
  { number: '03', icon: ArrowDownUp, title: 'Choose and approve', copy: 'Set an amount, inspect the route, then sign each individual swap in Phantom. The opening amount is 0.001 SOL and remains editable.' },
];

const destinations = [
  { href: '/signals', icon: Activity, title: 'Live signals', copy: 'Review candidates, price movement, score and entry status.' },
  { href: '/autonomous', icon: Bot, title: 'Autonomous AI', copy: 'Configure AI-powered trading strategies (coming soon).' },
  { href: '/swap', icon: ArrowDownUp, title: 'Swap', copy: 'Prepare a quote and approve one transaction in your wallet.' },
  { href: '/activity', icon: ChartNoAxesCombined, title: 'Portfolio activity', copy: 'See recorded wallet snapshots, scans and approved swaps.' },
  { href: '/safety', icon: ShieldCheck, title: 'Safety rules', copy: 'Read the current limits and what the app does not do yet.' },
];

export function HomePage() {
  return (
    <main className="app-shell">
      <AppSidebar active="home" status="Analysis only · no auto-trading" />
      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb"><span>WELCOME</span><span className="crumb-slash">/</span><strong>WELP UP</strong></div>
          <div className="topbar-right">
            <span className="market-open"><span className="market-pip" /> SOLANA MAINNET</span>
          </div>
        </header>

        <div className="page-content home-page">
          <section className="home-hero">
            <div className="home-hero-copy">
              <p className="eyebrow"><Sparkles size={14} /> SOLANA MARKET RESEARCH CONSOLE</p>
              <h1>Stay in control.<br /><em>See every move.</em></h1>
              <p className="home-hero-lede">WELP scans Solana markets, explains the signals it finds, and gives you a clear place to review swaps and wallet activity.</p>
              <div className="home-hero-actions"><Link className="primary-button home-primary-link" href="/dashboard">Open trading console <ArrowRight size={15} /></Link><Link className="home-secondary-link" href="/safety">How it works <ArrowRight size={14} /></Link></div>
              <div className="home-hero-proof"><span><LockKeyhole size={14} /> Your wallet signs transactions</span><span><ShieldCheck size={14} /> No unattended trading is active</span></div>
            </div>
            <div className="home-preview-card" aria-label="Illustrative WELP portfolio interface preview">
              <div className="preview-topline"><span><i /> WALLET OVERVIEW</span><span className="preview-badge">INTERFACE PREVIEW</span></div>
              <div className="preview-balance-label">Estimated wallet value</div>
              <div className="preview-balance">Session required <span>live</span></div>
              <div className="preview-chart-wrap">
                <div className="preview-chart-labels"><span>Portfolio snapshots</span><span>History begins after connect</span></div>
                <svg viewBox="0 0 580 170" className="preview-chart" role="img" aria-label="Decorative chart preview with no account data">
                  <defs><linearGradient id="preview-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#b9f36d" stopOpacity=".2" /><stop offset="100%" stopColor="#b9f36d" stopOpacity="0" /></linearGradient></defs>
                  <path className="preview-grid" d="M5 32H575 M5 86H575 M5 140H575" />
                  <path d="M5 118 C38 100 58 124 89 105 S140 93 171 107 S226 70 257 83 S304 104 335 74 S385 96 414 70 S466 55 494 82 S543 49 575 41 L575 160 L5 160Z" fill="url(#preview-fill)" />
                  <path d="M5 118 C38 100 58 124 89 105 S140 93 171 107 S226 70 257 83 S304 104 335 74 S385 96 414 70 S466 55 494 82 S543 49 575 41" fill="none" stroke="#b9f36d" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <div className="preview-chart-times"><span>Site wallet</span><span>History starts after the session</span></div>
              </div>
              <div className="preview-activity-row"><span className="preview-activity-icon"><Activity size={15} /></span><span><strong>Market scan</strong><small>Signals appear here as they update</small></span><span className="preview-waiting">WAITING</span></div>
              <div className="preview-caption">Illustrative product view · no user balances or returns shown</div>
            </div>
          </section>

          <section className="home-status-strip" aria-label="Current product status">
            <div><span className="home-status-icon"><Activity size={15} /></span><span><small>MARKET ANALYSIS</small><strong>Rule-based scanner is live</strong></span></div>
            <div><span className="home-status-icon"><LockKeyhole size={15} /></span><span><small>TRADE EXECUTION</small><strong>One Phantom approval per swap</strong></span></div>
            <div><span className="home-status-icon home-status-planned"><CircleDollarSign size={15} /></span><span><small>AUTONOMOUS VAULT</small><strong>Planned · not available yet</strong></span></div>
          </section>

          <section className="home-section" id="flow">
            <div className="home-section-heading"><div><p className="eyebrow">A SIMPLE, TRANSPARENT FLOW</p><h2>From market scan to wallet approval</h2></div><Link className="home-text-link" href="/signals">Explore signals <ArrowRight size={14} /></Link></div>
            <div className="home-steps">{steps.map((step) => <article className="home-step panel" key={step.number}><div className="home-step-top"><span className="home-step-number">{step.number}</span><span className="home-step-icon"><step.icon size={17} /></span></div><h3>{step.title}</h3><p>{step.copy}</p></article>)}</div>
          </section>

          <section className="home-section home-tools-section">
            <div className="home-section-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h2>Every tool has its own page</h2></div><Link className="home-text-link" href="/dashboard">Open overview <ArrowRight size={14} /></Link></div>
            <div className="home-destination-grid">{destinations.map((destination) => <Link className="home-destination panel" href={destination.href} key={destination.href}><span className="home-destination-icon"><destination.icon size={17} /></span><span><strong>{destination.title}</strong><small>{destination.copy}</small></span><ArrowRight className="home-destination-arrow" size={15} /></Link>)}</div>
          </section>

          <section className="home-vault-card">
            <span className="home-vault-icon"><ShieldCheck size={19} /></span>
            <div><p className="eyebrow">PLANNED NEXT · REVOCABLE VAULT</p><h2>You choose the allocation. You stay in control.</h2><p>The planned AI trader will use only the SOL you explicitly allocate to a separate on-chain vault, within your total cap and a 0.02 SOL per-position limit. The design includes user-controlled withdrawal and revocation. It is not enabled in this release.</p></div>
            <Link className="home-vault-link" href="/safety">View safety roadmap <ArrowRight size={14} /></Link>
          </section>

          <div className="home-minimum-note"><BookOpenCheck size={16} /><span>Current swap form starts at 0.001 SOL. You can adjust it from that minimum up to 0.02 SOL per buy.</span><Link href="/terms">Read Terms &amp; Conditions</Link></div>
          <footer className="footer home-footer"><span>WELP UP · Built for Solana</span><span>Digital assets can lose all value. Review every wallet transaction.</span><a href="https://github.com/Alitiora-Initiative/WELP-UP" target="_blank" rel="noreferrer">Source <ExternalLink size={12} /></a></footer>
        </div>
      </section>
    </main>
  );
}
