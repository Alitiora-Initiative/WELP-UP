import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, CircleDashed, LockKeyhole } from 'lucide-react';
import { LaunchpadCreatorStudio } from '@/components/LaunchpadCreatorStudio';
import './launchpad.css';

export const dynamic = 'force-dynamic';

const launchStages = [
  {
    label: 'Branded token metadata',
    detail: 'Every launch is named with the WELP UP suffix and served from welpup.fun metadata with the WELP logo.',
    state: 'Live',
  },
  {
    label: 'Pump.fun bonding curve',
    detail: 'The wallet signs a real pump.fun create transaction through PumpPortal; the mint address is the public CA.',
    state: 'Live',
  },
  {
    label: 'WELP custom program rail',
    detail: 'Creator-defined supply (0–1B) and decimals (0–9) with a fixed on-chain service fee paid straight to the treasury vault PDA. The rail gates on the live mainnet deployment check.',
    state: 'On-chain deploy',
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
            Launch a pump.fun bonding-curve coin, or create your own token with the
            WELP custom program: your supply, your precision, one on-chain service
            fee. Your wallet signs; the website only broadcasts.
          </p>
        </div>
        <div className="lp-hero-state">
          <strong>DUAL LAUNCH RAIL</strong>
          <small>Pump.fun curve live now. Custom program rail gates on the mainnet deployment check.</small>
        </div>
      </section>

      <section className="lp-discovery-v2 glass-panel" aria-labelledby="lp-discovery-title">
        <div className="lp-section-head-v2">
          <div>
            <p className="lp-kicker">DISCOVERY</p>
            <h2 id="lp-discovery-title">Explore launches</h2>
          </div>
          <span className="lp-count-v2"><CircleDashed size={13} /> Live indexer unavailable</span>
        </div>
        <div className="lp-empty-v2">
          <span className="lp-empty-icon"><CheckCircle2 size={20} /></span>
          <strong>Live launch discovery is not available</strong>
          <p>
            No mainnet launch indexer is configured for this program. The page
            cannot currently read verified launch-state accounts, so it does
            not display sample tokens, estimated prices or fabricated volume.
          </p>
        </div>
        <p className="lp-raw-note">
          <LockKeyhole size={13} /> Listings must be backed by finalized mainnet
          mint, launch-state, token allocation, quote reserve and pool accounts.
        </p>
      </section>

      <LaunchpadCreatorStudio />

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
