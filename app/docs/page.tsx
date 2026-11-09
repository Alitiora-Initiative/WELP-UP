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
  ['Withdrawal and recovery tests', 'Not complete', 'Owner-controlled recovery must be tested and verified before launch.'],
  ['Legal and operational review', 'Not complete', 'A production vault requires a separate operational and legal review.'],
];

const rules = [
  ['Liquidity floor', 'Block', 'Liquidity below the configured floor is excluded from the eligible set.'],
  ['24-hour volume floor', 'Block', 'Insufficient turnover is treated as a thin market.'],
  ['Holder concentration', 'Warn / block', 'Concentration can make exits unreliable; thresholds are defined in the engine.'],
  ['Mint and freeze authorities', 'Warn / block', 'Token authorities can change supply or restrict token accounts.'],
  ['Price drawdown', 'Warn', 'A sharp decline is a risk signal, not a timing forecast.'],
];

const surfaces = [
  ['/markets', 'Markets', 'Live pools and market metrics from configured data providers.'],
  ['/signals', 'Signals', 'Deterministic candidate scoring and named rule outcomes.'],
  ['/swap', 'Swap desk', 'Jupiter route review and explicit wallet-signing handoff.'],
  ['/portfolio', 'Portfolio', 'Public wallet balances and transaction history.'],
  ['/automation', 'Automation policies', 'Browser-local watch policies; no order execution.'],
  ['/autonomous', 'Agent monitor', 'Production runtime status; no unattended executor is currently enabled.'],
  ['/agent', 'Market agent', 'Read-only market analysis and runtime configuration status.'],
  ['/vault', 'Vault console', 'Program status and policy design; not a deposit product.'],
  ['/safety', 'Safety', 'Risk limits, threat model and product boundaries.'],
];

export const metadata = {
  title: 'Documentation',
  description: 'WELP UP architecture, market rules, vault launch gates and product boundaries.',
};

