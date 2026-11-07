'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react';
import { ArrowUpRight, ExternalLink, LoaderCircle, LockKeyhole, RefreshCw, Search, ShieldAlert, Wallet } from 'lucide-react';
import { client } from '@/components/Providers';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';
import { TransactionHistory } from '@/components/TransactionHistory';
import { getWalletHistory, type WalletHistory } from '@/lib/activity';
import { MarketAnalyst } from '@/components/MarketAnalyst';

export type FeatureKind = 'automation' | 'agent' | 'autonomous' | 'vault' | 'portfolio' | 'history' | 'activity' | 'marketplace' | 'support' | 'status' | 'governance' | 'risk' | 'apiKeys' | 'referral' | 'explorer';

type Asset = {
  mint: string; name: string; symbol: string; priceUsd: number; priceChange24h: number;
  liquidityUsd: number; volume24hUsd: number; organicScore: number; score: number;
  verified: boolean; eligible: boolean; state: string; blockers: string[]; warnings: string[];
};
type Feed = { assets: Asset[]; eligible: number; blocked: number; updatedAt: string; error?: string };
type Policy = { id: string; name: string; liquidity: number; organic: number; drawdown: number; verified: boolean; preset: string };
type Status = { updatedAt: string; overall: string; error?: string; checks: Array<{ name: string; state: string; detail: string }> };

