import Link from 'next/link';
import { ArrowRight, Check, CircleAlert, LockKeyhole, ShieldCheck, Wallet } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';

const currentRules = [
  { value: '0.001 SOL', title: 'Editable opening amount', detail: 'The swap amount opens at 0.001 SOL. You may change it; the current web buy limit is 0.02 SOL.' },
  { value: '80–98', title: 'Signal entry window', detail: 'Only rule scores inside this inclusive range are marked eligible. The score is not a probability of profit.' },
  { value: '$0.50', title: 'Minimum wallet equity', detail: 'The current app checks the connected wallet balance before creating a buy quote.' },
  { value: '0.003 SOL', title: 'Fee reserve check', detail: 'The buy form asks you to keep a reserve for network fees. Actual network fees vary.' },
  { value: '2.5%', title: 'Price-impact ceiling', detail: 'A buy quote above this price-impact level is blocked by the current interface.' },
];

export function SafetyPage() {
  return (
    <main className="app-shell">
      <AppSidebar active="safety" status="Manual approvals · no auto-trading" />
      <section className="workspace" id="top">
        <header className="topbar"><div className="breadcrumb"><span>SAFETY</span><span className="crumb-slash">/</span><strong>Rules and limits</strong></div><div className="topbar-right"><WalletConnectionControl /></div></header>
        <div className="page-content safety-page">
          <section className="welcome-row"><div><p className="eyebrow"><ShieldCheck size={14} /> CURRENT LIMITS AND FUTURE CONTROLS</p><h1>Know the <em>guardrails.</em></h1><p className="welcome-copy">Read what the current interface checks, where those checks stop, and what must exist before autonomous trading can be offered.</p></div><div className="date-pill"><span className="date-dot" /> NO AUTO-TRADING</div></section>
          <div className="mainnet-banner safety-risk-banner"><CircleAlert size={18} /><div><strong>Mainnet swaps use real funds.</strong><span>Filters reduce certain risks; they do not protect your capital or guarantee an exit. You approve each current swap in your wallet.</span></div></div>
          <section className="safety-detail-grid" aria-label="Current trading limits">{currentRules.map((rule) => <article className="panel safety-detail-card" key={rule.title}><span className="safety-detail-value">{rule.value}</span><h2>{rule.title}</h2><p>{rule.detail}</p></article>)}</section>
          <section className="panel safety-mode-card"><div className="safety-mode-heading"><span className="safety-icon"><LockKeyhole size={18} /></span><div><p className="eyebrow">CURRENT EXECUTION MODEL</p><h2>One user signature per swap</h2></div></div><p>WELP prepares a Jupiter quote only after the site wallet session is active, then asks that wallet to sign the transaction. A market scan does not trade, and an earlier signature does not authorize later swaps.</p><div className="safety-mode-foot"><span><Check size={14} /> Browser session signing</span><span><CircleAlert size={14} /> No autonomous exits or take-profit yet</span></div></section>
          <section className="home-vault-card safety-vault-card"><span className="home-vault-icon"><Wallet size={19} /></span><div><p className="eyebrow">VAULT SETUP · TRADING DISABLED</p><h2>Review your vault controls</h2><p>The Vault can derive a per-wallet PDA and manage SOL after a verified program deployment is configured. Swap execution, token withdrawals, audit, and autonomous consent gates remain incomplete.</p></div><Link className="home-vault-link" href="/vault">Open Vault <ArrowRight size={14} /></Link></section>
          <div className="home-minimum-note"><CircleAlert size={16} /><span>Any trade can lose all its value. A displayed score, price, or exit rule cannot guarantee execution.</span><Link href="/activity">View activity</Link></div>
          <footer className="footer"><span>WELP UP · Safety information</span><span>Terms draft dated 20 October 2026</span><Link href="/terms">Terms &amp; Conditions</Link></footer>
        </div>
      </section>
    </main>
  );
}
