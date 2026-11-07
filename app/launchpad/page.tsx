import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';

export const dynamic = 'force-dynamic';

export default function LaunchpadPage() {
  return (
    <main className="app-shell">
      <AppSidebar active="launchpad" status="Launchpad · awaiting verified program" />
      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb">
            <span>WELP UP</span><span className="crumb-slash">/</span><strong>Launchpad</strong>
          </div>
          <div className="topbar-right"><WalletConnectionControl /></div>
        </header>
        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">WELP LAUNCHPAD · SOLANA MAINNET</p>
              <h1>Launch something <em>real.</em></h1>
              <p className="welcome-copy">
                A creator-first launch surface with configurable token supply, decimals, verified on-chain creation,
                transparent fee receipts and a public discovery board.
              </p>
            </div>
            <div className="date-pill"><span className="date-dot" /> PROGRAM NOT DEPLOYED</div>
          </section>

          <section className="panel" style={{ marginBottom: 20 }}>
            <div className="terminal-panel-heading">
              <span>DISCOVER</span><h2>Verified launches</h2>
            </div>
            <div className="empty-panel" style={{ marginTop: 14 }}>
              No WELP launch records have been verified on Solana mainnet yet.
              This board will only list mints and pools that can be traced to confirmed on-chain transactions.
            </div>
            <p className="muted-copy" style={{ marginTop: 12 }}>
              No sample tokens, simulated volume, fake holders or placeholder prices are shown here.
            </p>
          </section>

          <section className="feature-grid two">
            <div className="panel">
              <div className="terminal-panel-heading"><span>CREATOR STUDIO</span><h2>Configure your token</h2></div>
              <p className="muted-copy">Creators will choose the token parameters and review the complete transaction before signing.</p>
              <label className="field-label">TOKEN NAME<input disabled placeholder="Your token name" maxLength={32} /></label>
              <label className="field-label">TICKER<input disabled placeholder="TICKER" maxLength={10} /></label>
              <label className="field-label">METADATA URI<input disabled placeholder="Verified metadata URL" /></label>
              <div className="form-grid">
                <label className="field-label">TOTAL SUPPLY<input disabled type="number" min="1" placeholder="Choose supply" /></label>
                <label className="field-label">DECIMALS<select disabled defaultValue=""><option value="" disabled>Choose decimals</option>{[0,2,4,6,8,9].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              </div>
              <label className="field-label">QUOTE ASSET<select disabled defaultValue="USDC"><option value="USDC">USDC</option><option value="SOL">SOL</option></select></label>
              <button className="primary-action" disabled type="button">Create token · unavailable</button>
              <p className="inline-message" role="status">
                Token creation is locked until the WELP launch program, metadata validation, treasury fee routing and mainnet release checks are deployed and verified.
              </p>
            </div>

            <div className="panel">
              <div className="terminal-panel-heading"><span>TRANSPARENT ECONOMICS</span><h2>Before you launch</h2></div>
              <div className="gate-row"><span className="gate-state">01</span><div><strong>Creator sets supply and decimals</strong><small>Parameters are fixed in the mint transaction and visible before signing.</small></div></div>
              <div className="gate-row"><span className="gate-state">02</span><div><strong>0.50 USDC launch fee</strong><small>Target split: 60% developer wallet · 40% protocol treasury. Not currently collected.</small></div></div>
              <div className="gate-row"><span className="gate-state">03</span><div><strong>Creator rewards</strong><small>Rewards require a disclosed, funded allocation and on-chain claim accounting. No percentage is active yet.</small></div></div>
              <div className="gate-row"><span className="gate-state">04</span><div><strong>Market verification</strong><small>A token mint is not a liquidity pool. The board marks a launch live only after pool and mint verification.</small></div></div>
              <p className="muted-copy" style={{ marginTop: 16 }}>
                Review the <Link href="/terms">Terms &amp; Conditions</Link> and <Link href="/docs">protocol documentation</Link> before using any future launch feature.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
