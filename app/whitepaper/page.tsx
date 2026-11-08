import Link from 'next/link';

export const metadata = {
  title: 'Whitepaper',
  description: 'Official WELP UP technical whitepaper and current product status.',
};

const chapters = [
  ['01', 'Abstract', 'A Solana market-analysis and wallet-approved trading interface, with a separately documented future vault and agent architecture.'],
  ['02', 'Design principles', 'User-controlled signing, observable inputs, fail-closed behavior, verifiable history, least authority, and transparent economics.'],
  ['03', 'Current system', 'Live market data, deterministic signals, Jupiter Swap API v2, public wallet reads, and browser-local activity snapshots.'],
  ['04', 'Vault architecture', 'A proposed per-user PDA vault design. The source scaffold is not deployed or audited on mainnet and must not receive deposits.'],
  ['05', 'Agents and copy trading', 'A proposed constrained executor and strategy marketplace. No live autonomous execution or verified strategy performance is currently available.'],
  ['06', 'Fees and governance', 'The disclosed protocol swap fee is 0.50% of gross swap input, credited to the platform treasury with a 60/40 developer/reserve split after each 14-day epoch. A separate proposed US$0.10 bot creation/activation fee plus a 0–30% creator share of positive net profit remains a proposal.'],
  ['07', 'Security and risks', 'Threats, launch gates, irreversibility, liquidity risk, smart-contract risk, and no guarantee of returns.'],
];

export default function WhitepaperPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#080a0a', color: '#eff5f0', padding: '48px 24px' }}>
      <article style={{ maxWidth: 900, margin: '0 auto' }}>
        <nav style={{ display: 'flex', gap: 20, marginBottom: 54, flexWrap: 'wrap', color: '#78847e' }}>
          <Link href="/">WELP UP</Link><Link href="/dashboard">Console</Link><Link href="/docs">Docs</Link>
        </nav>
        <p style={{ color: '#99a69c', letterSpacing: '.16em', fontSize: 12 }}>OFFICIAL TECHNICAL WHITEPAPER · VERSION 1.0 · 06 NOV 2026</p>
        <h1 style={{ fontSize: 'clamp(42px, 7vw, 76px)', lineHeight: 1.02, margin: '14px 0 24px' }}>WELP UP<span style={{ color: '#b9f36d' }}>!</span></h1>
        <p style={{ fontSize: 22, color: '#99a69c', lineHeight: 1.6, maxWidth: 720 }}>A transparent Solana market console built around real market data and user-approved execution.</p>
        <div style={{ border: '1px solid #24351e', borderRadius: 16, padding: 22, background: '#101413', margin: '32px 0' }}>
          <strong style={{ color: '#f2bd75' }}>Status disclosure</strong>
          <p style={{ color: '#99a69c', lineHeight: 1.7, marginBottom: 0 }}>This paper describes current functionality separately from proposed features. The vault is not deployed or audited on mainnet; unattended agents and copy trading are not active; supported wallet-approved swaps now use the disclosed 0.50% gross swap fee. This is not an investment offer or security audit.</p>
        </div>
        <h2 style={{ marginTop: 42 }}>Contents</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {chapters.map(([number, title, summary]) => <section key={number} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 16, borderBottom: '1px solid #1a211f', padding: '18px 0' }}>
            <span style={{ color: '#b9f36d', fontVariantNumeric: 'tabular-nums' }}>{number}</span>
            <div><h3 style={{ margin: '0 0 8px', fontSize: 20 }}>{title}</h3><p style={{ color: '#99a69c', margin: 0, lineHeight: 1.65 }}>{summary}</p></div>
          </section>)}
        </div>
        <p style={{ marginTop: 40, color: '#99a69c', lineHeight: 1.8 }}>The complete technical whitepaper, including the current swap flow, proposed PDA vault model, fee prerequisites, security gates, and risk disclosures, is maintained in the repository as <code>WHITEPAPER.md</code>.</p>
        <Link href="https://github.com/Alitiora-Initiative/WELP-UP/blob/main/WHITEPAPER.md" target="_blank" style={{ display: 'inline-block', marginTop: 12, padding: '12px 18px', borderRadius: 10, background: '#b9f36d', color: '#080a0a', fontWeight: 700 }}>Read the full whitepaper →</Link>
        <footer style={{ marginTop: 52, paddingTop: 20, borderTop: '1px solid #1a211f', color: '#78847e', fontSize: 13 }}>WELP UP! · Version 1.0 · 6 November 2026</footer>
      </article>
    </main>
  );
}
