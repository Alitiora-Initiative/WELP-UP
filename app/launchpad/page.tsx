import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, CircleDashed, LockKeyhole } from 'lucide-react';

export const dynamic = 'force-dynamic';

const launchStages = [
  { label: 'Token mint', detail: 'A mint must be confirmed on Solana mainnet and its authority state inspected.', state: 'Awaiting program' },
  { label: 'Liquidity pool', detail: 'A created token is not a market. A real pool and its liquidity must be independently indexed.', state: 'Awaiting integration' },
  { label: 'Creator economics', detail: 'Launch fees and creator rewards must be disclosed and settled by verified on-chain instructions.', state: 'Not enabled' },
];

export default function LaunchpadPage() {
  return (
    <main className="terminal-page launchpad-page">
      <section className="launchpad-hero">
        <div className="launchpad-hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> WELP UP / SOLANA LAUNCHPAD</p>
          <h1>Launches<span>.</span></h1>
          <p>Discover tokens with verifiable on-chain origins. Create when the launch program is deployed, audited and ready for mainnet use.</p>
        </div>
        <div className="launchpad-hero-action">
          <span className="launchpad-network"><i /> SOLANA MAINNET</span>
          <button className="launchpad-primary" type="button" disabled aria-describedby="launchpad-lock-reason">
            Create a token <ArrowUpRight size={16} />
          </button>
          <small id="launchpad-lock-reason">Creator studio is locked until the launch program is deployed and verified.</small>
        </div>
      </section>

      <section className="launchpad-discovery" aria-labelledby="launchpad-discovery-title">
        <div className="launchpad-section-heading">
          <div><p className="launchpad-kicker">DISCOVERY</p><h2 id="launchpad-discovery-title">Explore launches</h2></div>
          <span className="launchpad-count"><CircleDashed size={14} /> 0 verified listings</span>
        </div>
        <div className="launchpad-filter-row">
          <div className="launchpad-filter-tabs" aria-label="Launch categories">
            <span className="selected">All launches</span><span>New</span><span>Active</span><span>Graduated</span>
          </div>
          <span className="launchpad-filter-note">Categories appear when verified launch data is available</span>
        </div>
        <div className="launchpad-table-wrap">
          <table className="launchpad-table">
            <thead><tr><th>Token</th><th>Pair</th><th>Market cap</th><th>24H change</th><th>Liquidity</th><th>Launch status</th></tr></thead>
            <tbody><tr><td colSpan={6}>
              <div className="launchpad-empty">
                <span className="launchpad-empty-icon"><CheckCircle2 size={22} /></span>
                <strong>No verified launches yet</strong>
                <p>There are no WELP launch records confirmed on Solana mainnet. This board will not fill itself with demo tokens, generated prices or simulated volume.</p>
              </div>
            </td></tr></tbody>
          </table>
        </div>
        <p className="launchpad-data-note"><LockKeyhole size={13} /> Listings require a confirmed mint, a verified pool and traceable transaction signatures.</p>
      </section>

      <section className="launchpad-bottom">
        <div className="launchpad-creator-copy">
          <p className="launchpad-kicker">FOR TOKEN CREATORS</p>
          <h2>Built around transparent launches.</h2>
          <p>WELP’s planned creator flow supports custom supply and decimals, wallet-reviewed transactions, clear fee receipts and verifiable pool status. Those mechanics stay unavailable until the on-chain program and fee settlement are ready.</p>
          <Link className="launchpad-text-link" href="/docs">Read the launchpad specification <ArrowUpRight size={14} /></Link>
        </div>
        <div className="launchpad-stage-list">
          {launchStages.map((stage, index) => (
            <div className="launchpad-stage" key={stage.label}>
              <span className="launchpad-stage-number">0{index + 1}</span>
              <div><strong>{stage.label}</strong><p>{stage.detail}</p></div>
              <small>{stage.state}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
