'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react';
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock3, ExternalLink, Fingerprint, Globe2, LoaderCircle, ShieldAlert, ShieldCheck, Wallet, Waves } from 'lucide-react';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';
import { client } from '@/components/Providers';

type Chain = 'sol' | 'eth' | 'base' | 'bsc' | 'pol' | 'opt' | 'arb';
type ApiResult = {
  provider?: string;
  action?: string;
  chain?: string;
  updatedAt?: string;
  state?: string;
  data?: unknown;
  error?: string;
  results?: Record<string, { state?: string; status?: number; data?: unknown; error?: string }>;
  unsupported?: string[];
};
type ResultMap = Record<string, ApiResult>;

const chains: Array<{ value: Chain; label: string }> = [
  { value: 'sol', label: 'Solana' },
  { value: 'eth', label: 'Ethereum' },
  { value: 'base', label: 'Base' },
  { value: 'bsc', label: 'BNB Chain' },
  { value: 'pol', label: 'Polygon' },
  { value: 'opt', label: 'Optimism' },
  { value: 'arb', label: 'Arbitrum' },
];

function Panel({ title, eyebrow, icon: Icon, children }: { title: string; eyebrow: string; icon: typeof ShieldCheck; children: ReactNode }) {
  return <section className="terminal-panel webacy-panel">
    <div className="terminal-panel-heading webacy-panel-heading">
      <div><span>{eyebrow}</span><h2>{title}</h2></div>
      <Icon size={18} strokeWidth={1.7} />
    </div>
    {children}
  </section>;
}

function ResultView({ title, value, error }: { title: string; value?: unknown; error?: string }) {
  if (value === undefined && !error) return null;
  const raw = value === undefined ? '' : JSON.stringify(value, null, 2);
  const clipped = raw.length > 14000;
  return <div className="webacy-result">
    <div className="webacy-result-head">
      <strong>{title}</strong>
      <span className={error ? 'webacy-state is-error' : 'webacy-state is-ok'}>{error ? 'UNAVAILABLE' : 'RESPONSE RECEIVED'}</span>
    </div>
    {error ? <p className="webacy-error-text">{error}</p> : null}
    {value !== undefined ? <details>
      <summary>Inspect provider response</summary>
      <pre>{clipped ? raw.slice(0, 14000) + '\n… response clipped for display' : raw}</pre>
    </details> : null}
  </div>;
}