function Heading({ eyebrow, title, detail, action }: { eyebrow: string; title: ReactNode; detail: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow"><i className="eyebrow-dot" /> {eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action}</div>;
}
function Panel({ title, children, eyebrow }: { title: string; children: ReactNode; eyebrow?: string }) {
  return <section className="terminal-panel"><div className="terminal-panel-heading">{eyebrow ? <span>{eyebrow}</span> : null}<h2>{title}</h2></div>{children}</section>;
}
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="feature-stat"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
const emptyHistory: WalletHistory = { events: [], points: [] };

function AutomationPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [name, setName] = useState('Momentum watch');
  const [preset, setPreset] = useState('Momentum');
  const [liquidity, setLiquidity] = useState('250000');
  const [organic, setOrganic] = useState('65');
  const [drawdown, setDrawdown] = useState('18');
  const [verified, setVerified] = useState(false);
  const [results, setResults] = useState<Asset[] | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [monitoring, setMonitoring] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setPolicies(JSON.parse(localStorage.getItem('welp-watch-policies') || '[]') as Policy[]); }
      catch { setPolicies([]); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!monitoring || policies.length === 0) return;
    let active = true;
    let scanning = false;
    async function scanPolicies() {
      if (scanning) return;
      scanning = true;
      try {
        const response = await fetch('/api/markets', { cache: 'no-store' });
        const data = await response.json() as Feed;
        if (!response.ok) throw new Error(data.error || 'Live feed unavailable.');
        if (!active) return;
        const now = Date.now();
        let sent: Record<string, number> = {};
        try { sent = JSON.parse(localStorage.getItem('welp-watch-alerts-sent') || '{}') as Record<string, number>; } catch { sent = {}; }
        let notifications = 0;
        for (const policy of policies) {
          const matches = (data.assets || []).filter((asset) => asset.eligible && asset.liquidityUsd >= policy.liquidity && asset.organicScore >= policy.organic && asset.priceChange24h >= -policy.drawdown && (!policy.verified || asset.verified));
          for (const asset of matches) {
            const key = policy.id + ':' + asset.mint;
            if (now - (sent[key] || 0) < 24 * 60 * 60 * 1000) continue;
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(asset.symbol + ' matches ' + policy.name, {
                body: 'Score ' + asset.score + ' · Liquidity ' + String.fromCharCode(36) + Math.round(asset.liquidityUsd).toLocaleString() + '. Review the live signal before taking any action.',
                tag: key,
              });
              sent[key] = now;
              notifications += 1;
            }
          }
        }
        if (notifications) {
          try { localStorage.setItem('welp-watch-alerts-sent', JSON.stringify(sent)); } catch {}
          setMessage(notifications + ' new browser alert' + (notifications === 1 ? '' : 's') + ' sent. No order was created.');
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Live alert scan failed.');
      } finally { scanning = false; }
    }
    void scanPolicies();
    const timer = window.setInterval(() => void scanPolicies(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [monitoring, policies]);

  async function toggleMonitoring() {
    if (monitoring) { setMonitoring(false); setMessage('Live browser alerts paused.'); return; }
    if (typeof Notification === 'undefined') { setMessage('This browser does not support desktop notifications.'); return; }
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') { setMessage('Notification permission was not granted. No alerts will be sent.'); return; }
    if (!policies.length) { setMessage('Save at least one policy before starting live alerts.'); return; }
    setMonitoring(true);
    setMessage('Live alerts are active while this page stays open. Scans run every 60 seconds.');
  }


  function choosePreset(value: string) {
    setPreset(value);
    if (value === 'Momentum') { setLiquidity('250000'); setOrganic('65'); setDrawdown('18'); setVerified(false); }
    if (value === 'Depth first') { setLiquidity('500000'); setOrganic('40'); setDrawdown('20'); setVerified(false); }
    if (value === 'Organic only') { setLiquidity('100000'); setOrganic('85'); setDrawdown('25'); setVerified(true); }
  }
  function savePolicy() {
    const policy: Policy = { id: Date.now().toString(), name: name.trim() || 'Untitled policy', liquidity: Number(liquidity), organic: Number(organic), drawdown: Number(drawdown), verified, preset };
    const next = [policy, ...policies].slice(0, 30);
    setPolicies(next);
    setResults(null);
    setMessage('Saved to this browser only. This policy never trades.');
    try { localStorage.setItem('welp-watch-policies', JSON.stringify(next)); } catch {}
  }
  function removePolicy(id: string) {
    const next = policies.filter((policy) => policy.id !== id);
    setPolicies(next);
    try { localStorage.setItem('welp-watch-policies', JSON.stringify(next)); } catch {}
  }
  async function evaluate(policy: Policy) {
    setWorking(true); setMessage(''); setResults(null);
    try {
      const response = await fetch('/api/markets', { cache: 'no-store' });
      const data = await response.json() as Feed;
      if (!response.ok) throw new Error(data.error || 'Live feed unavailable.');
      const matches = (data.assets || []).filter((asset) => asset.eligible && asset.liquidityUsd >= policy.liquidity && asset.organicScore >= policy.organic && asset.priceChange24h >= -policy.drawdown && (!policy.verified || asset.verified));
      setResults(matches.slice(0, 12));
      setMessage('Evaluated against the current live snapshot. No order was created.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Evaluation failed.'); }
    finally { setWorking(false); }
  }
  return <main className="terminal-page feature-page">
    <Heading eyebrow="AUTOMATION · RULES, NOT AUTOPILOT" title={<>Policies you can read. <span>Analysis you can check.</span></>} detail="Save watch rules per browser and evaluate them against the live feed. Policies filter data only; neither policies nor this page place trades." />
    <div className="feature-stats"><Stat label="SAVED POLICIES" value={String(policies.length)} detail="Stored in this browser" /><Stat label="EXECUTION" value="OFF" detail="No orders from policies" /><Stat label="FEED" value="LIVE" detail="Jupiter Token API v2" /><Stat label="POLICY STORAGE" value="LOCAL" detail="Not synced across devices" /></div>
    <div className="feature-grid two">
      <Panel title="Signal policies" eyebrow="LOCAL WATCH RULES">
        <p className="muted-copy">Build a policy. It takes effect when you evaluate it against the latest feed.</p>
        <div className="inline-actions" style={{ margin: '12px 0 16px' }}>
          <button className={monitoring ? 'outline-button small' : 'primary-action'} onClick={() => void toggleMonitoring()} disabled={!policies.length && !monitoring}>
            {monitoring ? 'Pause browser alerts' : 'Enable browser alerts'}
          </button>
          <span className="muted-copy">{monitoring ? 'Active while this page stays open · checks every 60 seconds' : 'Optional notifications · no trades are placed'}</span>
        </div>
        {policies.length ? <div className="policy-list">{policies.map((policy) => <article key={policy.id}><div><strong>{policy.name}</strong><small>{policy.preset} · Liquidity {policy.liquidity.toLocaleString()} · Organic {policy.organic}+ · Drawdown {policy.drawdown}%</small></div><div className="inline-actions"><button className="outline-button small" onClick={() => void evaluate(policy)} disabled={working}>{working ? <LoaderCircle className="spin" size={13} /> : 'Evaluate'}</button><button className="text-action" onClick={() => removePolicy(policy.id)}>Remove</button></div></article>)}</div> : <div className="empty-panel">No policies yet. Build one on the right.</div>}
      </Panel>
      <Panel title="New policy" eyebrow="POLICY COMPOSER">
        <label className="field-label">NAME<input value={name} onChange={(event) => setName(event.target.value)} maxLength={48} /></label>
        <label className="field-label">PRESET<select value={preset} onChange={(event) => choosePreset(event.target.value)}><option>Momentum</option><option>Depth first</option><option>Organic only</option><option>Custom</option></select></label>
        <div className="form-grid"><label className="field-label">MIN LIQUIDITY ($)<input type="number" min="0" value={liquidity} onChange={(event) => setLiquidity(event.target.value)} /></label><label className="field-label">MIN ORGANIC SCORE<input type="number" min="0" max="100" value={organic} onChange={(event) => setOrganic(event.target.value)} /></label></div>
        <label className="field-label">MAXIMUM 24H DRAWDOWN (%)<input type="number" min="0" max="100" value={drawdown} onChange={(event) => setDrawdown(event.target.value)} /></label>
        <label className="checkbox-field"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} /> Verified assets only</label>
        <button className="primary-action" onClick={savePolicy}>Save policy</button>
        {message ? <p className="inline-message">{message}</p> : null}
      </Panel>
    </div>
    {results ? <Panel title="Evaluation results" eyebrow="LIVE FEED · NO ORDERS"><div className="compact-asset-list">{results.map((asset) => <div key={asset.mint}><strong>{asset.symbol}</strong><span>{asset.name}</span><b>{asset.score}</b><Link href={'/swap?mint=' + encodeURIComponent(asset.mint)}>Route →</Link></div>)}</div>{!results.length ? <p className="muted-copy">No assets currently satisfy all of this policy’s filters.</p> : null}</Panel> : null}
  </main>;
}

