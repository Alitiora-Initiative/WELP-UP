'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, LockKeyhole, ShieldCheck, UserRound, Wallet } from 'lucide-react';
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react';
import { AppSidebar } from '@/components/AppSidebar';
import { client } from '@/components/Providers';
import { TransactionHistory } from '@/components/TransactionHistory';

type WalletProfile = {
  owner: string;
  sol: number;
  solPrice: number;
  stableUsd: number;
  equityUsd: number;
};

function shortAddress(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function ProfilePage() {
  const connected = useConnectedWallet(client);
  const walletAddress = connected?.account.address ?? '';
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [loadError, setLoadError] = useState<{ owner: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const activeProfile = profile?.owner === walletAddress ? profile : null;
  const activeError = loadError?.owner === walletAddress ? loadError.message : '';

  useEffect(() => {
    if (!walletAddress) return;
    let active = true;
    fetch(`/api/wallet?owner=${encodeURIComponent(walletAddress)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load wallet balances.');
        if (active) {
          setProfile({ ...data as Omit<WalletProfile, 'owner'>, owner: walletAddress });
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError({ owner: walletAddress, message: error instanceof Error ? error.message : 'Could not load wallet balances.' });
      });
    return () => {
      active = false;
    };
  }, [walletAddress]);

  async function copyAddress() {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setLoadError({ owner: walletAddress, message: 'Could not copy the wallet address.' });
    }
  }

  return (
    <main className="app-shell">
      <AppSidebar active="profile" status={walletAddress ? 'Wallet session active' : 'Waiting for site wallet'} />
      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb"><span>ACCOUNT</span><span className="crumb-slash">/</span><strong>Profile</strong></div>
          <div className="topbar-right">
            <span className="market-open"><span className="market-pip" /> WALLET SETTINGS</span>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><UserRound size={14} /> ACCOUNT PROFILE</p>
              <h1>Your <em>profile.</em></h1>
              <p className="welcome-copy">Review the wallet connected to WELP and its public balance summary.</p>
            </div>
            <div className="date-pill"><span className="date-dot" /> SOLANA MAINNET</div>
          </section>

          <section className="profile-grid" aria-label="Wallet profile">
            <article className="panel profile-card">
              <div className="panel-heading">
                <div><p className="eyebrow">CONNECTED WALLET</p><h2>{connected?.wallet.name ?? 'Wallet details'}</h2></div>
                <div className="profile-card-icon"><Wallet size={17} /></div>
              </div>
              {walletAddress ? (
                <>
                  <div className="profile-connection"><span className="wallet-pip" /><span>Connected with {connected?.wallet.name ?? 'wallet'}</span></div>
                  <div className="profile-address-box">
                    <span className="profile-label">PUBLIC WALLET ADDRESS</span>
                    <code title={walletAddress}>{walletAddress}</code>
                    <button className="profile-copy-button" onClick={() => void copyAddress()}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy address'}
                    </button>
                  </div>
                  <div className="profile-meta-row"><span>Network</span><strong>Solana mainnet</strong></div>
                  {activeError ? <p className="profile-error" role="alert">{activeError}</p> : null}
                </>
              ) : (
                <div className="profile-empty">
                  <div className="empty-icon"><Wallet size={20} /></div>
                  <strong>Profile stays locked</strong>
                  <p>Public balances load only after the wallet session on this website is active.</p>
                </div>
              )}
            </article>

            <article className="panel profile-card">
              <div className="panel-heading">
                <div><p className="eyebrow">PUBLIC BALANCE SNAPSHOT</p><h2>Wallet overview</h2></div>
                <div className="profile-card-icon"><ShieldCheck size={17} /></div>
              </div>
              {walletAddress ? (
                activeProfile ? (
                  <div className="profile-balance-grid">
                    <div className="profile-balance profile-balance-total"><span>Estimated equity</span><strong>${activeProfile.equityUsd.toFixed(2)}</strong><small>Based on SOL and stablecoins</small></div>
                    <div className="profile-balance"><span>SOL balance</span><strong>{activeProfile.sol.toFixed(4)} SOL</strong><small>SOL at ${activeProfile.solPrice.toFixed(2)}</small></div>
                    <div className="profile-balance"><span>Stablecoins</span><strong>${activeProfile.stableUsd.toFixed(2)}</strong><small>USDC and USDT</small></div>
                  </div>
                ) : activeError ? (
                  <div className="profile-load-state">Balance snapshot unavailable. Refresh the page to try again.</div>
                ) : (
                  <div className="profile-load-state">Loading public balances for {shortAddress(walletAddress)}…</div>
                )
              ) : (
                <div className="profile-load-state">Balance snapshot stays hidden until the site wallet session is active.</div>
              )}
            </article>
          </section>

          <section className="profile-privacy panel">
            <span className="profile-privacy-icon"><LockKeyhole size={18} /></span>
            <div><p className="eyebrow">YOUR WALLET, YOUR APPROVAL</p><strong>This site only reads the connected session.</strong><p>Balances and history load only after the website wallet session is active. Each swap still needs its own approval.</p></div>
          </section>

          <section className="profile-privacy panel vault-plan-card">
            <span className="profile-privacy-icon"><ShieldCheck size={18} /></span>
            <div><p className="eyebrow">AUTONOMOUS VAULT · PLANNED, NOT ACTIVE</p><strong>Allocate only what you choose; withdraw when you choose.</strong><p>The planned agent will use a separate, user-funded and revocable vault with a user-set total cap and a 0.02 SOL per-position ceiling. Vault creation, automated trading and withdrawals are not implemented in this version.</p></div>
          </section>

          {walletAddress ? <TransactionHistory owner={walletAddress} /> : null}
        </div>
      </section>
    </main>
  );
}
