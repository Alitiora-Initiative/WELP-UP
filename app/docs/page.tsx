import Link from 'next/link';

const nav = [
  ['overview', 'Overview'],
  ['architecture', 'Architecture'],
  ['program', 'Vault program'],
  ['roadmap', 'Roadmap'],
  ['rules', 'Rules & safety'],
];

const flow = [
  ['01', 'Connect a Solana wallet', 'The interface reads the public address and on-chain data. It never asks for a seed phrase or private key.'],
  ['02', 'Review market signals', 'Public market data is evaluated with deterministic rules. A score is a filter result, not an order or a prediction.'],
  ['03', 'Inspect a Jupiter route', 'The swap desk prepares a route and displays the checks before handing it to the connected wallet.'],
  ['04', 'Approve the transaction', 'Your wallet signs the transaction. A quote can expire or change; nothing is retried unattended.'],
];

const authority = [
  ['Owner', 'Initializes the vault policy, sets or revokes an executor, pauses execution and withdraws.'],
  ['Executor', 'A separately configured key. It cannot become owner, raise policy caps or withdraw.'],
  ['Vault PDA', 'A per-owner program-derived account intended to isolate each owner’s policy and balance.'],
];

const gates = [
  ['Program deployment', 'Not complete', 'No verified production vault program address is published.'],
  ['Independent security audit', 'Not complete', 'The vault must be audited and findings resolved before real-value use.'],
  ['Swap CPI and route allowlist', 'Not complete', 'The execution path remains disabled until a reviewed route integration exists.'],
  ['Withdrawal and recovery tests', 'Not complete', 'Owner-controlled recovery must be tested on devnet and verified before launch.'],
  ['Legal and operational review', 'Not complete', 'A production vault requires a separate operational and legal review.'],
];

const rules = [
  ['Liquidity floor', 'Block', 'Liquidity below the configured floor is excluded from the eligible set.'],
  ['24-hour volume floor', 'Block', 'Insufficient turnover is treated as a thin market.'],
  ['Holder concentration', 'Warn / block', 'Concentration can make exits unreliable; thresholds are defined in the engine.'],
  ['Mint and freeze authorities', 'Warn / block', 'Token authorities can change supply or restrict token accounts.'],
  ['Price drawdown', 'Warn', 'A sharp decline is a risk signal, not a timing forecast.'],
];