function VaultPage() {
  const gates = [
    ['Deployed program verified executable', 'OPEN', 'No mainnet program address is configured.'],
    ['Independent security audit', 'OPEN', 'Critical and high findings must be closed and published.'],
    ['Adversarial cap and allowlist tests', 'OPEN', 'Spending-cap, pause, revoke and withdrawal paths need tests.'],
    ['SOL and SPL withdrawal paths', 'OPEN', 'Owner-controlled withdrawal must be verified against the deployed program.'],
    ['Wallet-signed consent record', 'PARTIAL', 'A future policy acknowledgement must bind the owner and exact policy hash.'],
  ];
  return <main className="terminal-page feature-page">
    <Heading eyebrow="VAULT · PER-WALLET PDA · FAIL-CLOSED" title={<>Authority you can <span>revoke.</span></>} detail="The planned vault uses an isolated per-wallet address and narrow owner-controlled authority. It is not deployed or audited for mainnet use." action={<span className="status-pill warning"><i /> FUNDING DISABLED</span>} />
    <div className="feature-stats"><Stat label="PROGRAM ADDRESS" value="UNCONFIGURED" detail="No PDA is derived" /><Stat label="MAINNET STATE" value="NOT DEPLOYED" detail="Funding disabled" /><Stat label="EXECUTOR" value="NONE" detail="No delegated authority" /><Stat label="OWNER CONTROLS" value="PLANNED" detail="Pause · revoke · rotate · withdraw" /></div>
    <div className="feature-grid two">
      <Panel title="Launch gates" eyebrow="SECURITY CHECKLIST">{gates.map((gate) => <div className="gate-row" key={gate[0]}><span className={'gate-state ' + (gate[1] === 'PARTIAL' ? 'partial' : '')}>{gate[1]}</span><div><strong>{gate[0]}</strong><small>{gate[2]}</small></div></div>)}</Panel>
      <Panel title="Funding remains closed" eyebrow="PROTECT YOUR ASSETS"><div className="notice-block danger"><ShieldAlert size={18} /><div><strong>Do not send SOL or tokens to a PDA derived from the placeholder program ID.</strong><p>No mainnet vault address is published and no deposits or withdrawals are accepted by this interface.</p></div></div><p className="muted-copy">An interface setting is not an on-chain security boundary. The contract must be deployed, verified, audited, tested and published before a funding path is considered.</p><Link className="text-link" href="/docs">Read the architecture and production checklist <ArrowUpRight size={13} /></Link></Panel>
    </div>
    <Panel title="Authority model" eyebrow="DESIGNED, NOT ACTIVE"><div className="authority-flow"><span>OWNER WALLET</span><b>fund · pause · revoke · withdraw</b><span className="authority-arrow">↓</span><span>PER-WALLET VAULT PDA</span><b>only a reviewed executor instruction could spend within an on-chain cap</b><span className="authority-arrow">↓</span><span>APPROVED ROUTE PROGRAMS</span></div></Panel>
  </main>;
}

