import Link from 'next/link';
import { Trophy, ShieldCheck, Clock } from 'lucide-react';

export function LeaderboardPage() {
  return (
    <main className="terminal-page feature-page leaderboard-page">
      <div className="leaderboard-content">
          <section className="welcome-row"><div>
            <p className="eyebrow"><Trophy size={14} /> VERIFIED PERFORMANCE</p>
            <h1>Rankings start <em>with proof.</em></h1>
            <p className="welcome-copy">No verified on-chain agent settlement records are available. WELP UP does not publish estimated ROI, demo rows, simulated P&amp;L, or localStorage counts as trading performance.</p>
          </div></section>
          <section className="leaderboard-empty-state panel">
            <div className="leaderboard-empty-icon"><Trophy size={40} strokeWidth={1.2} /></div>
            <h2>No live strategy rankings yet</h2>
            <p>Rankings will appear only after agents are deployed, transactions are confirmed on Solana mainnet, and results can be independently reconciled from on-chain records. Vault deposits and unattended agent execution are currently disabled.</p>
            <div className="leaderboard-status-grid">
              <div className="leaderboard-status-card"><Clock size={18} /><strong>Agent runtime</strong><span>Not deployed</span></div>
              <div className="leaderboard-status-card"><ShieldCheck size={18} /><strong>Vault security</strong><span>Mainnet deployment and independent audit incomplete</span></div>
              <div className="leaderboard-status-card"><Trophy size={18} /><strong>Performance data</strong><span>No verified execution history</span></div>
            </div>
            <div className="leaderboard-empty-actions"><Link href="/docs">Read documentation →</Link><Link href="/whitepaper">Read whitepaper →</Link></div>
          </section>
      </div>
    </main>
  );
}
