'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { address } from '@solana/kit';
import { useClient } from '@solana/react';
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react';
import { AlertTriangle, Check, Copy, ExternalLink, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, Vault } from 'lucide-react';
import { ClientProvider } from '@solana/react';
import { AppSidebar } from '@/components/AppSidebar';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';
import { devnetVaultClient, type DevnetVaultClient } from '@/lib/devnet-client';
import {
  createVaultInstruction,
  decodeVaultAccount,
  deriveVaultAddress,
  formatLamports,
  parseSolToLamports,
  VAULT_ACCOUNT_SIZE,
  type VaultInstructionName,
  type VaultState,
} from '@/lib/vault-client';

const configuredProgramId = process.env.NEXT_PUBLIC_WELP_VAULT_PROGRAM_ID?.trim() ?? '';
const DEVNET_EXPLORER = 'https://explorer.solana.com';
const MIN_POSITION_LAMPORTS = 1_000_000n;
const MAX_POSITION_LAMPORTS = 20_000_000n;

type ProgramStatus = 'checking' | 'ready' | 'missing' | 'unconfigured';

function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/reject|cancel/i.test(message)) return 'The wallet request was cancelled.';
  if (/insufficient funds/i.test(message)) return 'The wallet needs more SOL for this transaction and its network fee.';
  return message || 'Could not complete that vault action.';
}

function explorerAddress(value: string) {
  return `${DEVNET_EXPLORER}/address/${encodeURIComponent(value)}?cluster=devnet`;
}

function explorerTransaction(value: string) {
  return `${DEVNET_EXPLORER}/tx/${encodeURIComponent(value)}?cluster=devnet`;
}

