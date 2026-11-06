'use client';

import { LogOut, Wallet } from 'lucide-react';
import { useConnect, useConnectedWallet, useDisconnect, useWallets } from '@solana/kit-plugin-wallet/react';
import { client } from '@/components/Providers';

export function WalletConnectionControl() {
  const connected = useConnectedWallet(client);
  const wallets = useWallets(client);
  const connect = useConnect(client);
  const disconnect = useDisconnect(client);
  const connectError = connect.error instanceof Error ? connect.error.message : '';

  function connectWallet() {
    const wallet = wallets.find((item) => item.name.toLowerCase().includes('phantom')) ?? wallets[0];
    if (wallet) void connect.dispatch(wallet);
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
          <button className="icon-button" type="button" onClick={() => void disconnect.dispatch()} aria-label={`Disconnect ${connected.wallet.name}`} title="Disconnect wallet">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-connect-control">
      <div className="connect-wrap">
        <button className="connect-button" type="button" onClick={connectWallet} disabled={!wallets.length || connect.isRunning} aria-label="Connect wallet to Solana mainnet">
          <Wallet size={15} /> {connect.isRunning ? 'Connecting…' : 'Connect wallet'}
        </button>
        {!wallets.length ? <a className="wallet-install-link" href="https://phantom.app/download" target="_blank" rel="noreferrer">Install Phantom</a> : null}
      </div>
      {connectError ? <span className="wallet-connect-error" role="status">{connectError}</span> : null}
    </div>
  );
}
