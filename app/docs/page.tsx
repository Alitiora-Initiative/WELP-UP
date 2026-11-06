import Link from 'next/link';

const sections = [
  { title: 'Markets and signals', body: 'Live market data is evaluated by deterministic rules. A score is a filter result, not a prediction or probability of profit.', href: '/signals', label: 'Open signals' },
  { title: 'Wallet-approved swaps', body: 'WELP requests a Jupiter order and asks your connected wallet to review and sign it. Quotes can change or expire; only a confirmed transaction is an execution.', href: '/swap', label: 'Open swap' },
  { title: 'Wallet history', body: 'Public transaction signatures are read from Solana RPC. Browser-local activity snapshots are supplemental and are not a complete ledger or tax statement.', href: '/profile', label: 'Open profile' },
  { title: 'Vault status', body: 'The Anchor vault is not deployed and audited on mainnet. The current program address is a placeholder. Do not deposit assets into a derived address.', href: '/vault', label: 'Vault status' },
  { title: 'Agent status', body: 'Unattended trading, copy trading, and live strategy performance are not enabled. No simulated results are presented as live results.', href: '/autonomous', label: 'Agent status' },
];

export const metadata = {
  title: 'Documentation',
  description: 'WELP UP product documentation, integrations, security boundaries, and current feature status.',
};

export default function DocsPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#080b12', color: '#e8edf6', padding: '48px 24px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <nav style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 48, color: '#9caac0' }}>
          <Link href="/">WELP UP</Link><Link href="/dashboard">Console</Link><Link href="/whitepaper">Whitepaper</Link><Link href="/safety">Safety</Link>
        </nav>
        <p style={{ color: '#91a4bf', letterSpacing: '.16em', fontSize: 12 }}>DOCUMENTATION · UPDATED 06 NOV 2026</p>
        <h1 style={{ fontSize: 'clamp(40px, 7vw, 68px)', lineHeight: 1.02, margin: '14px 0' }}>Build with clarity.</h1>
        <p style={{ maxWidth: 720, color: '#aebbd0', fontSize: 18, lineHeight: 1.7 }}>A practical guide to what WELP UP does today, what its integrations do, and which systems are not yet available. We do not use demo balances, fabricated fills, or simulated P&amp;L as live product data.</p>
        <div style={{ margin: '32px 0', padding: 22, border: '1px solid #6b4d2b', borderRadius: 16, background: '#17130f' }}>
          <strong style={{ color: '#f2bd75' }}>Mainnet safety notice</strong>
          <p style={{ color: '#d5c3a9', lineHeight: 1.65, marginBottom: 0 }}>Wallet-approved swaps use real mainnet assets. The WELP vault and unattended agents are not enabled. Never send funds to an unverified vault address.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {sections.map((item) => <article key={item.title} style={{ border: '1px solid #253044', borderRadius: 16, padding: 22, background: '#101622' }}>
            <h2 style={{ fontSize: 20, marginTop: 0 }}>{item.title}</h2>
            <p style={{ color: '#aebbd0', lineHeight: 1.65, minHeight: 84 }}>{item.body}</p>
            <Link href={item.href} style={{ color: '#8bb8ff' }}>{item.label} →</Link>
          </article>)}
        </div>
        <section style={{ marginTop: 44 }}>
          <h2>Technical references</h2>
          <ul style={{ color: '#aebbd0', lineHeight: 2 }}>
            <li><Link href="https://developers.jup.ag/docs/swap/index" target="_blank" style={{ color: '#8bb8ff' }}>Jupiter Swap API v2</Link> — order, wallet signing, and execution.</li>
            <li><Link href="https://solana.com/docs" target="_blank" style={{ color: '#8bb8ff' }}>Solana documentation</Link> — accounts, transactions, and programs.</li>
            <li><Link href="https://github.com/Alitiora-Initiative/WELP-UP/blob/main/docs/PRODUCTION_READINESS.md" target="_blank" style={{ color: '#8bb8ff' }}>Production readiness checklist</Link>.</li>
            <li><Link href="https://github.com/Alitiora-Initiative/WELP-UP/blob/main/WHITEPAPER.md" target="_blank" style={{ color: '#8bb8ff' }}>Official whitepaper source</Link>.</li>
          </ul>
        </section>
        <footer style={{ marginTop: 52, paddingTop: 20, borderTop: '1px solid #253044', color: '#7e8ca3', fontSize: 13 }}>WELP UP! · Non-custodial interface · No profit guarantees</footer>
      </div>
    </main>
  );
}
