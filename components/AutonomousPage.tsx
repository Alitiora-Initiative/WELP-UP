import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';

export function AutonomousPage() {
  return (
    <main className="app-shell">
      <AppSidebar active="autonomous" status="Agent execution is not enabled" />
      <section className="workspace">
        <header className="topbar"><div className="breadcrumb"><span>WORKSPACE</span><span className="crumb-slash">/</span><strong>Agent monitor</strong></div></header>
        <div className="page-content">
          <section className="welcome-row">
            <div><p className="eyebrow">AUTONOMOUS EXECUTION · NOT ENABLED</p><h1>Agent <em>runtime.</em></h1>
              <p className="welcome-copy">WELP UP does not currently run unattended trading agents. There are no deployed bots, live agent P&amp;L figures, or verified strategy performance records to display.</p>
            </div>
          </section>
          <section className="panel" style={{ padding: 28, maxWidth: 850 }}>
            <p className="eyebrow">PRODUCTION GATE</p><h2>Wallet control comes first.</h2>
            <p>Every available swap remains individually reviewed and signed by the connected wallet. An autonomous executor will not be enabled until the per-user vault is deployed, independently audited, tested on mainnet, and able to enforce user-approved limits on-chain.</p>
            <p>No paper trading, simulated fills, manually entered prices, backtest ROI, or fabricated bot statistics are shown on this page.</p>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 22 }}><Link href="/docs">Read product docs →</Link><Link href="/whitepaper">Read whitepaper →</Link><Link href="/safety">Review safety controls →</Link></div>
          </section>
        </div>
      </section>
    </main>
  );
}
