'use client';

import { useEffect, useState } from 'react';
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react';
import {
  address,
  appendTransactionMessageInstruction,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  getTransactionDecoder,
  getTransactionEncoder,
  pipe,
  partiallySignTransactionMessageWithSigners,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/kit';import { ExternalLink, LoaderCircle, Rocket, ShieldCheck, ServerCog } from 'lucide-react';
import { client } from '@/components/Providers';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';
import { brandLaunchName, brandLaunchSymbol, launchMetadataUri } from '@/lib/launch-branding';
import {
  buildLaunchTokenInstruction,
  deriveTreasuryAddresses,
  METADATA_PROGRAM_ID,
  LAUNCH_SERVICE_FEE_LAMPORTS,
  MAX_TOKEN_DECIMALS,
  SPL_TOKEN_PROGRAM_ID,
  validateLaunchInputs,
} from '@/lib/launch-program';

/** Associated Token Program on mainnet, used for the Token-2022 ATA derivation. */
const ASSOCIATED_TOKEN_PROGRAM_ID = address('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
/** Compute budget program. */
const COMPUTE_BUDGET_PROGRAM_ID = address('ComputeBudget111111111111111111111111111111');

function computeUnitLimitInstruction(units: number) {
  // Instruction with u32 limit: 3-byte tag 0x02 + u32 le.
  const data = new Uint8Array(5);
  data[0] = 0x02;
  new DataView(data.buffer).setUint32(1, units, true);
  return {
    programAddress: COMPUTE_BUDGET_PROGRAM_ID,
    accounts: [],
    data,
  };
}

function computeUnitPriceInstruction(microLamports: number) {
  // Instruction tag 0x03 + u64 le microLamports.
  const data = new Uint8Array(9);
  data[0] = 0x03;
  const view = new DataView(data.buffer);
  view.setUint32(1, microLamports, true);
  return {
    programAddress: COMPUTE_BUDGET_PROGRAM_ID,
    accounts: [],
    data,
  };
}

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
type LaunchResult = { mint: string; name: string; symbol: string; signature: string; rail: 'pump' | 'welp' };
type ProgramStatus = { deployed: boolean; executable?: boolean; launchEnabled?: boolean; detail?: string; owner: string | null; checkedAt: string };

export function LaunchpadCreatorStudio() {
  const connected = useConnectedWallet(client);
  const owner = connected?.account.address ?? '';
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [telegram, setTelegram] = useState('');
  const [initialBuy, setInitialBuy] = useState('0.01');
  const [supply, setSupply] = useState('');
  const [decimals, setDecimals] = useState(6);
  const [rail, setRail] = useState<'pump' | 'welp'>('pump');
  const [programStatus, setProgramStatus] = useState<ProgramStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LaunchResult | null>(null);

  const brandedName = brandLaunchName(name);
  const brandedSymbol = brandLaunchSymbol(symbol);
  const welpRailReady = programStatus?.deployed === true;
  const canLaunchPump = Boolean(owner && brandedName && brandedSymbol && !pending);
  const canLaunchWelp = Boolean(
    owner &&
      brandedName &&
      brandedSymbol &&
      supply &&
      welpRailReady &&
      !pending &&
      validateLaunchInputs(
        { wholeTokenSupply: supply, decimals, name: brandedName, symbol: brandedSymbol, uri: 'https://welpup.fun/check' },
      ).ok,
  );
  const canLaunch = rail === 'pump' ? canLaunchPump : canLaunchWelp;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/program-status', { cache: 'no-store' })
      .then((response) => response.json() as Promise<ProgramStatus>)
      .then((status) => { if (!cancelled) setProgramStatus(status); })
      .catch(() => { if (!cancelled) setProgramStatus({ deployed: false, owner: null, checkedAt: new Date().toISOString() }); });
    return () => { cancelled = true; };
  }, []);

  function assertSigner() {
    type AnySigner = NonNullable<typeof connected>['signer'];
    type WithModify = Extract<AnySigner & object, { modifyAndSignTransactions: unknown }>;
    if (!connected || !connected.signer) {
      throw new Error('Connect a Solana wallet that can sign before launching.');
    }
    if (!('modifyAndSignTransactions' in connected.signer)) {
      throw new Error('This wallet cannot sign launch transactions. Update your wallet app.');
    }
    if (!connected.supportedTransactionVersions.has(0)) {
      throw new Error('This wallet cannot sign versioned launch transactions. Update your wallet app.');
    }
    const signer = connected.signer as WithModify;
    return { wallet: connected, signer };
  }

  async function submitSigned(signedTransaction: string): Promise<string> {
    const submitResponse = await fetch('/api/launch/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedTransaction }),
    });
    const submitted = await submitResponse.json() as { signature?: string; error?: string };
    if (!submitResponse.ok || !submitted.signature) throw new Error(submitted.error || 'Solana did not accept the launch transaction.');
    return submitted.signature;
  }

  async function prepareAndSubmitPump(): Promise<void> {
    const { wallet, signer } = assertSigner();
    const buyer = wallet.account.address;
    const buy = Number(initialBuy);
    if (!Number.isFinite(buy) || buy < 0.001 || buy > 1) throw new Error('Initial buy must be between 0.001 and 1 SOL.');
    const prepareResponse = await fetch('/api/launch/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: buyer, name, symbol, description, website, twitter, telegram, initialBuySol: buy }),
    });
    const prepared = await prepareResponse.json() as PreparedLaunch & { error?: string };
    if (!prepareResponse.ok || !prepared.transaction || !prepared.mint) {
      throw new Error(prepared.error || 'Could not prepare the launch transaction.');
    }
    const decoded = getTransactionDecoder().decode(decodeBase64(prepared.transaction));
    // The wire bytes already carry the lifetime blockhash; the signer accepts
    // both bare and lifetime-typed transactions via modifyAndSignTransactions.
    const [signed] = await signer.modifyAndSignTransactions([decoded as never]);
    const signature = await submitSigned(encodeBase64(getTransactionEncoder().encode(signed)));
    setResult({ mint: prepared.mint, name: prepared.name, symbol: prepared.symbol, signature, rail: 'pump' });
  }

  async function prepareAndSubmitWelp(): Promise<void> {
    const { wallet, signer } = assertSigner();
    const creator = address(wallet.account.address);
    if (!welpRailReady) throw new Error('The WELP custom rail is not live on mainnet yet. Wait for the deployment to finish.');
    const mintSigner = await generateKeyPairSigner();
    const addressEncoder = getAddressEncoder();
    const ownerBytes = addressEncoder.encode(creator);
    const tokenProgramBytes = addressEncoder.encode(SPL_TOKEN_PROGRAM_ID);
    const mintBytes = addressEncoder.encode(mintSigner.address);
    const [{ treasury, treasuryVault }, [creatorTokenAccount], [metadata]] = await Promise.all([
      deriveTreasuryAddresses(),
      getProgramDerivedAddress({
        programAddress: ASSOCIATED_TOKEN_PROGRAM_ID,
        seeds: [ownerBytes, tokenProgramBytes, mintBytes],
      }),
      getProgramDerivedAddress({
        programAddress: METADATA_PROGRAM_ID,
        seeds: ['metadata', addressEncoder.encode(METADATA_PROGRAM_ID), mintBytes],
      }),
    ]);
    const uri = launchMetadataUri(window.location.origin, {
      mint: mintSigner.address,
      name: brandedName,
      symbol: brandedSymbol,
      description,
      website, twitter, telegram,
    });
    const params = { wholeTokenSupply: supply.trim(), decimals, name: brandedName, symbol: brandedSymbol, uri };
    const checked = validateLaunchInputs(params);
    if (!checked.ok) throw new Error(checked.error);
    const launchInstruction = buildLaunchTokenInstruction(
      { creator, mint: mintSigner.address, creatorTokenAccount, metadata, treasury, treasuryVault },
      params,
    );
    const { value: blockhash } = await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (current) => setTransactionMessageFeePayerSigner(signer as never, current),
      (current) => setTransactionMessageLifetimeUsingBlockhash(
        { blockhash: blockhash.blockhash, lastValidBlockHeight: blockhash.lastValidBlockHeight },
        current,
      ),
      (current) => appendTransactionMessageInstruction(computeUnitLimitInstruction(400_000), current),
      (current) => appendTransactionMessageInstruction(computeUnitPriceInstruction(20_000), current),
      (current) => appendTransactionMessageInstruction(
        {
          programAddress: launchInstruction.programAddress,
          accounts: launchInstruction.accounts.map((entry) => ({
            address: entry.address,
            role: entry.role,
          })),
          data: launchInstruction.data,
        },
        current,
      ),
    );
    const signed = await partiallySignTransactionMessageWithSigners(message);
    const signature = await submitSigned(encodeBase64(getTransactionEncoder().encode(signed)));
    setResult({ mint: mintSigner.address, name: brandedName, symbol: brandedSymbol, signature, rail: 'welp' });
  }

  async function launch() {
    setError('');
    setResult(null);
    if (!connected || !owner) { setError('Connect a Solana wallet before launching.'); return; }
    if (!brandedName || !brandedSymbol) { setError('Enter a token name and ticker. WELP UP branding is added automatically.'); return; }
    setPending(true);
    try {
      if (rail === 'pump') {
        await prepareAndSubmitPump();
      } else {
        await prepareAndSubmitWelp();
      }
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
          <p className="lp-kicker">LIVE LAUNCH RAILS</p>
          <h2 id="lp-studio-title">Launch a coin.</h2>
          <p className="lp-muted">
            Two rails: the live pump.fun bonding curve, or the WELP program where you
            choose your own supply and precision. Your wallet signs; welpup.fun only
            serializes, broadcasts and charges the fixed on-chain service fee.
          </p>
        </div>
        <span className="lp-lock-state">WALLET SIGNED</span>
      </div>

      <div className="lp-rail-toggle" role="radiogroup" aria-label="Launch rail">
        <button
          type="button"
          role="radio"
          aria-checked={rail === 'pump'}
          className={rail === 'pump' ? 'lp-rail selected' : 'lp-rail'}
          onClick={() => { setRail('pump'); setError(''); }}
          disabled={pending}
        >
          <strong>Pump.fun curve</strong>
          <small>Bonding curve with an initial SOL buy. Live now.</small>
          <em>Supply is fixed by pump.fun: 1B tokens, 6 decimals.</em>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={rail === 'welp'}
          className={rail === 'welp' ? 'lp-rail selected' : 'lp-rail'}
          onClick={() => { setRail('welp'); setError(''); }}
          disabled={pending}
        >
          <strong>WELP custom program</strong>
          <small>Set your own supply 0–1B and 0–9 decimals.</small>
          <em>
            {programStatus === null
              ? 'Checking mainnet deployment…'
              : welpRailReady
                ? 'Executable program detected; operator launch gate enabled. This is not an independent audit.'
                : 'On-chain deployment pending.'}
          </em>
          <span className={'lp-rail-badge' + (welpRailReady ? ' ready' : '')}>
            {programStatus === null ? '…' : welpRailReady ? 'LIVE' : 'PENDING DEPLOY'}
          </span>
        </button>
      </div>

      <div className="lp-form-grid">
        <label className="lp-field"><span>Token name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="Moon Rocket" autoComplete="off" /><small>WELP UP branding is appended automatically.</small></label>
        <label className="lp-field"><span>Ticker</span><input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} maxLength={10} placeholder="MOON" autoComplete="off" /><small>WUP suffix is appended automatically.</small></label>
        {rail === 'pump' ? (
          <label className="lp-field"><span>Initial dev buy (SOL)</span><input inputMode="decimal" value={initialBuy} onChange={(event) => setInitialBuy(event.target.value)} placeholder="0.01" /><small>0.001–1 SOL. Spent from your wallet in the same transaction.</small></label>
        ) : (
          <>
            <label className="lp-field"><span>Whole-token supply</span><input inputMode="numeric" value={supply} onChange={(event) => { setSupply(event.target.value.replace(/[^\d]/g, '')); }} placeholder="1000000000" autoComplete="off" /><small>0 to 1,000,000,000 whole tokens. You receive the full supply in your wallet.</small></label>
            <label className="lp-field"><span>Mint precision (decimals)</span><select value={decimals} onChange={(event) => setDecimals(Number(event.target.value))}>
              {Array.from({ length: MAX_TOKEN_DECIMALS + 1 }, (_value, index) => (
                <option key={index} value={index}>{index}</option>
              ))}
            </select><small>0 to 9 decimals, enforced on-chain by the WELP program.</small></label>
          </>
        )}
        <label className="lp-field"><span>Description</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Optional public description" autoComplete="off" /></label>
        <label className="lp-field"><span>Project website (HTTPS)</span><input value={website} onChange={(event) => setWebsite(event.target.value)} maxLength={200} placeholder="https://example.com" autoComplete="url" /></label>
        <label className="lp-field"><span>X profile (HTTPS)</span><input value={twitter} onChange={(event) => setTwitter(event.target.value)} maxLength={200} placeholder="https://x.com/project" autoComplete="url" /></label>
        <label className="lp-field"><span>Telegram (HTTPS)</span><input value={telegram} onChange={(event) => setTelegram(event.target.value)} maxLength={200} placeholder="https://t.me/project" autoComplete="url" /></label>
      </div>
      {rail === 'welp' ? (
        <p className="lp-fee-note">
          <ServerCog size={14} /> The WELP service fee is {Number(LAUNCH_SERVICE_FEE_LAMPORTS) / 1e9} SOL and is paid
          straight to the on-chain treasury vault PDA inside your launch transaction — the
          website cannot redirect it, and the program records it for the epoch split.
        </p>
      ) : null}

      <div className="lp-preview glass-card" aria-live="polite">
        <div className="lp-preview-top"><div><span className="lp-kicker">BRANDED METADATA</span><strong>{brandedName || 'Token name'}</strong></div><span className="lp-preview-badge">{brandedSymbol || 'TICKER'}</span></div>
        <p className="lp-preview-instruction">Coin name will end with <strong>WELP UP</strong> and ticker with <strong>WUP</strong>. Metadata is served by welpup.fun and the image is the WELP UP logo.</p>
      </div>

      <div className="lp-studio-footer">
        <WalletConnectionControl />
        <button type="button" className="primary-action" onClick={() => void launch()} disabled={!canLaunch}>
          {pending ? <LoaderCircle className="spin" size={15} /> : <Rocket size={15} />} {pending ? 'Preparing and launching…' : rail === 'pump' ? 'Launch coin' : 'Launch with WELP program'}
        </button>
        {error ? <p className="lp-validation-message" role="alert">{error}</p> : null}
        {result ? (
          <div className="lp-result">
            <p className="lp-warning" role="status"><ShieldCheck size={14} /> Launch submitted: <strong>{result.name} ({result.symbol})</strong></p>
            <p className="lp-raw-note">CA / mint: <code>{result.mint}</code></p>
            <div className="lp-result-links">
              {result.rail === 'pump' ? (
                <a href={'https://pump.fun/coin/' + result.mint} target="_blank" rel="noreferrer">Pump.fun <ExternalLink size={12} /></a>
              ) : null}
              <a href={'https://solscan.io/token/' + result.mint} target="_blank" rel="noreferrer">Solscan <ExternalLink size={12} /></a>
              <a href={'https://solscan.io/tx/' + result.signature} target="_blank" rel="noreferrer">Transaction <ExternalLink size={12} /></a>
            </div>
          </div>
        ) : null}
        {rail === 'pump' ? (
          <p className="lp-raw-note">This launch uses the public pump.fun bonding curve through PumpPortal. No WELP service fee is added by this transaction.</p>
        ) : (
          <p className="lp-raw-note">The WELP custom rail creates a classic SPL mint with your exact supply and precision plus Metaplex metadata for instant wallet rendering, pays the fixed service fee into the canonical treasury vault PDA and never grants the website a key.</p>
        )}
      </div>
    </section>
  );
}