function Button({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="primary-action" onClick={onClick} disabled={disabled}>{children}</button>;
}

export default function WebacyRiskConsole() {
  const connected = useConnectedWallet(client);
  const connectedAddress = connected?.account.address ?? '';
  const [mint, setMint] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletChain, setWalletChain] = useState<Chain>('sol');
  const [transaction, setTransaction] = useState('');
  const [transactionChain, setTransactionChain] = useState<Chain>('sol');
  const [url, setUrl] = useState('');
  const [poolAddress, setPoolAddress] = useState('');
  const [poolChain, setPoolChain] = useState<Chain>('sol');
  const [poolTimeFrame, setPoolTimeFrame] = useState<'minute' | 'hour' | 'day'>('day');
  const [contractAddress, setContractAddress] = useState('');
  const [contractChain, setContractChain] = useState<Chain>('eth');
  const [results, setResults] = useState<ResultMap>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (connectedAddress) setWalletAddress(connectedAddress);
  }, [connectedAddress]);

  async function run(key: string, action: string, payload: Record<string, unknown> = {}) {
    setBusy((state) => ({ ...state, [key]: true }));
    setErrors((state) => ({ ...state, [key]: '' }));
    try {
      const response = await fetch('/api/webacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
        cache: 'no-store',
      });
      const data = await response.json() as ApiResult;
      if (!response.ok) throw new Error(data.error || 'Webacy request failed.');
      setResults((state) => ({ ...state, [key]: data }));
    } catch (error) {
      setErrors((state) => ({ ...state, [key]: error instanceof Error ? error.message : 'Webacy request failed.' }));
    } finally {
      setBusy((state) => ({ ...state, [key]: false }));
    }
  }

  const actionButton = (key: string, label: string, action: () => void, disabled = false) => (
    <Button onClick={action} disabled={disabled || Boolean(busy[key])}>
      {busy[key] ? <><LoaderCircle size={14} className="spin" /> Checking…</> : label}
    </Button>
  );

  return <main className="terminal-page feature-page webacy-page">
    <div className="page-heading">
      <div>
        <div className="eyebrow"><i className="eyebrow-dot" /> WEBACY SECURITY INTELLIGENCE</div>
        <h1>Know the risk. <span>Before you sign.</span></h1>
        <p>Token due diligence, holder behaviour, wallet exposure, transaction screening and phishing checks from Webacy. Results are live provider responses, not guarantees or investment advice.</p>
      </div>
      <div className="webacy-heading-actions">
        <span className="status-pill"><i /> SERVER-SIDE API</span>
        <WalletConnectionControl />
      </div>
    </div>

    <div className="feature-stats">
      <div className="feature-stat"><span>PROVIDER</span><strong>WEBACY</strong><small>Authenticated server proxy</small></div>
      <div className="feature-stat"><span>SOLANA TOKEN DD</span><strong>ENABLED</strong><small>Trading-lite + early holders</small></div>
      <div className="feature-stat"><span>WALLET SCREENING</span><strong>MULTI-CHAIN</strong><small>Threats · exposure · sanctions</small></div>
      <div className="feature-stat"><span>EXECUTION</span><strong>READ ONLY</strong><small>No transaction is signed here</small></div>
    </div>

    <div className="notice-block webacy-notice">
      <ShieldCheck size={18} />
      <div><strong>Independent security layer</strong><p>WELP’s existing Jupiter market filters remain separate. Webacy findings are shown as a second source so an unavailable or incomplete scan is never presented as a clean bill of health.</p></div>
    </div>

    <div className="feature-grid two">
      <Panel title="Solana token intelligence" eyebrow="TRADING DD · SOLANA" icon={ShieldAlert}>
        <p className="muted-copy">Scan a mint for holder concentration, launch snipers, bundled activity, deployer behaviour, and mint/freeze authority indicators.</p>
        <label className="field-label">TOKEN MINT ADDRESS<input value={mint} onChange={(event) => setMint(event.target.value)} placeholder="Paste a Solana token mint" spellCheck={false} autoComplete="off" /></label>
        <div className="inline-actions">
          {actionButton('token', 'Run token security scan', () => void run('token', 'token', { address: mint, chain: 'sol' }), mint.trim().length < 32)}
          {actionButton('holders', 'Analyze early holders', () => void run('holders', 'holders', { address: mint, chain: 'sol' }), mint.trim().length < 32)}
          {actionButton('tokenPools', 'Inspect token pools', () => void run('tokenPools', 'tokenPools', { address: mint, chain: 'sol' }), mint.trim().length < 32)}
        </div>
        <ResultView title="Token security indicators" value={results.token?.data} error={errors.token || results.token?.error} />
        <ResultView title="Early-holder analysis" value={results.holders?.data} error={errors.holders || results.holders?.error} />
        <ResultView title="Token pools and pool risk" value={results.tokenPools?.data} error={errors.tokenPools || results.tokenPools?.error} />
      </Panel>

      <Panel title="Wallet risk profile" eyebrow="RISK DD · ADDRESS SCREENING" icon={Wallet}>
        <p className="muted-copy">Screen a connected or pasted wallet for address threats, exposure to malicious entities and sanctions. EVM chains also include approval and poisoning checks.</p>
        <label className="field-label">WALLET / ADDRESS<input value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder="Connect a wallet or paste an address" spellCheck={false} autoComplete="off" /></label>
        <label className="field-label">NETWORK<select value={walletChain} onChange={(event) => setWalletChain(event.target.value as Chain)}>{chains.map((chain) => <option value={chain.value} key={chain.value}>{chain.label}</option>)}</select></label>
        <div className="inline-actions">
          {actionButton('wallet', 'Run wallet screening', () => void run('wallet', 'wallet', { address: walletAddress, chain: walletChain }), walletAddress.trim().length < 32)}
          {connectedAddress ? <span className="webacy-connected"><CheckCircle2 size={13} /> Wallet connected</span> : null}
        </div>
        {results.wallet?.results ? <div className="webacy-subresults">{Object.entries(results.wallet.results).map(([name, result]) => <ResultView key={name} title={name.replace(/([A-Z])/g, ' $1').toUpperCase()} value={result.data} error={result.error} />)}</div> : null}
        {errors.wallet || results.wallet?.error ? <p className="webacy-error-text">{errors.wallet || results.wallet?.error}</p> : null}
        {results.wallet?.unsupported?.map((note) => <p className="muted-copy" key={note}>{note}</p>)}
      </Panel>

      <Panel title="Transaction due diligence" eyebrow="KYT · ON-CHAIN TRANSACTION" icon={Activity}>
        <p className="muted-copy">Request Webacy’s risk details for a transaction hash or Solana signature. This is post-transaction intelligence, not a pre-sign simulation.</p>
        <label className="field-label">TRANSACTION SIGNATURE / HASH<input value={transaction} onChange={(event) => setTransaction(event.target.value)} placeholder="Paste a transaction signature" spellCheck={false} autoComplete="off" /></label>
        <label className="field-label">NETWORK<select value={transactionChain} onChange={(event) => setTransactionChain(event.target.value as Chain)}>{chains.map((chain) => <option value={chain.value} key={chain.value}>{chain.label}</option>)}</select></label>
        <div className="inline-actions">{actionButton('transaction', 'Analyze transaction risk', () => void run('transaction', 'transaction', { transaction, chain: transactionChain }), transaction.trim().length < 32)}</div>
        <ResultView title="Transaction risk response" value={results.transaction?.data} error={errors.transaction || results.transaction?.error} />
      </Panel>

      <Panel title="Phishing and URL screening" eyebrow="SECURITY DD · URL RISK" icon={Globe2}>
        <p className="muted-copy">Check a website, dApp or token project link for phishing, malware and other URL risk indicators before opening it.</p>
        <label className="field-label">WEBSITE URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" spellCheck={false} autoComplete="url" /></label>
        <div className="inline-actions">{actionButton('url', 'Scan URL risk', () => void run('url', 'url', { url }), !/^https?:\/\//i.test(url.trim()))}</div>
        <ResultView title="URL threat assessment" value={results.url?.data} error={errors.url || results.url?.error} />
      </Panel>

      <Panel title="Liquidity pool analysis" eyebrow="TRADING DD · OHLCV + POOL RISK" icon={Waves}>
        <p className="muted-copy">Inspect a known Solana or EVM pool using Webacy’s risk-rated OHLCV endpoint.</p>
        <label className="field-label">POOL ADDRESS<input value={poolAddress} onChange={(event) => setPoolAddress(event.target.value)} placeholder="Paste a liquidity pool address" spellCheck={false} autoComplete="off" /></label>
        <div className="form-grid">
          <label className="field-label">TIMEFRAME<select value={poolTimeFrame} onChange={(event) => setPoolTimeFrame(event.target.value as 'minute' | 'hour' | 'day')}><option value="minute">Minute</option><option value="hour">Hour</option><option value="day">Day</option></select></label>
          <label className="field-label">NETWORK<select value={poolChain} onChange={(event) => setPoolChain(event.target.value as Chain)}>{chains.map((chain) => <option value={chain.value} key={chain.value}>{chain.label}</option>)}</select></label>
        </div>
        <div className="inline-actions">{actionButton('pool', 'Analyze pool', () => void run('pool', 'pool', { address: poolAddress, chain: poolChain, timeFrame: poolTimeFrame, limit: 30 }), poolAddress.trim().length < 32)}</div>
        <ResultView title="Pool risk and OHLCV" value={results.pool?.data} error={errors.pool || results.pool?.error} />
      </Panel>

      <Panel title="EVM smart-contract review" eyebrow="CONTRACT RISK · EVM ONLY" icon={Fingerprint}>
        <p className="muted-copy">Optional contract-level analysis for supported EVM networks. This is separate from WELP’s Solana Anchor program and does not audit Solana programs.</p>
        <label className="field-label">CONTRACT ADDRESS<input value={contractAddress} onChange={(event) => setContractAddress(event.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" /></label>
        <label className="field-label">EVM NETWORK<select value={contractChain} onChange={(event) => setContractChain(event.target.value as Chain)}>{chains.filter((chain) => chain.value !== 'sol').map((chain) => <option value={chain.value} key={chain.value}>{chain.label}</option>)}</select></label>
        <div className="inline-actions">{actionButton('contract', 'Analyze contract', () => void run('contract', 'contract', { address: contractAddress, chain: contractChain }), !/^0x[a-fA-F0-9]{40}$/.test(contractAddress.trim()))}</div>
        <ResultView title="Contract security assessment" value={results.contract?.data} error={errors.contract || results.contract?.error} />
      </Panel>
    </div>

    <Panel title="Live market intelligence" eyebrow="WEBACY TRADING DD" icon={BarChart3}>
      <p className="muted-copy">Webacy-indexed trending tokens and risk-rated pools. Trending-token results may include multiple networks; inspect each returned chain and mint before using it.</p>
      <div className="inline-actions">
        {actionButton('trendingTokens', 'Load trending token risk', () => void run('trendingTokens', 'trendingTokens'))}
        {actionButton('trendingPools', 'Load Solana trending pools', () => void run('trendingPools', 'trendingPools', { chain: 'sol' }))}
        {actionButton('usage', 'Check API usage', () => void run('usage', 'usage'))}
      </div>
      <ResultView title="Trending token risk dataset" value={results.trendingTokens?.data} error={errors.trendingTokens || results.trendingTokens?.error} />
      <ResultView title="Solana trending pools" value={results.trendingPools?.data} error={errors.trendingPools || results.trendingPools?.error} />
      <ResultView title="Current Webacy API usage" value={results.usage?.data} error={errors.usage || results.usage?.error} />
    </Panel>

    <div className="notice-block webacy-notice">
      <AlertTriangle size={18} />
      <div><strong>Coverage and decision boundary</strong><p>Webacy documents raw transaction simulation and EIP-712 signature checks for EVM chains, not Solana wallet signing. Address-poisoning and standalone approval listings are also called only on supported EVM networks. ERC-4626 vault ratings, stablecoin/RWA scoring and methodology endpoints are not presented as audits of WELP’s custom Solana Anchor vault. Missing, stale, or failed scan data must be treated as unknown—not safe.</p>
        <a className="text-link" href="https://docs.webacy.com/" target="_blank" rel="noreferrer">Webacy API reference <ExternalLink size={13} /></a>
      </div>
    </div>
    <p className="webacy-footnote"><Clock3 size={13} /> Results are returned by Webacy when each request is made. Cached provider analyses may reflect the provider’s last analysis timestamp rather than the exact page-load time.</p>

    <style jsx global>{`
      .webacy-heading-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .webacy-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .webacy-panel-heading>svg{flex-shrink:0;color:var(--accent,#a6a6a6)}
      .webacy-panel .muted-copy{margin:0 0 14px}
      .webacy-panel .field-label{display:block;margin:12px 0}
      .webacy-panel .field-label input,.webacy-panel .field-label select{width:100%;margin-top:6px}
      .webacy-result{border-top:1px solid var(--border-color,rgba(255,255,255,.09));padding-top:10px;margin-top:12px}
      .webacy-result-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .webacy-result-head strong{font-size:12px;letter-spacing:.03em}
      .webacy-state{font:10px 'DM Mono',monospace;letter-spacing:.07em}
      .webacy-state.is-ok{color:#83c9a0}
      .webacy-state.is-error,.webacy-error-text{color:#e59a89}
      .webacy-result summary{cursor:pointer;color:var(--muted,#9b9b9b);font-size:11px;margin-top:8px}
      .webacy-result pre{max-height:280px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;border-radius:8px;background:rgba(0,0,0,.22);font:10px/1.55 'DM Mono',monospace;color:var(--text,#ddd);margin:8px 0 0}
      .webacy-subresults{display:grid;gap:8px}
      .webacy-subresults .webacy-result{margin-top:8px}
      .webacy-connected{display:inline-flex;align-items:center;gap:5px;color:#83c9a0;font-size:11px}
      .webacy-notice{margin:18px 0}
      .webacy-footnote{display:flex;align-items:center;gap:8px;color:var(--muted,#9b9b9b);font-size:11px;margin-top:14px}
      .webacy-page .inline-actions{display:flex;gap:8px;flex-wrap:wrap}
      @media(max-width:700px){.webacy-heading-actions{margin-top:14px}.webacy-panel-heading{align-items:flex-start}}
    `}</style>
  </main>;
}