export default function DocsPage() {
  return (
    <main className="terminal-page editorial-page docs-page">
      <div className="docs-layout">
        <aside className="docs-toc">
          <span className="editorial-section-number">DOCUMENTATION</span>
          <strong>On this page</strong>
          <nav aria-label="Documentation contents">
            {nav.map(([id, label], index) => (
              <a href={'#' + id} key={id}><span>0{index + 1}</span>{label}</a>
            ))}
          </nav>
          <div className="docs-toc-links">
            <Link href="/whitepaper">Technical whitepaper <span>↗</span></Link>
            <Link href="/safety">Safety centre <span>↗</span></Link>
          </div>
        </aside>

        <article className="editorial-article docs-article">
          <header className="editorial-hero docs-hero">
            <div className="eyebrow"><i className="eyebrow-dot" /> PRODUCT RECORD · SOLANA MAINNET</div>
            <h1>Know what it does.<br /><span>Know what it cannot.</span></h1>
            <p className="editorial-deck">WELP UP is a non-custodial Solana market console. This documentation describes the product flow, intended vault authority model, current launch gates and the boundaries that remain in force.</p>
          </header>

          <section className="editorial-notice editorial-notice-warning">
            <div className="editorial-notice-icon">!</div>
            <div>
              <strong>Mainnet safety notice</strong>
              <p>Wallet-approved swaps can use real mainnet assets. The WELP PDA vault and unattended agent execution are not production-enabled. Do not send funds to an unverified or derived vault address.</p>
            </div>
          </section>

          <section className="editorial-section docs-section" id="overview">
            <span className="editorial-section-number">01 / OVERVIEW</span>
            <h2>From public data to wallet approval.</h2>
            <p>The interface separates analysis from execution. Market signals do not place orders, and the wallet remains the authority for each supported swap.</p>
            <div className="docs-flow-grid">
              {flow.map(([number, title, detail]) => (
                <article className="docs-flow-card" key={number}>
                  <span>{number}</span><h3>{title}</h3><p>{detail}</p>
                </article>
              ))}
            </div>
            <div className="docs-surface-panel">
              <div className="docs-subheading"><div><span className="editorial-section-number">PRODUCT MAP</span><h3>Product surfaces</h3></div><span>Available routes</span></div>
              <div className="docs-surface-grid">
                {surfaces.map(([href, title, detail]) => (
                  <div key={href}>
                    <Link href={href}>{title} <span>↗</span></Link>
                    <p>{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="editorial-section docs-section" id="architecture">
            <span className="editorial-section-number">02 / AUTHORITY MODEL</span>
            <h2>Why a per-owner PDA design.</h2>
            <p>The intended design uses a separate program-derived account for each owner. It narrows authority compared with handing an agent a user wallet, but this design is not a security guarantee and is not currently a live vault service.</p>
            <div className="docs-authority-grid">
              {authority.map(([title, detail]) => (
                <article key={title}><span className="docs-card-mark">/</span><h3>{title}</h3><p>{detail}</p></article>
              ))}
            </div>
            <div className="docs-checklist-panel">
              <h3>Required authority properties</h3>
              <ul>
                <li>The owner never shares a wallet seed phrase with an agent.</li>
                <li>Any future spend policy must enforce total and per-position caps on-chain.</li>
                <li>The executor must not be able to change owner policy or withdraw.</li>
                <li>The owner must be able to pause and revoke without executor cooperation.</li>
                <li>Each owner’s vault state must be isolated from every other owner.</li>
              </ul>
            </div>
          </section>

          <section className="editorial-section docs-section" id="program">
            <span className="editorial-section-number">03 / VAULT PROGRAM</span>
            <h2>Scaffold, not a live vault.</h2>
            <p>The repository contains an Anchor program scaffold and a vault console. The execution path is intentionally fail-closed. The program must not be treated as deployed, audited or ready to hold funds.</p>
            <div className="docs-table-panel">
              <div className="docs-subheading"><div><span className="editorial-section-number">REFERENCE ONLY</span><h3>Instruction surface described by the design</h3></div><span>Not a deployed interface</span></div>
              <div className="editorial-table-wrap">
                <table>
                  <thead><tr><th>Instruction</th><th>Authority</th><th>Intended behaviour</th></tr></thead>
                  <tbody>
                    {[
                      ['initialize', 'Owner', 'Create per-owner policy state and start paused.'],
                      ['fund', 'Owner', 'Explicitly transfer SOL into the account; funding does not raise caps.'],
                      ['set_executor / revoke_executor', 'Owner', 'Set or clear the separate executor key.'],
                      ['pause / unpause', 'Owner', 'Control whether any permitted executor path may run.'],
                      ['withdraw', 'Owner', 'Owner-controlled recovery path.'],
                      ['execute_swap', 'Executor', 'Scaffold only; execution must remain disabled until reviewed CPI integration exists.'],
                    ].map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            <p>Before any real-value deployment: complete program testing, independent audit, closed findings, executable-program verification, route allowlisting, withdrawal and revocation checks, and a separate operational/legal review. Until then, do not fund a vault.</p>
            <Link className="editorial-inline-link" href="/vault">Open vault status console ↗</Link>
          </section>

          <section className="editorial-section docs-section" id="roadmap">
            <span className="editorial-section-number">04 / ROADMAP & RELEASE GATES</span>
            <h2>What must happen before vault launch.</h2>
            <p>These are release gates, not claims that the work is complete. The current interface can be used for market research and supported wallet-approved swaps independently of the vault.</p>
            <div className="docs-gate-list">
              {gates.map(([title, state, detail]) => (
                <article key={title}>
                  <div><strong>{title}</strong><p>{detail}</p></div>
                  <span>{state}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="editorial-section docs-section" id="rules">
            <span className="editorial-section-number">05 / RULES & SAFETY</span>
            <h2>A score is not a promise.</h2>
            <p>Signals are deterministic filters over available market fields. They can miss manipulation, stale data, liquidity withdrawal, contract risk and rapid market changes. They are not probabilities of profit or personalised financial advice.</p>
            <div className="docs-table-panel">
              <div className="docs-subheading"><div><span className="editorial-section-number">MARKET RULES</span><h3>How conditions are treated</h3></div></div>
              <div className="editorial-table-wrap">
                <table>
                  <thead><tr><th>Condition family</th><th>Effect</th><th>Reason</th></tr></thead>
                  <tbody>{rules.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className="docs-checklist-panel">
              <h3>What WELP does not do</h3>
              <ul>
                <li>It does not trade unattended or execute stop-losses on your behalf.</li>
                <li>It does not custody funds, hold wallet keys or ask for seed phrases.</li>
                <li>It does not offer a production vault, leverage or perpetual futures.</li>
                <li>It does not present simulated returns, fabricated fills or demo balances as live data.</li>
              </ul>
            </div>
            <div className="editorial-bottom-actions">
              <Link href="/safety" className="primary-action">Full safety page ↗</Link>
              <Link href="/whitepaper" className="home-outline-action">Technical whitepaper ↗</Link>
              <a href="https://github.com/Alitiora-Initiative/WELP-UP/blob/main/docs/vault/ARCHITECTURE.md" target="_blank" rel="noreferrer" className="editorial-source-link">Vault architecture source ↗</a>
              <a href="https://github.com/Alitiora-Initiative/WELP-UP/blob/main/docs/PRODUCTION_READINESS.md" target="_blank" rel="noreferrer" className="editorial-source-link">Production readiness checklist ↗</a>
            </div>
          </section>

          <footer className="editorial-document-footer">WELP UP! · Alitiora Initiative · Non-custodial interface · Digital assets can lose all value.</footer>
        </article>
      </div>
    </main>
  );
}
