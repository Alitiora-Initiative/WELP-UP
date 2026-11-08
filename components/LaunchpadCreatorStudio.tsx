'use client';

import { useState } from 'react';
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react';
import { getTransactionDecoder, getTransactionEncoder } from '@solana/kit';
import { ExternalLink, LoaderCircle, Rocket, ShieldCheck } from 'lucide-react';
import { client } from '@/components/Providers';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';
import { brandLaunchName, brandLaunchSymbol } from '@/lib/launch-branding';

function decodeBase64(value: string) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function encodeBase64(value: ArrayLike<number>) {
  let binary = '';
  for (let index = 0; index < value.length; index += 1) binary += String.fromCharCode(value[index]);
  return window.btoa(binary);
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Launch failed. Try again.';
}

type PreparedLaunch = {
  transaction: string;
  mint: string;
  name: string;
  symbol: string;
  metadataUri: string;
};
type LaunchResult = { mint: string; name: string; symbol: string; signature: string };

export function LaunchpadCreatorStudio() {
  const connected = useConnectedWallet(client);
  const owner = connected?.account.address ?? '';
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [initialBuy, setInitialBuy] = useState('0.01');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LaunchResult | null>(null);

  const brandedName = brandLaunchName(name);
  const brandedSymbol = brandLaunchSymbol(symbol);
  const canLaunch = Boolean(owner && brandedName && brandedSymbol && !pending);

  async function launch() {
    setError('');
    setResult(null);
    if (!connected || !owner) { setError('Connect a Solana wallet before launching.'); return; }
    if (!brandedName || !brandedSymbol) { setError('Enter a token name and ticker. WELP UP branding is added automatically.'); return; }
    const buy = Number(initialBuy);
    if (!Number.isFinite(buy) || buy < 0.001 || buy > 1) { setError('Initial buy must be between 0.001 and 1 SOL.'); return; }
    if (!connected.supportedTransactionVersions.has(0)) { setError('This wallet cannot sign versioned launch transactions. Update Phantom or choose another wallet.'); return; }
    const signer = connected.signer;
    if (!signer || !('modifyAndSignTransactions' in signer)) { setError('This wallet cannot sign launch transactions.'); return; }
    setPending(true);
    try {
      const prepareResponse = await fetch('/api/launch/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, name, symbol, description, initialBuySol: buy }),
      });
      const prepared = await prepareResponse.json() as PreparedLaunch & { error?: string };
      if (!prepareResponse.ok || !prepared.transaction || !prepared.mint) throw new Error(prepared.error || 'Could not prepare the launch transaction.');
      const decoded = getTransactionDecoder().decode(decodeBase64(prepared.transaction));
      const [signed] = await signer.modifyAndSignTransactions([decoded]);
      const signedTransaction = encodeBase64(getTransactionEncoder().encode(signed));
      const submitResponse = await fetch('/api/launch/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedTransaction }),
      });
      const submitted = await submitResponse.json() as { signature?: string; error?: string };
      if (!submitResponse.ok || !submitted.signature) throw new Error(submitted.error || 'Solana did not accept the launch transaction.');
      setResult({ mint: prepared.mint, name: prepared.name, symbol: prepared.symbol, signature: submitted.signature });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="lp-studio glass-panel" aria-labelledby="lp-studio-title">
      <div className="lp-studio-heading">
        <div>
          <p className="lp-kicker">LIVE PUMP.FUN BONDING CURVE</p>
          <h2 id="lp-studio-title">Launch a coin.</h2>
          <p className="lp-muted">Creates a real pump.fun bonding-curve token through PumpPortal. Your wallet signs the creation transaction; the mint address is the coin contract address (CA).</p>
        </div>
        <span className="lp-lock-state">WALLET SIGNED</span>
      </div>
      <div className="lp-form-grid">
        <label className="lp-field"><span>Token name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="Moon Rocket" autoComplete="off" /><small>WELP UP branding is appended automatically.</small></label>
        <label className="lp-field"><span>Ticker</span><input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} maxLength={10} placeholder="MOON" autoComplete="off" /><small>WUP suffix is appended automatically.</small></label>
        <label className="lp-field"><span>Initial dev buy (SOL)</span><input inputMode="decimal" value={initialBuy} onChange={(event) => setInitialBuy(event.target.value)} placeholder="0.01" /><small>0.001–1 SOL. This is spent from your wallet in the same transaction.</small></label>
        <label className="lp-field"><span>Description</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Optional public description" autoComplete="off" /></label>
      </div>
      <div className="lp-preview glass-card" aria-live="polite">
        <div className="lp-preview-top"><div><span className="lp-kicker">BRANDED METADATA</span><strong>{brandedName || 'Token name'}</strong></div><span className="lp-preview-badge">{brandedSymbol || 'TICKER'}</span></div>
        <p className="lp-preview-instruction">Coin name will end with <strong>WELP UP</strong> and ticker with <strong>WUP</strong>. Metadata is served by welpup.fun and the image is the WELP UP logo.</p>
      </div>
      <div className="lp-studio-footer">
        <WalletConnectionControl />
        <button type="button" className="primary-action" onClick={() => void launch()} disabled={!canLaunch}>
          {pending ? <LoaderCircle className="spin" size={15} /> : <Rocket size={15} />} {pending ? 'Preparing and launching…' : 'Launch coin'}
        </button>
        {error ? <p className="lp-validation-message" role="alert">{error}</p> : null}
        {result ? (
          <div className="lp-result">
            <p className="lp-warning" role="status"><ShieldCheck size={14} /> Launch submitted: <strong>{result.name} ({result.symbol})</strong></p>
            <p className="lp-raw-note">CA / mint: <code>{result.mint}</code></p>
            <div className="lp-result-links">
              <a href={'https://pump.fun/coin/' + result.mint} target="_blank" rel="noreferrer">Pump.fun <ExternalLink size={12} /></a>
              <a href={'https://solscan.io/token/' + result.mint} target="_blank" rel="noreferrer">Solscan <ExternalLink size={12} /></a>
              <a href={'https://solscan.io/tx/' + result.signature} target="_blank" rel="noreferrer">Transaction <ExternalLink size={12} /></a>
            </div>
          </div>
        ) : null}
        <p className="lp-raw-note">This launch uses the public pump.fun bonding curve through PumpPortal. It is not the undeployed WELP custom Anchor launch program; no WELP treasury fee is added by this transaction.</p>
      </div>
    </section>
  );
}