function AgentPage({ monitor = false }: { monitor?: boolean }) {
  if (monitor) {
    return <main className="terminal-page feature-page">
      <Heading eyebrow="AGENT MONITOR · EXECUTION DISABLED" title={<>No hidden <span>executor.</span></>} detail="WELP has no unattended mainnet executor, delegated signer or verified live bot performance. The monitor reports the actual service boundary; it does not invent agent activity." />
      <div className="feature-stats"><Stat label="PUBLIC MARKET DATA" value="READ ONLY" detail="Jupiter Token API v2" /><Stat label="MODEL ANALYSIS" value="SEPARATE" detail="No wallet permissions" /><Stat label="BOT EXECUTION" value="DISABLED" detail="No orders submitted by agents" /><Stat label="VAULT" value="NOT DEPLOYED" detail="No funding accepted" /></div>
      <Panel title="Execution release gates" eyebrow="NOT ENABLED">
        <div className="gate-row"><span className="gate-state">OFF</span><div><strong>Verified on-chain vault</strong><small>Program deployment, source verification and independent audit are incomplete.</small></div></div>
        <div className="gate-row"><span className="gate-state">OFF</span><div><strong>Constrained bot instruction set</strong><small>Strategy parameters, allowlists, position caps and nonce protection must be enforced on-chain.</small></div></div>
        <div className="gate-row"><span className="gate-state">OFF</span><div><strong>Keeper and reconciliation service</strong><small>Execution requires isolated infrastructure, confirmed transaction indexing and an emergency stop path.</small></div></div>
        <div className="gate-row"><span className="gate-state">OFF</span><div><strong>Performance reporting</strong><small>No ROI or bot track record is shown until derived from reconciled on-chain events.</small></div></div>
        <Link className="text-link" href="/vault">Review vault launch gates <ArrowUpRight size={13} /></Link>
      </Panel>
    </main>;
  }
  return <main className="terminal-page feature-page">
    <Heading eyebrow="MARKET AGENT · ANALYSIS ONLY" title={<>Ask the desk. <span>Keep control.</span></>} detail="The analyst can interpret the current public market snapshot when a server-side model is configured. It has no wallet access, signing tools or execution permissions." />
    <MarketAnalyst />
  </main>;
}
function GenericUnavailable({ kind }: { kind: FeatureKind }) {
  const config: Record<string, { eyebrow: string; title: ReactNode; description: string; status: string; details: string[] }> = {
    governance: { eyebrow: 'GOVERNANCE · NOT DEPLOYED', title: <>Governance with <span>verifiable authority.</span></>, description: 'WELP has no deployed governance program, proposal registry or vote-weighting contract in this release.', status: 'NOT ENABLED', details: ['No governance program is configured on Solana mainnet.','No proposals or votes are accepted or stored by this interface.','A future launch needs a published program, eligibility rules, quorum and transparent execution path.'] },
    apiKeys: { eyebrow: 'DEVELOPER CONSOLE · CREDENTIALS', title: <>Keep credentials <span>server-side.</span></>, description: 'This deployment does not provide user API-key issuance or a secure key-management backend.', status: 'NOT AVAILABLE', details: ['Jupiter provider credentials belong in server environment variables.','Never paste private keys, seed phrases or provider secrets into a browser form.','No API key is generated, stored or returned by this page.'] },
    referral: { eyebrow: 'REFERRALS · NOT ENABLED', title: <>Community growth, <span>without fake rewards.</span></>, description: 'There is no referral attribution, eligibility ledger or reward-payment system configured for WELP UP.', status: 'NOT AVAILABLE', details: ['No referral links or invite codes are being issued.','No referral balances, commissions or token rewards are accrued.','A future program needs clear terms, abuse controls and a verifiable payment path.'] },
    marketplace: { eyebrow: 'STRATEGY MARKETPLACE · PREVIEW ONLY', title: <>Strategies to inspect, <span>not blindly copy.</span></>, description: 'Strategy templates can guide watch policies. Copy-trade execution, subscriptions and profit-share settlement are not enabled.', status: 'COPY TRADING OFF', details: ['No bot owner identity or verified strategy track record is published.','No subscription fee or profit-share payment is collected.','No trades are mirrored into a user vault.'] },
  };
  const item = config[kind] || config.governance;
  return <main className="terminal-page feature-page"><Heading eyebrow={item.eyebrow} title={item.title} detail={item.description} action={<span className="status-pill warning"><i /> {item.status}</span>} /><Panel title="Current release boundaries" eyebrow="TRANSPARENT STATUS">{item.details.map((line) => <div className="gate-row" key={line}><span className="gate-state">—</span><div><strong>{line}</strong></div></div>)}</Panel><p className="muted-copy">This page is intentionally not filled with simulated accounts, fake balances, dummy votes or fabricated earnings.</p></main>;
}

function RiskPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { void fetch('/api/markets', { cache: 'no-store' }).then((response) => response.json()).then((data) => setFeed(data as Feed)).catch(() => undefined); }, 0); return () => window.clearTimeout(timer); }, []);
  const blocked = feed?.assets?.filter((asset) => !asset.eligible) || [];
  const warned = feed?.assets?.filter((asset) => asset.eligible && asset.warnings?.length) || [];
  return <main className="terminal-page feature-page"><Heading eyebrow="RISK DASHBOARD · LIVE FEED" title={<>See the risk. <span>Before the route.</span></>} detail="A read-only view of the hard rules and warnings calculated from the live Jupiter token feed. Filters do not guarantee safety or protect capital." />
    <div className="feature-stats"><Stat label="ASSETS REVIEWED" value={String(feed?.assets?.length ?? '—')} detail="Current feed snapshot" /><Stat label="BLOCKED" value={String(blocked.length)} detail="At least one hard rule failed" /><Stat label="WARNINGS" value={String(warned.length)} detail="Eligible but carries warnings" /><Stat label="LAST SNAPSHOT" value={feed?.updatedAt ? new Date(feed.updatedAt).toLocaleTimeString() : '—'} detail="Jupiter Token API v2" /></div>
    <div className="feature-grid two"><Panel title="Hard blocks" eyebrow="DO NOT ROUTE">{blocked.slice(0, 12).map((asset) => <div className="risk-row" key={asset.mint}><strong>{asset.symbol}</strong><span>{asset.blockers.join(' · ')}</span></div>)}{!blocked.length ? <p className="muted-copy">Loading feed or no blocked assets currently reported.</p> : null}</Panel><Panel title="Warnings to review" eyebrow="RISK FLAGS">{warned.slice(0, 12).map((asset) => <div className="risk-row" key={asset.mint}><strong>{asset.symbol}</strong><span>{asset.warnings.join(' · ')}</span></div>)}{!warned.length ? <p className="muted-copy">No warning rows available in this snapshot.</p> : null}</Panel></div>
  </main>;
}

function ExplorerPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ mint: string; name: string; symbol: string; logo: string | null; price: number | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const search = useCallback(async () => {
    if (query.trim().length < 2) { setResults([]); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/tokens?q=' + encodeURIComponent(query.trim()), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Token search unavailable.');
      const tokens = Array.isArray(data.tokens) ? data.tokens : [];
      setResults(tokens.map((token: Record<string, unknown>) => ({ mint: String(token.mint), name: String(token.name), symbol: String(token.symbol), logo: typeof token.logo === 'string' ? token.logo : null, price: Number.isFinite(Number(token.price)) ? Number(token.price) : null })));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Search failed.'); }
    finally { setLoading(false); }
  }, [query]);
  return <main className="terminal-page feature-page"><Heading eyebrow="TOKEN EXPLORER · JUPITER SEARCH" title={<>Inspect a token. <span>Verify the mint.</span></>} detail="Search the public Jupiter token registry by symbol, name or mint address. Token inclusion is not an endorsement or a safety guarantee." />
    <div className="explorer-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void search(); }} placeholder="Search token name, symbol or mint address" aria-label="Token search" /><button className="primary-action" onClick={() => void search()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={14} /> : 'Search'}</button></div>
    {error ? <div className="feed-error">{error}</div> : null}
    <div className="explorer-results">{results.map((token) => <article key={token.mint} className="explorer-result"><div className="asset-cell">{token.logo ? <span className="asset-avatar">{token.symbol.slice(0,1)}</span> : <span className="asset-avatar">{token.symbol.slice(0,1)}</span>}<div><strong>{token.symbol}</strong><small>{token.name}</small><code>{token.mint}</code></div></div><span>{token.price === null ? 'Price unavailable' : '$' + token.price.toPrecision(5)}</span><a href={'https://solscan.io/token/' + encodeURIComponent(token.mint)} target="_blank" rel="noreferrer">Solscan <ExternalLink size={13} /></a><Link href={'/swap?mint=' + encodeURIComponent(token.mint)}>Open swap <ArrowUpRight size={13} /></Link></article>)}</div>
  </main>;
}

function StrategyMarketplacePage() {
  const templates = [
    { name: 'Momentum Drift', risk: 'MOMENTUM', summary: 'Watch high-organic-score pools that retain depth across consecutive feed snapshots.', rules: ['Score ≥ 90', 'Organic ≥ 85', 'Liquidity ≥ $250k', '24h drawdown under 18%'] },
    { name: 'Mean Revert Lite', risk: 'LOWER TURNOVER', summary: 'Review verified, deeper pools after short-term price dislocations.', rules: ['Verified assets', 'Liquidity ≥ $500k', 'Impact below 0.4%', 'Tight spread'] },
    { name: 'Whale Tail', risk: 'CONCENTRATION WATCH', summary: 'Track concentration changes and holder distribution before considering any route.', rules: ['Top holders below 55%', 'Organic ≥ 90', 'Score ≥ 92', 'Review warnings'] },
    { name: 'Calm Carry', risk: 'LOW VOLATILITY FILTER', summary: 'Focus research on calmer verified assets with more stable turnover.', rules: ['Verified assets', 'Calm ≥ 90', 'Turnover below 1.2×', 'Read liquidity'] },
  ];
  return <main className="terminal-page feature-page">
    <Heading eyebrow="STRATEGY MARKETPLACE · RULE TEMPLATES" title={<>Strategies to inspect, <span>not blindly copy.</span></>} detail="Explore four research templates that can guide your own watch policies. They are not verified bots, backtests, live portfolios or promises of return." action={<span className="status-pill warning"><i /> COPY TRADING OFF</span>} />
    <div className="feature-stats"><Stat label="RULE TEMPLATES" value="4" detail="Research presets only" /><Stat label="LIVE STRATEGY OWNERS" value="0" detail="No verified bot identities" /><Stat label="COPY EXECUTION" value="OFF" detail="No delegated trade flow" /><Stat label="PROFIT SHARE" value="OFF" detail="No fee or reward settlement" /></div>
    <div className="feature-grid two">{templates.map((template, index) => <article className="terminal-panel strategy-template" key={template.name}>
      <div className="strategy-template-top"><span>0{index + 1}</span><b>{template.risk}</b></div>
      <h2>{template.name}</h2><p>{template.summary}</p>
      <div className="strategy-rule-list">{template.rules.map((rule) => <span key={rule}>{rule}</span>)}</div>
      <Link className="text-link" href="/automation">Build a watch policy <ArrowUpRight size={13} /></Link>
    </article>)}</div>
    <div className="notice-block"><ShieldAlert size={18} /><div><strong>Copy trading is not active.</strong><p>No strategy owner identity, verified live track record, subscription payment, profit-share ledger or vault execution is configured in this release. Nothing on this page copies a trade or charges a fee.</p></div></div>
  </main>;
}

