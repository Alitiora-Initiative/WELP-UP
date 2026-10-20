'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowDownUp,
  ArrowUpRight,
  CircleHelp,
  CirclePlus,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { address, getTransactionDecoder, getTransactionEncoder } from '@solana/kit';
import { useClient } from '@solana/react';
import { useConnectedWallet, WalletReadyGate } from '@solana/kit-plugin-wallet/react';
import { client, type AppClient } from '@/components/Providers';
import { AppSidebar } from '@/components/AppSidebar';
import { WalletConnect } from '@/components/WalletConnect';
import { SOL_MINT } from '@/lib/constants';
import type { Signal } from '@/lib/signals';

type Token = { mint: string; symbol: string; name: string; decimals: number; logo?: string | null; price?: number | null };
type WalletSummary = { owner: string; sol: number; solPrice: number; stableUsd: number; equityUsd: number };
type Order = {
  transaction: string;
  requestId: string;
  inAmount: string;
  outAmount: string;
  priceImpact?: number | string;
  feeBps?: number;
  feeMint?: string;
  slippageBps?: number;
  taker: string;
};

const EMPTY_SIGNALS: Signal[] = [];

function shortAddress(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function decodeBase64(value: string) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(value: ArrayLike<number>) {
  let binary = '';
  for (let index = 0; index < value.length; index += 1) binary += String.fromCharCode(value[index]);
  return window.btoa(binary);
}

function parseUnits(value: string, decimals: number) {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d*))?$/.exec(trimmed);
  if (!match || (match[2]?.length ?? 0) > decimals) return null;
  const scale = BigInt(10) ** BigInt(decimals);
  const fractional = (match[2] ?? '').padEnd(decimals, '0');
  return (BigInt(match[1]) * scale + BigInt(fractional || '0')).toString();
}

function formatUnits(value: string, decimals: number, digits = 6) {
  try {
    const raw = BigInt(value);
    const scale = BigInt(10) ** BigInt(decimals);
    const whole = (raw / scale).toLocaleString('en-US');
    const fraction = decimals > 0
      ? (raw % scale).toString().padStart(decimals, '0').slice(0, digits).replace(/0+$/, '')
      : '';
    return fraction ? `${whole}.${fraction}` : whole;
  } catch {
    return '—';
  }
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/reject|cancel/i.test(message)) return 'Signature request was cancelled in your wallet.';
  if (/timeout|expired|blockhash/i.test(message)) return 'This order may have expired. Request a fresh quote and try again.';
  return message || 'Something went wrong. Please try again.';
}

function ScoreRing({ score, eligible }: { score: number; eligible: boolean }) {
  return (
    <div className={`score-ring${eligible ? ' score-ready' : ''}`} aria-label={`Rule score ${score}`}>
      <span>{Math.round(score)}</span>
      <small>/100</small>
    </div>
  );
}

