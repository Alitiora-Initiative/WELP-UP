import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';

export function VaultPage() {
  return (
    <main className="app-shell">
      <AppSidebar active="vault" status="Mainnet vault is not deployed" />
      <section className="workspace">
        <header className="topbar"><div className="breadcrumb"><span>WORKSPACE</span><span className="crumb-slash">/</span><strong>Vault</strong></div></header>
        <div className="page-content">
          <section className="welcome-row">
            <div><p className="eyebrow">NON-CUSTODIAL VAULT · NOT LIVE</p><h1>Vault <em>infrastructure.</em></h1>
              <p className="welcome-copy">The WELP UP Anchor program is a source scaffold with an unassigned placeholder program ID. It has not been deployed or independently audited on Solana mainnet.</p>
            </div>
          </section>
          <section className="panel" style={{ padding: 28, maxWidth: 850 }}>
            <p className="eyebrow">FAIL-CLOSED STATUS</p><h2>Deposits and withdrawals are disabled.</h2>
            <p>Do not send SOL or tokens to a PDA derived from the placeholder program address. No mainnet vault address is published, no vault funds are accepted, and no automated swaps are authorized by this interface.</p>
            <p>The current scaffold still needs reviewed token-account accounting, tested withdrawal paths, Jupiter CPI validation, property and adversarial tests, a verified deployment, and an independent security audit before a mainnet launch can be considered.</p>
            <p>There is no maximum deposit or withdrawal amount configured in this interface because vault transactions are not enabled. Any future on-chain risk controls must be explicit, disclosed, and reviewed; a UI-only limit is not a security boundary.</p>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 22 }}><Link href="/docs">Read product docs →</Link><Link href="/whitepaper">Read whitepaper →</Link><Link href="https://github.com/Alitiora-Initiative/WELP-UP/blob/main/docs/PRODUCTION_READINESS.md" target="_blank">Production checklist →</Link></div>
          </section>
        </div>
      </section>
    </main>
  );
}