function SupportPage() {
  const faqs = [
    ['Why can the vault not be funded yet?', 'No mainnet vault program address is configured and independently audited. The console fails closed and does not offer a funding address.'],
    ['Does WELP hold my keys or trade for me?', 'No. WELP reads public wallet data and prepares a Jupiter order. Your connected wallet reviews and signs each swap.'],
    ['Are the strategy statistics live?', 'This release does not publish verified live bot P&L or copy-trading performance. Treat third-party claims with caution.'],
    ['Why did a signal get blocked?', 'A row can be blocked by an active freeze authority, liquidity below $100,000, 24-hour volume below $100,000 or top holders above 60%.'],
    ['What should I include in a support request?', 'Include the page, a description of the issue and, if relevant, the public wallet address and transaction signature. Never send a seed phrase or private key.'],
  ];
  const [open, setOpen] = useState(0);
  return <main className="terminal-page feature-page"><Heading eyebrow="SUPPORT CENTRE" title={<>Help for your <span>console.</span></>} detail="Troubleshooting and product questions. Support cannot move funds, sign transactions or recover a wallet seed phrase." />
    <div className="feature-grid two"><Panel title="Frequently asked" eyebrow="HELP CENTRE">{faqs.map((faq, index) => <div className="faq-item" key={faq[0]}><button onClick={() => setOpen(open === index ? -1 : index)}>{faq[0]}<span>{open === index ? '−' : '+'}</span></button>{open === index ? <p>{faq[1]}</p> : null}</div>)}</Panel><Panel title="Reach the operator" eyebrow="CONTACT"><p className="muted-copy">For product issues, include the exact error and avoid sharing secrets.</p><a className="contact-address" href="mailto:cryptany@gmail.com">cryptany@gmail.com</a><div className="notice-block"><LockKeyhole size={17} /><div><strong>Self-custody reminder</strong><p>Support will never ask you to share your seed phrase or private key. Only you can approve wallet actions.</p></div></div></Panel></div>
  </main>;
}

function StatusPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async (manual = false) => {
    if (manual) setLoading(true);
    setError('');
    try { const response = await fetch('/api/status', { cache: 'no-store' }); const data = await response.json() as Status; if (!response.ok) throw new Error(data.error || 'Status check failed.'); setStatus(data); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Status unavailable.'); }
    finally { if (manual) setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  return <main className="terminal-page feature-page"><Heading eyebrow="SYSTEM STATUS · LIVE CHECKS" title={<>Operational status <span>of the console.</span></>} detail="Connectivity checks run when this page loads. A healthy feed does not imply that vaults or autonomous services are available." action={<button className="outline-button" onClick={() => void refresh(true)} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Re-check</button>} />
    <div className="feature-stats"><Stat label="OVERALL" value={status?.overall || 'CHECKING'} detail="Aggregated service status" /><Stat label="UPDATED" value={status?.updatedAt ? new Date(status.updatedAt).toLocaleTimeString() : '—'} detail="Last check" /><Stat label="AUTONOMOUS AGENTS" value="OFF" detail="Not configured" /><Stat label="VAULT FUNDING" value="OFF" detail="Program not deployed" /></div>
    {error ? <div className="feed-error">{error}</div> : null}
    <Panel title="Service checks" eyebrow="LIVE STATUS">{(status?.checks || []).map((item) => <div className="gate-row" key={item.name}><span className={'gate-state ' + (item.state === 'Operational' ? 'good' : '')}>{item.state.toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.detail}</small></div></div>)}</Panel>
  </main>;
}

function PortfolioPage() {
  const connected = useConnectedWallet(client);
  const owner = connected?.account.address ?? '';
  const [balance, setBalance] = useState<{ owner: string; sol: number; solPrice: number; stableUsd: number; equityUsd: number } | null>(null);
  const activeBalance = balance?.owner === owner ? balance : null;
  const [error, setError] = useState('');
  useEffect(() => {
    if (!owner) return;
    let active = true;
    fetch('/api/wallet?owner=' + encodeURIComponent(owner), { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Wallet read failed.');
      if (active) { setBalance({ ...data, owner }); setError(''); }
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Wallet read failed.'); });
    return () => { active = false; };
  }, [owner]);
  return <main className="terminal-page feature-page"><Heading eyebrow="PORTFOLIO · PUBLIC MAINNET DATA" title={<>Your wallet, <span>as it actually is.</span></>} detail="Balances are read from Solana for the connected public address. WELP never asks for a seed phrase or stores private keys." action={<WalletConnectionControl />} />
    {owner ? <><div className="feature-stats"><Stat label="SOL BALANCE" value={activeBalance ? activeBalance.sol.toFixed(4) + ' SOL' : '—'} detail={activeBalance ? 'SOL at $' + activeBalance.solPrice.toFixed(2) : 'Reading public balance'} /><Stat label="TOKEN VALUE" value={activeBalance ? '$' + activeBalance.stableUsd.toFixed(2) : '—'} detail="USDC and USDT snapshot" /><Stat label="TOTAL READ" value={activeBalance ? '$' + activeBalance.equityUsd.toFixed(2) : '—'} detail="Estimated SOL + stablecoin value" /></div>{error ? <div className="feed-error">{error}</div> : null}<TransactionHistory owner={owner} /></> : <div className="empty-panel centered"><Wallet size={24} /><strong>Open a wallet session</strong><p>Connect a Solana wallet to read balances and on-chain transaction history.</p></div>}
  </main>;
}

function ActivityLogsPage() {
  const connected = useConnectedWallet(client);
  const owner = connected?.account.address ?? '';
  const [history, setHistory] = useState<WalletHistory>(emptyHistory);
  useEffect(() => { const timer = window.setTimeout(() => setHistory(owner ? getWalletHistory(owner) : emptyHistory), 0); return () => window.clearTimeout(timer); }, [owner]);
  return <main className="terminal-page feature-page"><Heading eyebrow="ACTIVITY LOGS · BROWSER-LOCAL" title={<>A record of <span>this browser’s activity.</span></>} detail="These supplemental events are stored locally per wallet. They are not a tamper-proof audit ledger or a complete list of on-chain actions." action={<WalletConnectionControl />} />
    {owner ? <Panel title="Recorded events" eyebrow="LOCAL STORAGE">{history.events.length ? history.events.map((event) => <div className="gate-row" key={event.id}><span className="gate-state">{event.type.toUpperCase()}</span><div><strong>{event.title}</strong><small>{event.detail} · {new Date(event.at).toLocaleString()}</small>{event.signature ? <a href={'https://explorer.solana.com/tx/' + event.signature} target="_blank" rel="noreferrer">View transaction <ExternalLink size={12} /></a> : null}</div></div>) : <div className="empty-panel">No local activity recorded for this wallet in this browser.</div>}</Panel> : <div className="empty-panel centered"><Wallet size={24} /><strong>Connect a wallet</strong><p>Local activity is scoped to the connected public wallet address.</p></div>}
  </main>;
}

function HistoryPage() {
  const connected = useConnectedWallet(client);
  const owner = connected?.account.address ?? '';
  return <main className="terminal-page feature-page"><Heading eyebrow="TRANSACTION HISTORY · PER WALLET" title={<>Every transaction, <span>from your address.</span></>} detail="On-chain signatures are read from Solana RPC. This view does not claim to be a tax statement or a complete accounting ledger." action={<WalletConnectionControl />} />{owner ? <TransactionHistory owner={owner} /> : <div className="empty-panel centered"><Wallet size={24} /><strong>Connect a wallet</strong><p>On-chain transaction history is read for the connected public address.</p></div>}</main>;
}

export function TerminalFeaturePage({ kind }: { kind: FeatureKind }) {
  if (kind === 'automation') return <AutomationPage />;
  if (kind === 'vault') return <VaultPage />;
  if (kind === 'agent') return <AgentPage />;
  if (kind === 'autonomous') return <AgentPage monitor />;
  if (kind === 'portfolio') return <PortfolioPage />;
  if (kind === 'history') return <HistoryPage />;
  if (kind === 'activity') return <ActivityLogsPage />;
  if (kind === 'status') return <StatusPage />;
  if (kind === 'marketplace') return <StrategyMarketplacePage />;
  if (kind === 'support') return <SupportPage />;
  if (kind === 'risk') return <RiskPage />;
  if (kind === 'explorer') return <ExplorerPage />;
  return <GenericUnavailable kind={kind} />;
}
