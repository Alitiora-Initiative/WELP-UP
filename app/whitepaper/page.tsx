import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

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
  ['06', 'Fees and governance', 'The 0.50% protocol fee is a target design, not active WELP treasury revenue. No WELP referral fee is currently configured; Jupiter or route providers may still charge their own fees.'],
  ['07', 'Security and risks', 'Threats, launch gates, irreversibility, liquidity risk, smart-contract risk, and no guarantee of returns.'],
];

export default function WhitepaperPage() {
  return (
    <main className="terminal-page editorial-page whitepaper-page">
      <article className="editorial-article">
        <header className="editorial-hero">
          <div className="eyebrow"><i className="eyebrow-dot" /> OFFICIAL TECHNICAL PUBLICATION</div>
          <div className="editorial-meta"><span>VERSION 1.1</span><span>7 NOVEMBER 2026</span><span>SOLANA MAINNET</span></div>
          <h1>WELP UP<span>!</span></h1>
          <p className="editorial-deck">A transparent Solana market console built around real market data and user-approved execution.</p>
        </header>

        <section className="editorial-notice" aria-label="Current product status">
          <div className="editorial-notice-icon"><ShieldCheckIcon /></div>
          <div>
            <strong>Current product status</strong>
            <p>This paper distinguishes available application functionality from gated protocol designs. The vault is not deployed or audited on mainnet; unattended agents and copy trading are not active. The 0.50% WELP fee is a target design, not currently configured treasury revenue. This document is not an investment offer or security audit.</p>
          </div>
        </section>

        <section className="editorial-section editorial-contents">
          <div className="editorial-section-heading">
            <div><span className="editorial-section-number">CONTENTS</span><h2>Inside the paper</h2></div>
            <span className="editorial-muted">7 sections</span>
          </div>
          <div className="editorial-chapter-list">
            {chapters.map(([number, title, summary]) => (
              <a className="editorial-chapter" href={'#chapter-' + number} key={number}>
                <span>{number}</span>
                <span><strong>{title}</strong><small>{summary}</small></span>
                <span className="editorial-chapter-arrow">↗</span>
              </a>
            ))}
          </div>
        </section>

        <section className="editorial-section" id="chapter-01">
          <span className="editorial-section-number">01 / ABSTRACT</span>
          <h2>Market intelligence with user-controlled execution.</h2>
          <p>WELP UP is a Solana market-analysis and wallet-approved trading interface. It reads live market information, evaluates assets against published rules, and prepares supported swap routes for the connected wallet to review and sign. The application does not take custody of wallet keys or perform unattended trades.</p>
        </section>

        <section className="editorial-section" id="chapter-02">
          <span className="editorial-section-number">02 / DESIGN PRINCIPLES</span>
          <h2>Boundaries are part of the product.</h2>
          <div className="editorial-principle-grid">
            <article><strong>User-controlled signing</strong><p>Every supported transaction is reviewed and signed by the user&apos;s wallet.</p></article>
            <article><strong>Observable inputs</strong><p>Signals rely on retrieved market fields and explicit deterministic rules.</p></article>
            <article><strong>Fail-closed behavior</strong><p>Missing or unverified infrastructure blocks the affected action rather than falling back to a simulation.</p></article>
            <article><strong>Verifiable history</strong><p>Confirmed on-chain signatures establish execution; local browser records are supplemental.</p></article>
            <article><strong>Least authority</strong><p>Any future executor must have narrow, revocable permissions and never receive the user&apos;s primary wallet secret.</p></article>
            <article><strong>Transparent economics</strong><p>Fees, recipients, release rules and limitations must be disclosed and reconciled against on-chain state.</p></article>
          </div>
        </section>

        <section className="editorial-section" id="chapter-03">
          <span className="editorial-section-number">03 / CURRENT SYSTEM</span>
          <h2>What the application does today.</h2>
          <div className="editorial-detail-list">
            <div><strong>Market data and signals</strong><p>The web application reads Solana token and market information from Jupiter Token API v2. Eligibility is calculated from provider fields and explicit risk rules. Missing or stale data should be shown as unavailable, not replaced with fabricated values.</p></div>
            <div><strong>Wallet and swap flow</strong><p>The interface discovers supported Solana Wallet Standard providers, requests a Jupiter Swap API v2 order, hands the transaction to the connected wallet for signing, and submits the signed transaction through the execution path. A quote is not a fill; a confirmed transaction signature is evidence of execution.</p></div>
            <div><strong>Automation and AI research</strong><p>Browser-local watch policies can evaluate live feed snapshots while the page remains open. AI review is read-only and requires a configured server-side model. Policies do not sign or submit trades, and browser monitoring is not a persistent background service.</p></div>
            <div><strong>Portfolio and activity</strong><p>Public wallet balances and transaction signatures are read from Solana RPC. Local snapshots and preferences are supplemental, may be cleared by the browser, and are not a complete accounting record.</p></div>
          </div>
        </section>

        <section className="editorial-section" id="chapter-04">
          <span className="editorial-section-number">04 / VAULT ARCHITECTURE</span>
          <h2>A proposed per-owner authority model.</h2>
          <p>The repository contains an Anchor/Rust vault scaffold intended to use per-user program-derived addresses. The proposed model includes user-signed funding, on-chain allocation limits, narrowly scoped executor authority, owner pause and revocation, and owner-controlled recovery.</p>
          <div className="editorial-callout editorial-callout-warning">
            <strong>Not an available mainnet custody service</strong>
            <p>The checked-in program ID is not a verified production deployment. Automated swaps, SPL-token position accounting, executor settlement and recovery paths remain disabled or incomplete. Do not send funds to a PDA derived from an unverified program ID.</p>
          </div>
        </section>

        <section className="editorial-section" id="chapter-05">
          <span className="editorial-section-number">05 / AGENTS AND COPY TRADING</span>
          <h2>Research and execution remain separate.</h2>
          <p>The current market analyst is intended to provide read-only commentary over retrieved market context. The proposed executor architecture is separate and must not gain access to a user&apos;s primary wallet secret. No unattended trading or verified copy-trading performance is currently available.</p>
        </section>

        <section className="editorial-section" id="chapter-06">
          <span className="editorial-section-number">06 / FEES AND GOVERNANCE</span>
          <h2>Target economics are not collected revenue.</h2>
          <p>The target protocol fee is 0.50% of gross input for swaps that execute through a WELP-controlled, fee-enforcing on-chain instruction. The current release does not have a configured WELP referral fee destination, and no active WELP treasury fee collection should be inferred from the target policy. Jupiter or route providers may still charge their own fees.</p>
          <p>The documented 60/40 developer and protected-reserve distribution after a 14-day epoch is a policy design until implemented and verified against mainnet records. WELP cannot intercept arbitrary transfers or swaps routed directly through other protocols.</p>
        </section>

        <section className="editorial-section" id="chapter-07">
          <span className="editorial-section-number">07 / SECURITY AND RISKS</span>
          <h2>Digital assets remain high risk.</h2>
          <p>Solana transactions may fail, be delayed or be irreversible once confirmed. Liquidity can disappear, prices can move sharply, token authorities can change, and wallets, providers, RPC infrastructure or smart contracts can fail or be compromised. Users may lose some or all assets. WELP does not guarantee execution price, liquidity, returns or capital protection.</p>
          <div className="editorial-bottom-actions">
            <Link href="/safety" className="primary-action">Review safety limits <ArrowUpRight size={14} /></Link>
            <Link href="/docs" className="home-outline-action">Read product documentation <ArrowUpRight size={14} /></Link>
            <a href="https://github.com/Alitiora-Initiative/WELP-UP/blob/main/WHITEPAPER.md" target="_blank" rel="noreferrer" className="editorial-source-link">Read source whitepaper <ArrowUpRight size={13} /></a>
          </div>
        </section>

        <footer className="editorial-document-footer">WELP UP! · Alitiora Initiative · Technical whitepaper · Digital assets can lose all value.</footer>
      </article>
    </main>
  );
}

function ShieldCheckIcon() {
  return <span aria-hidden="true">✓</span>;
}
