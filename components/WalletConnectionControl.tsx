'use client';

import { useState } from 'react';
import { ChevronDown, LogOut, Wallet, X } from 'lucide-react';
import { useConnect, useConnectedWallet, useDisconnect, useWallets } from '@solana/kit-plugin-wallet/react';
import { client } from '@/components/Providers';

const MAINNET_CHAIN = 'solana:mainnet';

export function WalletConnectionControl() {
  const connected = useConnectedWallet(client);
  const wallets = useWallets(client).filter((wallet) => wallet.chains.includes(MAINNET_CHAIN));
  const connect = useConnect(client);
  const disconnect = useDisconnect(client);
  const [pickerOpen, setPickerOpen] = useState(false);
  const connectError = connect.error instanceof Error
    ? connect.error.message
    : disconnect.error instanceof Error
      ? disconnect.error.message
      : '';

  function connectWallet(wallet: (typeof wallets)[number]) {
    setPickerOpen(false);
    connect.dispatch(wallet);
  }

  if (connected) {
    const address = connected.account.address;
    const shortAddress = `${address.slice(0, 4)}…${address.slice(-4)}`;

    return (
      <div className="connect-wrap" aria-label="Wallet connected on Solana mainnet">
        <div className="wallet-connected">
          <span className="wallet-pip" />
          <span className="wallet-name">{connected.wallet.name}</span>
          <span className="wallet-address" title={address}>{shortAddress}</span>
          <button
            className="icon-button"
            type="button"
            onClick={() => disconnect.dispatch()}
            disabled={disconnect.isRunning}
            aria-label={`Disconnect ${connected.wallet.name}`}
            title="Disconnect wallet"
          >
            <LogOut size={13} />
          </button>
        </div>
        {connectError ? <span className="wallet-connect-error" role="alert">{connectError}</span> : null}
      </div>
    );
  }

  return (
    <div className="wallet-connect-control">
      <div className="connect-wrap">
        <button
          className="connect-button"
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          disabled={connect.isRunning}
          aria-label="Choose a Solana wallet"
          aria-expanded={pickerOpen}
          aria-controls="welp-wallet-picker"
        >
          <Wallet size={15} />
          {connect.isRunning ? 'Connecting…' : 'Connect wallet'}
          <ChevronDown size={13} />
        </button>
        {pickerOpen ? (
          <div className="wallet-picker" id="welp-wallet-picker" role="dialog" aria-label="Available Solana wallets">
            <div className="wallet-picker-heading">
              <span>AVAILABLE SOLANA WALLETS</span>
              <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close wallet picker">
                <X size={14} />
              </button>
            </div>
            {wallets.length ? (
              <div className="wallet-picker-list">
                {wallets.map((wallet) => (
                  <button
                    className="wallet-picker-option"
                    key={wallet.name}
                    type="button"
                    onClick={() => connectWallet(wallet)}
                    disabled={connect.isRunning}
                  >
                    {wallet.icon.startsWith('data:image/') ? (
                      // Wallet Standard only exposes data-image icons here.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={wallet.icon} alt="" width={24} height={24} />
                    ) : <span className="wallet-picker-glyph"><Wallet size={15} /></span>}
                    <span>{wallet.name}</span>
                    <small>Solana mainnet</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="wallet-picker-empty">
                No Solana Wallet Standard provider is currently available in this browser.
                Install or enable a Solana wallet, then reopen this menu.
              </p>
            )}
            <p className="wallet-picker-note">
              Wallets are discovered from this browser. WELP does not request seed phrases or private keys.
            </p>
          </div>
        ) : null}
      </div>
      {connectError ? <span className="wallet-connect-error" role="alert">{connectError}</span> : null}
    </div>
  );
}
