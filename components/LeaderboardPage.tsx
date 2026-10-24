'use client';

import { useEffect, useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { Trophy, Clock, ShieldCheck, ArrowRight, Users } from 'lucide-react';
import Link from 'next/link';

export function LeaderboardPage() {
  const [connectedCount, setConnectedCount] = useState<number | null>(null);

  // Read locally stored vault-created flag as a proxy for engagement
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('welp-vault-'));
      setConnectedCount(keys.length);
    } catch {
      setConnectedCount(0);
    }
  }, []);

  return (
    <main className="app-shell">
      <AppSidebar active="leaderboard" />

      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb">
            <span>WORKSPACE</span>
            <span className="crumb-slash">/</span>
            <strong>Leaderboard</strong>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><Trophy size={14} /> BOT PERFORMANCE</p>
              <h1>Be the <em>first.</em></h1>
              <p className="welcome-copy">
                No bots have traded yet. The leaderboard fills with real, verified
                on-chain results once vaults go live after STRIDE security review.
              </p>
            </div>
          </section>

          {/* Honest empty state */}
          <section className="leaderboard-empty-state panel">
            <div className="leaderboard-empty-icon">
              <Trophy size={40} strokeWidth={1.2} />
            </div>
            <h2>Rankings start when trading starts</h2>
            <p>
              Every entry on this leaderboard will be sourced directly from on-chain
              settlement records — no estimates, no demo data. The first wallets to
              fund and activate vaults will own the top spots.
            </p>

            <div className="leaderboard-status-grid">
              <div className="leaderboard-status-card">
                <Clock size={18} />
                <strong>STRIDE Review</strong>
                <span>Application submitted — evaluation in progress</span>
              </div>
              <div className="leaderboard-status-card">
                <ShieldCheck size={18} />
                <strong>Security gate</strong>
                <span>Live trading activates once STRIDE clears the program</span>
              </div>
              <div className="leaderboard-status-card">
                <Users size={18} />
                <strong>Early access</strong>
                <span>
                  {connectedCount === null
                    ? 'Fund your vault now — be ready when it opens'
                    : connectedCount > 0
                      ? `${connectedCount} vault${connectedCount > 1 ? 's' : ''} set up locally — ready to activate`
                      : 'Fund your vault now — be ready when it opens'}
                </span>
              </div>
            </div>

            <div className="leaderboard-empty-actions">
              <Link href="/vault" className="primary-button">
                Set up your vault <ArrowRight size={14} />
              </Link>
              <Link href="/autonomous" className="home-secondary-link">
                Try paper trading first <ArrowRight size={14} />
              </Link>
            </div>
          </section>

          {/* What the leaderboard will show */}
          <section className="leaderboard-preview-section">
            <div className="home-section-heading">
              <div>
                <p className="eyebrow">COMING SOON</p>
                <h2>What the leaderboard will track</h2>
              </div>
            </div>
            <div className="leaderboard-preview-grid">
              {[
                { label: '7D / 30D / All-time ROI', desc: 'Verified from on-chain fill records only — no estimates.' },
                { label: 'TVL per bot', desc: 'Total SOL under management across all copiers of that strategy.' },
                { label: 'Creator fee', desc: 'Charged on realized positive profit only, capped at 30% by the program.' },
                { label: 'Win rate', desc: 'Percentage of positions closed with positive net profit after fees.' },
                { label: 'Copy Bot', desc: 'Fund your vault and subscribe to a strategy with one wallet approval.' },
                { label: 'Hide / report', desc: 'You control your visibility. On-chain records are permanent either way.' },
              ].map(item => (
                <div key={item.label} className="leaderboard-preview-card panel">
                  <strong>{item.label}</strong>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className="footer">
            <span>WELP UP · Solana Mainnet-Beta</span>
            <span>Trading is risky. A token can lose all value.</span>
            <Link href="/terms">Terms &amp; Conditions</Link>
          </footer>
        </div>
      </section>
    </main>
  );
}
