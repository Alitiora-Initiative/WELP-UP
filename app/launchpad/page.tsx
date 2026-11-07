import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, CircleDashed, LockKeyhole } from 'lucide-react';
import { LaunchpadCreatorStudio } from '@/components/LaunchpadCreatorStudio';
import { TreasuryEpochCountdown } from '@/components/TreasuryEpochCountdown';
import './launchpad.css';

export const dynamic = 'force-dynamic';

const launchStages = [
  {
    label: 'Custom token mint',
    detail: 'Creator-selected whole supply and 0–9 decimals are fixed when the mint is initialized.',
    state: 'Program pending',
  },
  {
    label: 'Bonding-curve sale',
    detail: 'Purchases, allocations, quote accounting and the early-window wallet cap must be enforced on-chain.',
    state: 'Not enabled',
  },
  {
    label: 'Raydium CPMM pool',
    detail: 'Graduation is permissionless; pool creation and LP-token destruction must complete atomically.',
    state: 'Integration pending',
  },
];

export default function LaunchpadPage() {
  return (
    <main className="launchpad-page-v2">
      <section className="lp-hero-v2">
        <div>
          <p className="lp-kicker">WELP UP / SOLANA LAUNCHPAD</p>
          <h1>Launch on your terms<span>.</span></h1>
          <p>
            Create tokens with creator-defined supply and precision, discover
            launches from verifiable on-chain records, and follow each token
            through its sale and liquidity-pool graduation.
          </p>
        </div>
        <div className="lp-hero-state">
          <strong>MAINNET PROGRAM STATUS</strong>
          <small>Creator transactions are locked pending program deployment and review.</small>
        </div>
      </section>

      <section className="lp-discovery-v2 glass-panel" aria-labelledby="lp-discovery-title">
        <div className="lp-section-head-v2">
          <div>
            <p className="lp-kicker">DISCOVERY</p>
            <h2 id="lp-discovery-title">Explore launches</h2>
          </div>
          <span className="lp-count-v2"><CircleDashed size={13} /> 0 verified launches</span>
        </div>
        <div className="lp-empty-v2">
          <span className="lp-empty-icon"><CheckCircle2 size={20} /></span>
          <strong>No verified WELP launches yet</strong>
          <p>
            The discovery feed is empty until confirmed launch accounts and
            transactions can be indexed from Solana. No demo tokens, generated
            prices, synthetic volume or placeholder pool addresses are shown.
          </p>
        </div>
        <p className="lp-raw-note">
          <LockKeyhole size={13} /> A launch listing must be backed by a verified
          mint, launch-state PDA, token allocation, quote reserve and pool record.
        </p>
      </section>

      <LaunchpadCreatorStudio />

      <TreasuryEpochCountdown lastDistributionTimestamp={null} />

      <section className="lp-discovery-v2 glass-panel" aria-labelledby="lp-stages-title">
        <div className="lp-section-head-v2">
          <div>
            <p className="lp-kicker">PROTOCOL LIFECYCLE</p>
            <h2 id="lp-stages-title">From mint to market.</h2>
          </div>
          <Link className="launchpad-text-link" href="/docs">
            Read project docs <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="lp-stage-grid">
          {launchStages.map((stage, index) => (
            <article className="lp-stage" key={stage.label}>
              <span>0{index + 1}</span>
              <div>
                <strong>{stage.label}</strong>
                <p>{stage.detail}</p>
              </div>
              <small>{stage.state}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