function shorten(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

function DevnetVaultWorkspace() {
  const appClient = useClient<DevnetVaultClient>();
  const connected = useConnectedWallet(appClient);
  const ownerAddress = connected?.account.address ?? '';
  const programAddress = useMemo(() => {
    if (!configuredProgramId) return null;
    try {
      return address(configuredProgramId);
    } catch {
      return null;
    }
  }, []);

  const [programStatus, setProgramStatus] = useState<ProgramStatus>(programAddress ? 'checking' : 'unconfigured');
  const [programError, setProgramError] = useState('');
  const [vaultAddress, setVaultAddress] = useState('');
  const [vaultState, setVaultState] = useState<VaultState | null>(null);
  const [vaultBalance, setVaultBalance] = useState<bigint | null>(null);
  const [rentReserve, setRentReserve] = useState<bigint>(0n);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSummary, setActionSummary] = useState('');
  const [lastSignature, setLastSignature] = useState('');
  const [copied, setCopied] = useState(false);
  const [totalCap, setTotalCap] = useState('0.05');
  const [perPositionMax, setPerPositionMax] = useState('0.02');
  const [fundAmount, setFundAmount] = useState('0.01');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const refreshVault = useCallback(async () => {
    if (!programAddress || !ownerAddress) return;
    setLoading(true);
    setActionError('');
    try {
      const deployment = await appClient.rpc.getAccountInfo(programAddress, { encoding: 'base64', commitment: 'confirmed' }).send();
      if (!deployment.value?.executable) {
        setProgramStatus('missing');
        setProgramError('No executable WELP vault program was found at this address on Devnet. The app will not derive a fundable PDA from it.');
        setVaultAddress('');
        setVaultState(null);
        setVaultBalance(null);
        setWalletBalance(null);
        return;
      }

      setProgramStatus('ready');
      setProgramError('');
      const derivedAddress = await deriveVaultAddress(programAddress, address(ownerAddress));
      setVaultAddress(derivedAddress);

      const [vaultAccount, balance, ownerBalance, rent] = await Promise.all([
        appClient.rpc.getAccountInfo(derivedAddress, { encoding: 'base64', commitment: 'confirmed' }).send(),
        appClient.rpc.getBalance(derivedAddress, { commitment: 'confirmed' }).send(),
        appClient.rpc.getBalance(address(ownerAddress), { commitment: 'confirmed' }).send(),
        appClient.rpc.getMinimumBalanceForRentExemption(BigInt(VAULT_ACCOUNT_SIZE), { commitment: 'confirmed' }).send(),
      ]);
      setVaultBalance(BigInt(balance.value));
      setWalletBalance(BigInt(ownerBalance.value));
      setRentReserve(BigInt(rent));

      if (!vaultAccount.value) {
        setVaultState(null);
        setWithdrawAmount('');
        return;
      }
      if (vaultAccount.value.owner !== programAddress) throw new Error('The derived address is occupied by an account owned by a different program.');
      const [encodedData] = vaultAccount.value.data;
      const parsed = await decodeVaultAccount(encodedData, address(ownerAddress));
      setVaultState(parsed);
    } catch (error) {
      setActionError(readableError(error));
    } finally {
      setLoading(false);
    }
  }, [appClient, ownerAddress, programAddress]);

  useEffect(() => {
    if (!programAddress || !ownerAddress) return;
    const timer = window.setTimeout(() => void refreshVault(), 0);
    return () => window.clearTimeout(timer);
  }, [ownerAddress, programAddress, refreshVault]);

  const vaultAvailable = vaultBalance !== null && rentReserve !== null
    ? vaultBalance > rentReserve ? vaultBalance - rentReserve : 0n
    : 0n;
  const remainingAllocation = vaultState && vaultAvailable < vaultState.totalCapLamports
    ? vaultState.totalCapLamports - vaultAvailable
    : 0n;
  const parsedTotalCap = parseSolToLamports(totalCap);
  const parsedPositionMax = parseSolToLamports(perPositionMax);
  const parsedFundAmount = parseSolToLamports(fundAmount);
  const parsedWithdrawAmount = parseSolToLamports(withdrawAmount);
  const validInitialize = parsedTotalCap !== null
    && parsedPositionMax !== null
    && parsedTotalCap >= MIN_POSITION_LAMPORTS
    && parsedPositionMax >= MIN_POSITION_LAMPORTS
    && parsedPositionMax <= MAX_POSITION_LAMPORTS
    && parsedPositionMax <= parsedTotalCap;
  const validFund = parsedFundAmount !== null
    && parsedFundAmount > 0n
    && parsedFundAmount <= remainingAllocation
    && (walletBalance === null || parsedFundAmount <= walletBalance);
  const availableToWithdraw = vaultBalance !== null && vaultBalance > rentReserve ? vaultBalance - rentReserve : 0n;
  const validWithdraw = parsedWithdrawAmount !== null && parsedWithdrawAmount > 0n && parsedWithdrawAmount <= availableToWithdraw;

  async function submitAction(
    name: VaultInstructionName,
    summary: string,
    args: { amountLamports?: bigint; totalCapLamports?: bigint; perPositionMaxLamports?: bigint } = {},
  ) {
    if (!programAddress || !ownerAddress || !connected?.signer) return;
    setBusyAction(name);
    setActionError('');
    setLastSignature('');
    setActionSummary(`${summary} · Solana Mainnet-Beta · wallet fees shown in Phantom`);
    try {
      const targetVault = vaultAddress
        ? address(vaultAddress)
        : await deriveVaultAddress(programAddress, address(ownerAddress));
      const instruction = await createVaultInstruction(programAddress, address(ownerAddress), targetVault, name, args);
      const result = await appClient.sendTransaction([instruction]);
      setLastSignature(String(result.context.signature));
      setActionSummary(`${summary} submitted to Solana Mainnet-Beta.`);
      await refreshVault();
    } catch (error) {
      setActionSummary('');
      setActionError(readableError(error));
    } finally {
      setBusyAction('');
    }
  }

  async function copyAddress() {
    if (!vaultAddress) return;
    try {
      await navigator.clipboard.writeText(vaultAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setActionError('Could not copy the vault address. Select and copy it from the address panel.');
    }
  }

  return (
    <main className="app-shell">
      <AppSidebar active="vault" network="devnet" status={programStatus === 'ready' ? 'Vault · trading disabled' : 'Vault setup'} />
      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb"><span>DEVNET</span><span className="crumb-slash">/</span><strong>Vault setup</strong></div>
          <div className="topbar-right"><span className="market-open"><span className="market-pip" /> SOL ONLY</span><WalletConnectionControl network="devnet" /></div>
        </header>

        <div className="page-content vault-page">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><Vault size={14} /> Vault · OWNER CONTROL</p>
              <h1>Your vault, <em>your keys.</em></h1>
              <p className="welcome-copy">Connect your wallet to inspect or create your on-chain vault PDA, deposit SOL, configure pause authority, and withdraw.</p>
            </div>
            <div className="date-pill"><span className="date-dot" /> DEVNET ONLY</div>
          </section>

          <div className="vault-safety-banner" role="note">
            <AlertTriangle size={18} />
            <div><strong>Testing and recovery only. Autonomous trading is not active.</strong><span>The on-chain swap instruction remains disabled, token withdrawals are not implemented, and this program has not received an independent security audit. Use Devnet SOL only.</span></div>
          </div>

          {!programAddress ? (
            <section className="vault-setup-state panel">
              <div className="vault-setup-icon"><LockKeyhole size={20} /></div>
              <div><p className="eyebrow">DEPLOYMENT CONFIGURATION NEEDED</p><h2>No fundable vault address yet</h2>
                <p>{configuredProgramId ? 'NEXT_PUBLIC_WELP_VAULT_PROGRAM_ID is not a valid Solana address. ' : 'The repository’s program ID is an undeployed placeholder. '}Set <code>NEXT_PUBLIC_WELP_VAULT_PROGRAM_ID</code> only after the matching source is built and deployed to Devnet. Until then, WELP will not derive or display a vault address.</p>
              </div>
            </section>
          ) : programStatus === 'missing' ? (
            <section className="vault-setup-state panel">
              <div className="vault-setup-icon"><AlertTriangle size={20} /></div>
              <div><p className="eyebrow">PROGRAM NOT VERIFIED ON DEVNET</p><h2>Vault actions are locked</h2><p>{programError || 'The configured program is not executable on Devnet.'} Confirm the deployed address and cluster before trying again.</p>
                {ownerAddress ? <button className="vault-secondary-button" type="button" onClick={() => void refreshVault()} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Check again</button> : null}
              </div>
            </section>
          ) : null}

          {!ownerAddress ? (
            <section className="vault-connect-card panel">
              <div className="vault-setup-icon"><ShieldCheck size={20} /></div>
              <div><p className="eyebrow">CONNECT TO DEVNET</p><h2>Use your public wallet address</h2><p>The wallet connect button above connects to Devnet for this page. WELP never asks for a seed phrase or private key.</p></div>
            </section>
          ) : programStatus === 'ready' ? (
            loading && !vaultAddress ? (
              <section className="panel vault-loading"><LoaderCircle size={20} className="spin" /><span>Checking the deployed program and your vault…</span></section>
            ) : vaultState ? (
              <>
                <section className="vault-address-panel panel">
                  <div><p className="eyebrow">YOUR PER-WALLET VAULT PDA</p><strong>{vaultAddress}</strong><small>Derived from this Devnet program and your connected wallet. This address is specific to this wallet.</small></div>
                  <div className="vault-address-actions"><button type="button" className="vault-secondary-button" onClick={() => void copyAddress()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button><a className="vault-secondary-button" href={explorerAddress(vaultAddress)} target="_blank" rel="noreferrer">Explorer <ExternalLink size={13} /></a></div>
                </section>

                <section className="vault-stats-grid" aria-label="On-chain vault status">
                  <article className="stat-card"><div className="stat-top"><span>AVAILABLE SOL</span><Vault size={16} /></div><div className="stat-value">{formatLamports(vaultAvailable)} SOL</div><div className="stat-foot">Rent reserve excluded · balance {formatLamports(vaultBalance ?? 0n)} SOL</div></article>
                  <article className="stat-card"><div className="stat-top"><span>TOTAL ALLOCATION CAP</span><ShieldCheck size={16} /></div><div className="stat-value">{formatLamports(vaultState.totalCapLamports)} SOL</div><div className="stat-foot">Lifetime trade cap · no trades are enabled</div></article>
                  <article className="stat-card"><div className="stat-top"><span>PER-POSITION LIMIT</span><LockKeyhole size={16} /></div><div className="stat-value">{formatLamports(vaultState.perPositionMaxLamports)} SOL</div><div className="stat-foot">Maximum configured position size</div></article>
                </section>

                <section className="vault-control-grid">
                  <article className="panel vault-action-panel">
                    <div className="panel-heading"><div><p className="eyebrow">USER CONTROL</p><h2>Deposit or withdraw</h2></div></div>
                    <div className="vault-action-content">
                      <div className="vault-balance-line"><span>wallet</span><strong>{walletBalance === null ? '—' : `${formatLamports(walletBalance)} SOL`}</strong></div>
                      <div className="vault-action-input"><label htmlFor="fund-amount">Deposit into vault</label><div className="allocation-input"><input id="fund-amount" type="number" min="0.001" max="10" step="0.001" value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} /><span className="allocation-unit">SOL</span></div><small>Remaining cap: {formatLamports(remainingAllocation)} SOL</small><button type="button" className="primary-button" disabled={!validFund || Boolean(busyAction)} onClick={() => parsedFundAmount !== null && void submitAction('fund', `Deposit ${formatLamports(parsedFundAmount, 6)} SOL to ${shorten(vaultAddress)}`, { amountLamports: parsedFundAmount })}>{busyAction === 'fund' ? 'Waiting for wallet…' : 'Review deposit in wallet'}</button></div>
                      <div className="vault-action-input"><label htmlFor="withdraw-amount">Withdraw available SOL</label><div className="allocation-input"><input id="withdraw-amount" type="number" min="0.001" step="0.001" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} /><span className="allocation-unit">SOL</span></div><small>Maximum now: {formatLamports(availableToWithdraw)} SOL · rent reserve stays in the account</small><button type="button" className="vault-secondary-button" disabled={availableToWithdraw === 0n || Boolean(busyAction)} onClick={() => setWithdrawAmount(formatLamports(availableToWithdraw, 9))}>Use maximum available</button><button type="button" className="primary-button" disabled={!validWithdraw || Boolean(busyAction)} onClick={() => parsedWithdrawAmount !== null && void submitAction('withdraw', `Withdraw ${formatLamports(parsedWithdrawAmount, 6)} SOL to ${shorten(ownerAddress)}`, { amountLamports: parsedWithdrawAmount })}>{busyAction === 'withdraw' ? 'Waiting for wallet…' : 'Review withdrawal in wallet'}</button></div>
                      <p className="vault-fee-note">Each action opens a wallet approval on Devnet. Review the vault, amount, and fee there before signing.</p>
                    </div>
                  </article>

                  <article className="panel vault-action-panel">
                    <div className="panel-heading"><div><p className="eyebrow">EMERGENCY CONTROLS</p><h2>Pause or revoke</h2></div></div>
                    <div className="vault-action-content">
                      <div className="vault-status-line"><span>Trading status</span><strong className={vaultState.paused ? 'vault-status-paused' : 'vault-status-open'}>{vaultState.paused ? 'Paused' : 'Unpaused'}</strong></div>
                      <div className="vault-status-line"><span>Executor</span><strong className="vault-executor-address">{vaultState.executor === '11111111111111111111111111111111' ? 'None set' : vaultState.executor}</strong></div>
                      <div className="vault-status-line"><span>Lifetime spent</span><strong>{formatLamports(vaultState.spentLamports)} SOL</strong></div>
                      <div className="vault-status-line"><span>Open exposure record</span><strong>{formatLamports(vaultState.openExposureLamports)} SOL</strong></div>
                      <button type="button" className="vault-secondary-button" disabled={Boolean(busyAction) || vaultState.paused} onClick={() => void submitAction('pause', `Pause vault ${shorten(vaultAddress)}`)}>{busyAction === 'pause' ? 'Waiting for wallet…' : 'Pause vault'}</button>
                      <button type="button" className="vault-secondary-button" disabled={Boolean(busyAction) || !vaultState.paused} onClick={() => void submitAction('unpause', `Unpause vault ${shorten(vaultAddress)}`)}>{busyAction === 'unpause' ? 'Waiting for wallet…' : 'Unpause vault'}</button>
                      <button type="button" className="vault-danger-button" disabled={Boolean(busyAction) || vaultState.executor === '11111111111111111111111111111111'} onClick={() => void submitAction('revoke_executor', `Revoke executor on ${shorten(vaultAddress)}`)}>{busyAction === 'revoke_executor' ? 'Waiting for wallet…' : 'Revoke executor'}</button>
                    </div>
                  </article>
                </section>
              </>
            ) : (
              <section className="vault-create-panel panel">
                <div className="panel-heading"><div><p className="eyebrow">NO VAULT ACCOUNT FOUND</p><h2>Create your vault PDA</h2></div></div>
                <div className="vault-create-content">
                  <p>This creates one vault account for your connected wallet. Creating it does not deposit SOL and does not enable trading. Review the chosen limits in your wallet prompt.</p>
                  <div className="vault-create-fields">
                    <label className="config-label">Total allocation cap<div className="allocation-input"><input type="number" min="0.001" step="0.001" value={totalCap} onChange={(event) => setTotalCap(event.target.value)} /><span className="allocation-unit">SOL</span></div><span className="config-hint">The on-chain lifetime spend limit.</span></label>
                    <label className="config-label">Per-position maximum<div className="allocation-input"><input type="number" min="0.001" max="0.02" step="0.001" value={perPositionMax} onChange={(event) => setPerPositionMax(event.target.value)} /><span className="allocation-unit">SOL</span></div><span className="config-hint">At least 0.001 SOL and no more than 0.02 SOL.</span></label>
                  </div>
                  <div className="vault-create-summary"><span>Network <strong>Solana Mainnet-Beta</strong></span><span>Owner <strong>{shorten(ownerAddress)}</strong></span><span>Program <strong>{shorten(configuredProgramId)}</strong></span><span>Fee payer <strong>Connected wallet</strong></span><span>Fees <strong>Shown in wallet</strong></span></div>
                  <button type="button" className="primary-button" disabled={!validInitialize || Boolean(busyAction)} onClick={() => parsedTotalCap !== null && parsedPositionMax !== null && void submitAction('initialize', `Create vault with ${formatLamports(parsedTotalCap, 6)} SOL total cap and ${formatLamports(parsedPositionMax, 6)} SOL per-position max`, { totalCapLamports: parsedTotalCap, perPositionMaxLamports: parsedPositionMax })}>{busyAction === 'initialize' ? 'Waiting for wallet…' : 'Review vault creation in wallet'}</button>
                </div>
              </section>
            )
          ) : null}

          {actionSummary ? <div className="vault-action-summary" role="status"><Check size={15} /><span>{actionSummary}</span></div> : null}
          {lastSignature ? <a className="vault-signature-link" href={explorerTransaction(lastSignature)} target="_blank" rel="noreferrer">View transaction on Devnet Explorer <ExternalLink size={13} /></a> : null}
          {actionError ? <p className="vault-action-error" role="alert">{actionError}</p> : null}
          {connected && programStatus === 'ready' ? <button className="vault-refresh-link" type="button" onClick={() => void refreshVault()} disabled={loading || Boolean(busyAction)}><RefreshCw className={loading ? 'spin' : ''} size={13} /> Refresh on-chain state</button> : null}
          <div className="vault-setup-footnote"><LockKeyhole size={14} /><span>This gate provides Devnet PDA setup and owner recovery only. No trading agent, executor setup, token accounting, or autonomous swap is enabled.</span></div>
        </div>
      </section>
    </main>
  );
}

export function VaultPage() {
  return (
    <ClientProvider client={devnetVaultClient}>
      <DevnetVaultWorkspace />
    </ClientProvider>
  );
}