export function Dashboard() {
  const appClient = useClient<AppClient>();
  const connected = useConnectedWallet(appClient);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [solBalance, setSolBalance] = useState<{ owner: string; value: number } | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsOwner, setSignalsOwner] = useState('');
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [signalsError, setSignalsError] = useState('');
  const [token, setToken] = useState<Token | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Token[]>([]);
  const [searching, setSearching] = useState(false);
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('0.001');
  const [order, setOrder] = useState<Order | null>(null);
  const [orderTime, setOrderTime] = useState(0);
  const [pending, setPending] = useState<'quote' | 'sign' | ''>('');
  const [tradeError, setTradeError] = useState('');
  const [signature, setSignature] = useState('');

  const walletAddress = connected?.account.address ?? '';
  const currentSignals = signalsOwner === walletAddress ? signals : EMPTY_SIGNALS;
  const activeSummary = summary?.owner === walletAddress ? summary : null;
  const activeSolBalance = solBalance?.owner === walletAddress ? solBalance.value : null;
  const defaultSignal = currentSignals.find((signal) => signal.eligible) ?? currentSignals[0] ?? null;
  const activeToken = token ?? (defaultSignal ? {
    mint: defaultSignal.mint,
    symbol: defaultSignal.symbol,
    name: defaultSignal.name,
    decimals: defaultSignal.decimals,
  } : null);
  const selectedSignal = useMemo(() => currentSignals.find((signal) => signal.mint === activeToken?.mint), [currentSignals, activeToken?.mint]);

  const refreshWallet = useCallback(async () => {
    if (!walletAddress) return;
    const response = await fetch(`/api/wallet?owner=${encodeURIComponent(walletAddress)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load wallet balance.');
    setSummary({ ...data as Omit<WalletSummary, 'owner'>, owner: walletAddress });
    try {
      const balance = await appClient.rpc.getBalance(address(walletAddress)).send();
      setSolBalance({ owner: walletAddress, value: Number(balance.value) / 1_000_000_000 });
    } catch {
      setSolBalance({ owner: walletAddress, value: Number(data.sol) });
    }
  }, [appClient, walletAddress]);

  const refreshSignals = useCallback(async () => {
    if (!walletAddress) return;
    setSignalsLoading(true);
    setSignalsError('');
    try {
      const response = await fetch(`/api/signals?owner=${encodeURIComponent(walletAddress)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load live signals.');
      setSignals(Array.isArray(data.signals) ? data.signals as Signal[] : []);
      setSignalsOwner(walletAddress);
    } catch (error) {
      setSignalsError(errorMessage(error));
    } finally {
      setSignalsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    const timer = window.setTimeout(() => {
      void refreshWallet().catch((error) => setTradeError(errorMessage(error)));
      void refreshSignals();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [walletAddress, refreshWallet, refreshSignals]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/tokens?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await response.json();
        if (!controller.signal.aborted) setSearchResults(response.ok ? (data.tokens as Token[]) : []);
      } catch {
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function selectToken(next: Token) {
    setToken(next);
    setQuery('');
    setSearchResults([]);
    setOrder(null);
    setTradeError('');
  }

  async function createQuote() {
    setTradeError('');
    setSignature('');
    if (!connected || !activeToken) {
      setTradeError('Connect a wallet and choose a token first.');
      return;
    }
    if (direction === 'buy' && (!activeSummary || activeSummary.equityUsd < 0.5)) {
      setTradeError('WELP only opens a position when wallet equity is at least $0.50.');
      return;
    }
    const rawAmount = parseUnits(amount, direction === 'buy' ? 9 : activeToken.decimals);
    if (!rawAmount || BigInt(rawAmount) <= BigInt(0)) {
      setTradeError(`Enter a valid ${direction === 'buy' ? 'SOL' : activeToken.symbol} amount.`);
      return;
    }
    if (direction === 'buy' && BigInt(rawAmount) < BigInt(1_000_000)) {
      setTradeError('The minimum buy is 0.001 SOL.');
      return;
    }
    if (direction === 'buy' && BigInt(rawAmount) > BigInt(20_000_000)) {
      setTradeError('WELP limits each buy to 0.02 SOL.');
      return;
    }
    if (direction === 'buy' && activeSolBalance !== null && Number(amount) + 0.003 > activeSolBalance) {
      setTradeError('Keep at least 0.003 SOL in the wallet for fees.');
      return;
    }
    if (direction === 'buy' && (!selectedSignal || !selectedSignal.eligible)) {
      setTradeError(selectedSignal ? `This signal is not in the entry window: ${selectedSignal.reason.toLowerCase()}.` : 'WELP only buys tokens with a live eligible signal.');
      return;
    }
    setPending('quote');
    setOrder(null);
    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint: direction === 'buy' ? SOL_MINT : activeToken.mint,
          outputMint: direction === 'buy' ? activeToken.mint : SOL_MINT,
          amount: rawAmount,
          taker: walletAddress,
          slippageBps: 150,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Jupiter could not quote this swap.');
      setOrder(data as Order);
      setOrderTime(Date.now());
    } catch (error) {
      setTradeError(errorMessage(error));
    } finally {
      setPending('');
    }
  }

  async function approveWithWallet() {
    if (!connected || !order) return;
    setTradeError('');
    if (Date.now() - orderTime > 45_000) {
      setOrder(null);
      setTradeError('This quote is too old. Request a fresh quote before signing.');
      return;
    }
    if (order.taker !== walletAddress) {
      setOrder(null);
      setTradeError('Wallet changed after the quote. Request a new quote for the connected wallet.');
      return;
    }
    if (direction === 'buy') {
      const impact = order.priceImpact !== undefined ? Number(order.priceImpact) : selectedSignal?.priceImpactPct;
      if (impact === null || impact === undefined || !Number.isFinite(impact) || impact > 2.5) {
        setTradeError('This quote is above WELP’s 2.5% price-impact limit. Request a smaller quote or skip this token.');
        return;
      }
    }
    setPending('sign');
    try {
      const signer = connected.signer;
      if (!signer || !('modifyAndSignTransactions' in signer)) {
        throw new Error('This wallet cannot sign Jupiter swap transactions. Connect Phantom or another Solana transaction-signing wallet.');
      }
      if (!connected.supportedTransactionVersions.has(0)) {
        throw new Error('This wallet cannot sign the transaction version returned by Jupiter. Update Phantom or choose another wallet.');
      }
      const decoded = getTransactionDecoder().decode(decodeBase64(order.transaction));
      const [signed] = await signer.modifyAndSignTransactions([decoded]);
      const signedTransaction = encodeBase64(getTransactionEncoder().encode(signed));
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedTransaction, requestId: order.requestId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Jupiter could not execute the swap.');
      setSignature(String(result.signature));
      setOrder(null);
      await Promise.allSettled([refreshWallet(), refreshSignals()]);
    } catch (error) {
      setTradeError(errorMessage(error));
    } finally {
      setPending('');
    }
  }

  const amountInDecimals = direction === 'buy' ? 9 : activeToken?.decimals ?? 0;
  const amountOutDecimals = direction === 'buy' ? activeToken?.decimals ?? 0 : 9;
  const formToken = direction === 'buy' ? 'SOL' : activeToken?.symbol ?? 'TOKEN';
  const receiveToken = direction === 'buy' ? activeToken?.symbol ?? 'TOKEN' : 'SOL';
  const orderImpact = order ? Number(order.priceImpact ?? selectedSignal?.priceImpactPct ?? 0) : 0;
  const countEligible = currentSignals.filter((signal) => signal.eligible).length;

  return (
    <main className="app-shell">
      <AppSidebar active="dashboard" signalCount={currentSignals.length || '—'} status={signalsLoading ? 'Scanning live pools' : 'Ready when wallet connects'} />

      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb"><span>WORKSPACE</span><span className="crumb-slash">/</span><strong>Overview</strong></div>
          <div className="topbar-right">
            <span className="market-open"><span className="market-pip" /> LIVE MARKET</span>
            <WalletReadyGate client={client} fallback={<button className="connect-button" disabled><LoaderCircle className="spin" size={16} /> Finding wallet…</button>}>
              <WalletConnect />
            </WalletReadyGate>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><Sparkles size={14} /> AUTONOMOUS ANALYSIS · HUMAN-APPROVED EXECUTION</p>
              <h1>Trade with <em>clarity.</em></h1>
              <p className="welcome-copy">WELP scans live Solana pools. You review every quote and approve each swap in your wallet.</p>
            </div>
            <div className="date-pill"><span className="date-dot" /> MAINNET · REAL FUNDS</div>
          </section>

          <div className="mainnet-banner" role="note">
            <ShieldCheck size={19} />
            <div><strong>Mainnet trading is on.</strong><span>Swaps move real assets. Check the amount, recipient and fees in Phantom before every approval.</span></div>
            <a href="https://docs.jup.ag/user-docs/trade/swap" target="_blank" rel="noreferrer" aria-label="Read swap documentation"><CircleHelp size={17} /></a>
          </div>

          <section className="stats-grid" aria-label="Wallet and signal summary">
            <article className="stat-card">
              <div className="stat-top"><span>WALLET EQUITY</span><Wallet size={16} /></div>
              <div className="stat-value">{activeSummary ? `$${activeSummary.equityUsd.toFixed(2)}` : '—'}</div>
              <div className="stat-foot">{activeSummary ? `${(activeSolBalance ?? activeSummary.sol).toFixed(4)} SOL · SOL $${activeSummary.solPrice.toFixed(2)}` : walletAddress ? 'Reading wallet…' : 'Connect your wallet'}</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>ELIGIBLE SIGNALS</span><Activity size={16} /></div>
              <div className="stat-value">{signalsLoading && currentSignals.length === 0 ? <LoaderCircle className="spin" size={25} /> : countEligible.toString().padStart(2, '0')}</div>
              <div className="stat-foot">{currentSignals.length ? `${currentSignals.length} live pools reviewed` : 'Requires a connected wallet'}</div>
            </article>
            <article className="stat-card stat-card-wide">
              <div className="stat-top"><span>ENTRY FILTER</span><ShieldCheck size={16} /></div>
              <div className="stat-value filter-value">80 <span>—</span> 98</div>
              <div className="stat-foot">Rule score window · quotes required before entry</div>
            </article>
          </section>

          <div className="content-grid">
            <section className="panel signals-panel" id="signals">
              <div className="panel-heading">
                <div><p className="eyebrow">MARKET SCANNER</p><h2>Live signals <span className="heading-live" /></h2></div>
                <button className="refresh-button" onClick={() => void refreshSignals()} disabled={!walletAddress || signalsLoading} aria-label="Refresh signals"><RefreshCw className={signalsLoading ? 'spin' : ''} size={16} /><span>Refresh</span></button>
              </div>
              <div className="signal-legend"><span>ASSET</span><span>5M / 1H</span><span>RULE SCORE</span><span>STATUS</span></div>
              {!walletAddress ? (
                <div className="empty-state"><div className="empty-icon"><Wallet size={20} /></div><strong>Connect to start scanning</strong><p>WELP requests a wallet address to build swap quotes. No signature is requested until you choose to trade.</p></div>
              ) : signalsError ? (
                <div className="empty-state error-state"><strong>Could not load signals</strong><p>{signalsError}</p><button className="text-button" onClick={() => void refreshSignals()}>Try again</button></div>
              ) : currentSignals.length === 0 && signalsLoading ? (
                <div className="empty-state"><LoaderCircle className="spin" size={23} /><strong>Scanning live Solana pools</strong><p>Checking chart history and Jupiter quotes.</p></div>
              ) : currentSignals.length === 0 ? (
                <div className="empty-state"><strong>No eligible pools found</strong><p>Try refreshing in a moment. The scanner skips pools without enough chart history or liquidity.</p></div>
              ) : (
                <div className="signal-list">
                  {currentSignals.map((signal, index) => (
                    <article className={`signal-row${signal.eligible ? ' signal-row-ready' : ''}`} key={signal.mint}>
                      <div className="signal-asset"><span className={`token-badge token-badge-${index % 5}`}>{signal.symbol.slice(0, 1).toUpperCase()}</span><div><strong>{signal.symbol}</strong><small>{signal.name || 'Solana token'}</small></div></div>
                      <div className="signal-change"><strong className={signal.changeM5 >= 0 ? 'positive' : 'negative'}>{signal.changeM5 >= 0 ? '+' : ''}{signal.changeM5.toFixed(2)}%</strong><small>{signal.changeH1 >= 0 ? '+' : ''}{signal.changeH1.toFixed(2)}% · 1H</small></div>
                      <ScoreRing score={signal.score} eligible={signal.eligible} />
                      <div className="signal-action"><span className={signal.eligible ? 'status-ready' : 'status-skip'}>{signal.eligible ? 'IN WINDOW' : 'SKIP'}</span><button className="select-signal" aria-label={`${signal.eligible ? 'Trade' : 'Review'} ${signal.symbol} signal`} onClick={() => { selectToken({ mint: signal.mint, symbol: signal.symbol, name: signal.name, decimals: signal.decimals }); document.getElementById('swap')?.scrollIntoView({ behavior: 'smooth' }); }}>{signal.eligible ? 'Trade' : 'Review'}</button></div>
                    </article>
                  ))}
                </div>
              )}
              <div className="panel-foot"><span><span className="foot-pip" /> GeckoTerminal charts · Jupiter quotes</span><span>Rule score is not a probability of profit</span></div>
            </section>

            <section className="panel swap-panel" id="swap">
              <div className="panel-heading swap-heading"><div><p className="eyebrow">USER-APPROVED</p><h2>Swap assets</h2></div><div className="swap-icon"><ArrowDownUp size={17} /></div></div>
              <div className="direction-tabs" role="group" aria-label="Swap direction">
                <button className={direction === 'buy' ? 'direction-tab selected' : 'direction-tab'} onClick={() => { setDirection('buy'); setOrder(null); setTradeError(''); }}><ArrowDownLeft size={15} /> Buy</button>
                <button className={direction === 'sell' ? 'direction-tab selected' : 'direction-tab'} onClick={() => { setDirection('sell'); setOrder(null); setTradeError(''); }}><ArrowUpRight size={15} /> Sell</button>
              </div>
              <div className="swap-box">
                <div className="swap-box-top"><span>You {direction === 'buy' ? 'pay' : 'sell'}</span><span>{direction === 'buy' && activeSolBalance !== null ? `Balance ${activeSolBalance.toFixed(4)} SOL` : 'Mainnet'}</span></div>
                <div className="amount-row"><input type="number" min={direction === 'buy' ? '0.001' : '0'} max={direction === 'buy' ? '0.02' : undefined} step={direction === 'buy' ? '0.001' : 'any'} aria-label={`Amount in ${formToken}`} inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setOrder(null); }} /><span className="asset-pill">{direction === 'buy' ? <span className="sol-symbol">◎</span> : <span className="token-mini">{activeToken?.symbol.slice(0, 1) ?? '?'}</span>}{formToken}</span></div>
                {direction === 'buy' ? <p className="amount-hint">Minimum 0.001 SOL · editable up to 0.02 SOL</p> : null}
              </div>
              <div className="swap-connector"><span><ArrowDownUp size={14} /></span></div>
              <div className="swap-box receive-box">
                <div className="swap-box-top"><span>You receive</span><span>{direction === 'buy' && activeToken?.price ? `Price $${activeToken.price.toPrecision(4)}` : 'Best route'}</span></div>
                <div className="amount-row"><input aria-label={`Token to ${direction === 'buy' ? 'buy' : 'sell'}`} value={activeToken ? `${activeToken.symbol} · ${shortAddress(activeToken.mint)}` : 'Search for a token'} readOnly /><span className="asset-pill asset-pill-selected"><span className="token-mini">{direction === 'buy' ? activeToken?.symbol.slice(0, 1) ?? '?' : '◎'}</span>{receiveToken}</span></div>
              </div>
              <div className="token-search-wrap">
                <label className="token-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, symbol or mint" aria-label="Search for a token" /><span>{searching ? <LoaderCircle className="spin" size={15} /> : 'JUPITER'}</span></label>
                {query.trim().length >= 2 && searchResults.length > 0 ? <div className="search-results">{searchResults.map((result) => <button key={result.mint} className="search-result" onClick={() => selectToken(result)}><span className="token-badge token-badge-search">{result.symbol.slice(0, 1)}</span><span><strong>{result.symbol}</strong><small>{result.name} · {shortAddress(result.mint)}</small></span><CirclePlus size={17} /></button>)}</div> : null}
              </div>
              {activeToken ? <div className="token-meta"><span>Selected token</span><span title={activeToken.mint}>{activeToken.name} · {shortAddress(activeToken.mint)}</span></div> : null}
              {direction === 'buy' && selectedSignal && !selectedSignal.eligible ? <div className="trade-warning"><CircleHelp size={15} /><span>Signal outside entry range: {selectedSignal.reason}.</span></div> : null}
              {order ? (
                <div className="quote-summary">
                  <div className="quote-title"><span><ShieldCheck size={15} /> Review quote</span><small>Fresh for 45 seconds</small></div>
                  <div className="quote-line"><span>You pay</span><strong>{formatUnits(order.inAmount, amountInDecimals)} {formToken}</strong></div>
                  <div className="quote-line"><span>Estimated receive</span><strong>{formatUnits(order.outAmount, amountOutDecimals)} {receiveToken}</strong></div>
                  <div className="quote-line"><span>Price impact</span><strong>{orderImpact.toFixed(3)}%</strong></div>
                  <div className="quote-line"><span>Max slippage</span><strong>{((order.slippageBps ?? 150) / 100).toFixed(2)}%</strong></div>
                  {typeof order.feeBps === 'number' ? <div className="quote-line"><span>Jupiter route fee</span><strong>{(order.feeBps / 100).toFixed(2)}%</strong></div> : null}
                  <p className="quote-note">Your wallet will show the exact transaction. Only approve if the details match this quote.</p>
                </div>
              ) : null}
              {tradeError ? <div className="inline-error" role="alert">{tradeError}</div> : null}
              {signature ? <div className="success-box"><ShieldCheck size={17} /><span>Swap submitted successfully.</span><a href={`https://explorer.solana.com/tx/${signature}`} target="_blank" rel="noreferrer">View <ExternalLink size={13} /></a></div> : null}
              {order ? (
                <button className="primary-button" onClick={() => void approveWithWallet()} disabled={pending !== '' || !connected}>
                  {pending === 'sign' ? <><LoaderCircle className="spin" size={16} /> Waiting for wallet…</> : <><LockKeyhole size={16} /> Review & sign in Phantom</>}
                </button>
              ) : (
                <button className="primary-button" onClick={() => void createQuote()} disabled={!connected || pending !== '' || !activeToken}>
                  {pending === 'quote' ? <><LoaderCircle className="spin" size={16} /> Getting Jupiter quote…</> : <><ArrowDownUp size={16} /> Get quote</>}
                </button>
              )}
              <p className="swap-caption"><LockKeyhole size={13} /> WELP cannot access your private key or sign without your approval.</p>
            </section>
          </div>

          <section className="safety-panel" id="safety">
            <div className="safety-heading"><span className="safety-icon"><ShieldCheck size={18} /></span><div><p className="eyebrow">BUILT-IN GUARDRAILS</p><h2>Rules before risk</h2></div></div>
            <div className="safety-rule"><strong>80–98</strong><span>Entry score range<br /><small>Outside this band, WELP will not open a signal-based buy.</small></span></div>
            <div className="safety-rule"><strong>0.001 SOL</strong><span>Minimum buy<br /><small>Every entry keeps at least 0.003 SOL for fees.</small></span></div>
            <div className="safety-rule"><strong>$0.50</strong><span>Minimum wallet equity<br /><small>Solana and stablecoin balance must meet the floor.</small></span></div>
            <div className="safety-rule safety-rule-last"><strong>Phantom</strong><span>You approve every swap<br /><small>No auto-trading or private-key access in this app.</small></span></div>
          </section>
          <footer className="footer"><span>WELP UP · Solana mainnet</span><span>Trading is risky. A token can lose all value.</span><a href="https://github.com/Alitiora-Initiative/WELP-UP" target="_blank" rel="noreferrer">Source <ExternalLink size={12} /></a></footer>
        </div>
      </section>
    </main>
  );
}
