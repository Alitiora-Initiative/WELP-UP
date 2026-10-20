'use client';

import { useConnect, useConnectedWallet, useDisconnect, useIsWalletReady, useWallets } from '@solana/kit-plugin-wallet/react';
import { ChevronDown, ExternalLink, LoaderCircle, Wallet, X } from 'lucide-react';
import { client } from '@/components/Providers';

function shortAddress(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function WalletConnect() {
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const { dispatch: connect, isRunning } = useConnect(client);
  const { dispatch: disconnect } = useDisconnect(client);
  const ready = useIsWalletReady(client);
  const phantom = wallets.find((wallet) => wallet.name.toLowerCase().includes('phantom'));

  if (connected) {
    return (
      <div className="wallet-connected">
        <span className="wallet-pip" />
        <span className="wallet-name">{connected.wallet.name}</span>
        <span className="wallet-address">{shortAddress(connected.account.address)}</span>
        <button className="icon-button disconnect-button" onClick={() => disconnect()} aria-label="Disconnect wallet" title="Disconnect">
          <X size={15} />
        </button>
      </div>
    );
  }

  if (!ready) return <button className="connect-button" disabled><LoaderCircle className="spin" size={16} /> Finding wallet…</button>;
  if (wallets.length === 0) {
    return <a className="connect-button" href="https://phantom.app/download" target="_blank" rel="noreferrer">Install Phantom <ExternalLink size={15} /></a>;
  }
  return (
    <div className="connect-wrap">
      <button className="connect-button" disabled={isRunning} onClick={() => connect(phantom ?? wallets[0])}>
        {isRunning ? <LoaderCircle className="spin" size={16} /> : <Wallet size={16} />}
        {isRunning ? 'Connecting…' : phantom ? 'Connect Phantom' : `Connect ${wallets[0].name}`}
      </button>
      {wallets.length > 1 ? (
        <details className="wallet-menu">
          <summary aria-label="Choose another wallet"><ChevronDown size={15} /></summary>
          <div className="wallet-menu-items">
            {wallets.map((wallet) => <button key={wallet.name} onClick={() => connect(wallet)}>{wallet.name}</button>)}
          </div>
        </details>
      ) : null}
    </div>
  );
}