const card = { border: '1px solid #26332b', borderRadius: 12, padding: 20, background: '#0e1511' };
const muted = { color: '#9aa99d', lineHeight: 1.7 };
const eyebrow = { color: '#a9d66b', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase' as const };

export const metadata = {
  title: 'Documentation',
  description: 'WELP UP architecture, market rules, vault launch gates and product boundaries.',
};

export default function DocsPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#080d0a', color: '#e7eee7', padding: '36px 22px 72px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 44, color: '#9aa99d', fontSize: 12 }}>
          <Link href="/">WELP UP!</Link><Link href="/markets">Markets</Link><Link href="/swap">Trade</Link><Link href="/vault">Vault console</Link><Link href="/whitepaper">Whitepaper</Link>
        </nav>

        <header style={{ maxWidth: 780, marginBottom: 34 }}>
          <p style={eyebrow}>PRODUCT RECORD · SOLANA MAINNET</p>
          <h1 style={{ fontSize: 'clamp(38px, 7vw, 66px)', lineHeight: 1.02, letterSpacing: '-.045em', margin: '12px 0 18px' }}>Know what it does.<br /><span style={{ color: '#b9ed7a' }}>Know what it cannot.</span></h1>
          <p style={{ ...muted, fontSize: 16, maxWidth: 720 }}>WELP UP is a non-custodial Solana market console. This documentation describes the product flow, the intended vault authority model, the current launch gates and the boundaries that remain in force.</p>
        </header>

        <div style={{ ...card, borderColor: '#68502b', background: '#17140e', marginBottom: 30 }}>
          <strong style={{ color: '#e8c27b', fontSize: 12 }}>Mainnet safety notice</strong>
          <p style={{ color: '#cbbd9f', fontSize: 12, lineHeight: 1.7, margin: '7px 0 0' }}>Wallet-approved swaps can use real mainnet assets. The WELP PDA vault and unattended agent execution are not production-enabled. Do not send funds to an unverified or derived vault address.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 34 }}>
          {nav.map(([id, label]) => <a key={id} href={'#' + id} style={{ ...card, padding: '12px 14px', color: '#b8d69a', fontSize: 11, textDecoration: 'none' }}>{label} ↘</a>)}
        </div>

        <section id="overview" style={{ marginBottom: 54, scrollMarginTop: 24 }}>
          <p style={eyebrow}>01 · OVERVIEW</p>
          <h2 style={{ fontSize: 28, margin: '9px 0' }}>From public data to wallet approval</h2>
          <p style={{ ...muted, maxWidth: 760, fontSize: 13 }}>The interface separates analysis from execution. Market signals do not place orders, and the wallet remains the authority for each supported swap.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 18 }}>
            {flow.map(([number, title, detail]) => <article key={number} style={card}><span style={{ color: '#a9d66b', fontFamily: 'monospace', fontSize: 11 }}>{number}</span><h3 style={{ fontSize: 14, margin: '12px 0 7px' }}>{title}</h3><p style={{ ...muted, fontSize: 11, margin: 0 }}>{detail}</p></article>)}
          </div>
          <div style={{ marginTop: 18, ...card }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Product surfaces</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              {[
                ['/markets', 'Markets', 'Live pools and market metrics from configured data providers.'],
                ['/signals', 'Signals', 'Deterministic candidate scoring and named rule outcomes.'],
                ['/swap', 'Swap desk', 'Jupiter route review and explicit wallet-signing handoff.'],
                ['/portfolio', 'Portfolio', 'Public wallet balances and transaction history.'],
                ['/automation', 'Automation policies', 'Browser-local watch policies; no order execution.'],
                ['/agent', 'Market agent', 'Analysis surface; no unattended trading runtime.'],
                ['/vault', 'Vault console', 'Program status and policy design; not a deposit product.'],
                ['/safety', 'Safety', 'Risk limits, threat model and product boundaries.'],
              ].map(([href, title, detail]) => <div key={href}><Link href={href} style={{ color: '#b9ed7a', fontSize: 12 }}>{title} ↗</Link><p style={{ ...muted, fontSize: 10, margin: '4px 0 0' }}>{detail}</p></div>)}
            </div>
          </div>
        </section>

        <section id="architecture" style={{ marginBottom: 54, scrollMarginTop: 24 }}>
          <p style={eyebrow}>02 · AUTHORITY MODEL</p>
          <h2 style={{ fontSize: 28, margin: '9px 0' }}>Why a per-owner PDA design</h2>
          <p style={{ ...muted, maxWidth: 760, fontSize: 13 }}>The intended design uses a separate program-derived account for each owner. It narrows authority compared with handing an agent a user wallet, but this design is not a security guarantee and is not currently a live vault service.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 18 }}>
            {authority.map(([title, detail]) => <article key={title} style={card}><h3 style={{ color: '#b9ed7a', fontSize: 14, margin: '0 0 8px' }}>{title}</h3><p style={{ ...muted, fontSize: 11, margin: 0 }}>{detail}</p></article>)}
          </div>
          <div style={{ ...card, marginTop: 12 }}>
            <h3 style={{ fontSize: 13, marginTop: 0 }}>Required authority properties</h3>
            <ul style={{ ...muted, fontSize: 11, paddingLeft: 18, marginBottom: 0 }}>
              <li>The owner never shares a wallet seed phrase with an agent.</li>
              <li>Any future spend policy must enforce total and per-position caps on-chain.</li>
              <li>The executor must not be able to change owner policy or withdraw.</li>
              <li>The owner must be able to pause and revoke without executor cooperation.</li>
              <li>Each owner’s vault state must be isolated from every other owner.</li>
            </ul>
          </div>
        </section>

        <section id="program" style={{ marginBottom: 54, scrollMarginTop: 24 }}>
          <p style={eyebrow}>03 · VAULT PROGRAM</p>
          <h2 style={{ fontSize: 28, margin: '9px 0' }}>Scaffold, not a live vault</h2>
          <p style={{ ...muted, maxWidth: 760, fontSize: 13 }}>The repository contains an Anchor program scaffold and a vault console. The execution path is intentionally fail-closed. The program must not be treated as deployed, audited, or ready to hold funds.</p>
          <div style={{ ...card, marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><strong style={{ fontSize: 12 }}>Instruction surface described by the design</strong><span style={{ color: '#e8c27b', fontSize: 9, letterSpacing: '.1em' }}>REFERENCE ONLY</span></div>
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560, fontSize: 11 }}>
                <thead><tr style={{ color: '#8d9c90', textAlign: 'left' }}>{['Instruction', 'Authority', 'Intended behaviour'].map(x => <th key={x} style={{ padding: 9, borderBottom: '1px solid #2b382f' }}>{x}</th>)}</tr></thead>
                <tbody>{[
                  ['initialize', 'Owner', 'Create per-owner policy state and start paused.'],
                  ['fund', 'Owner', 'Explicitly transfer SOL into the account; funding does not raise caps.'],
                  ['set_executor / revoke_executor', 'Owner', 'Set or clear the separate executor key.'],
                  ['pause / unpause', 'Owner', 'Control whether any permitted executor path may run.'],
                  ['withdraw', 'Owner', 'Owner-controlled recovery path.'],
                  ['execute_swap', 'Executor', 'Scaffold only; execution must remain disabled until reviewed CPI integration exists.'],
                ].map(row => <tr key={row[0]}>{row.map((cell, i) => <td key={i} style={{ padding: 9, borderBottom: '1px solid #202b24', color: i === 0 ? '#c8d8bd' : '#9aa99d' }}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
          <p style={{ ...muted, fontSize: 11, marginTop: 12 }}>Before any real-value deployment: complete devnet testing, independent audit, closed findings, executable-program verification, route allowlisting, withdrawal/revocation tests and a separate operational/legal review. Until then, do not fund a vault.</p>
          <Link href="/vault" style={{ color: '#b9ed7a', fontSize: 11 }}>Open vault status console ↗</Link>
        </section>

        <section id="roadmap" style={{ marginBottom: 54, scrollMarginTop: 24 }}>
          <p style={eyebrow}>04 · ROADMAP & RELEASE GATES</p>
          <h2 style={{ fontSize: 28, margin: '9px 0' }}>What must happen before vault launch</h2>
          <p style={{ ...muted, fontSize: 13, maxWidth: 760 }}>These are release gates, not claims that the work is complete. The current interface can be used for market research and supported wallet-approved swaps independently of the vault.</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
            {gates.map(([title, state, detail]) => <div key={title} style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }}><div><strong style={{ fontSize: 12 }}>{title}</strong><p style={{ ...muted, fontSize: 10, margin: '5px 0 0' }}>{detail}</p></div><span style={{ color: '#e8c27b', fontSize: 9, whiteSpace: 'nowrap' }}>{state}</span></div>)}
          </div>
        </section>

        <section id="rules" style={{ marginBottom: 54, scrollMarginTop: 24 }}>
          <p style={eyebrow}>05 · RULES & SAFETY</p>
          <h2 style={{ fontSize: 28, margin: '9px 0' }}>A score is not a promise</h2>
          <p style={{ ...muted, fontSize: 13, maxWidth: 760 }}>Signals are deterministic filters over available market fields. They can miss manipulation, stale data, liquidity withdrawal, contract risk and rapid market changes. They are not probabilities of profit or personalised financial advice.</p>
          <div style={{ ...card, marginTop: 18, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540, fontSize: 11 }}>
              <thead><tr style={{ color: '#8d9c90', textAlign: 'left' }}>{['Condition family', 'Effect', 'Reason'].map(x => <th key={x} style={{ padding: 9, borderBottom: '1px solid #2b382f' }}>{x}</th>)}</tr></thead>
              <tbody>{rules.map(row => <tr key={row[0]}>{row.map((cell, i) => <td key={i} style={{ padding: 10, borderBottom: '1px solid #202b24', color: i === 1 ? '#e8c27b' : '#9aa99d' }}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div style={{ ...card, marginTop: 12 }}>
            <strong style={{ fontSize: 12 }}>What WELP does not do</strong>
            <ul style={{ ...muted, fontSize: 11, paddingLeft: 18, marginBottom: 0 }}>
              <li>It does not trade unattended or execute stop-losses on your behalf.</li>
              <li>It does not custody funds, hold wallet keys or ask for seed phrases.</li>
              <li>It does not offer a production vault, leverage or perpetual futures.</li>
              <li>It does not present simulated returns, fabricated fills or demo balances as live data.</li>
            </ul>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 18, fontSize: 11 }}>
            <Link href="/safety" style={{ color: '#b9ed7a' }}>Full safety page ↗</Link>
            <Link href="/whitepaper" style={{ color: '#b9ed7a' }}>Whitepaper ↗</Link>
            <Link href="https://github.com/Alitiora-Initiative/WELP-UP/blob/main/docs/vault/ARCHITECTURE.md" target="_blank" style={{ color: '#b9ed7a' }}>Vault architecture source ↗</Link>
            <Link href="https://github.com/Alitiora-Initiative/WELP-UP/blob/main/docs/PRODUCTION_READINESS.md" target="_blank" style={{ color: '#b9ed7a' }}>Production readiness checklist ↗</Link>
          </div>
        </section>

        <footer style={{ borderTop: '1px solid #26332b', paddingTop: 18, color: '#77877b', fontSize: 10 }}>WELP UP! · Alitiora Initiative · Non-custodial interface · Digital assets can lose all value.</footer>
      </div>
    </main>
  );
}
