'use client';

import { useEffect } from 'react';
import { createClient } from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { walletSigner } from '@solana/kit-plugin-wallet';
import { useConnect, useConnectedWallet, useIsWalletReady, useWalletStatus, useWallets } from '@solana/kit-plugin-wallet/react';
import { ClientProvider } from '@solana/react';
import type { ReactNode } from 'react';

const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export const client = createClient()
  .use(walletSigner({ chain: 'solana:mainnet' }))
  .use(solanaRpc({ rpcUrl }));

export type AppClient = Awaited<typeof client>;

function WebsiteWalletSession() {
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const ready = useIsWalletReady(client);
  const status = useWalletStatus(client);
  const { dispatch } = useConnect(client);

  useEffect(() => {
    if (!ready || connected || wallets.length === 0) return;
    if (status === 'connecting' || status === 'reconnecting') return;
    const wallet = wallets.find((item) => item.name.toLowerCase().includes('phantom')) ?? wallets[0];
    const connect = () => {
      void dispatch(wallet);
    };
    window.addEventListener('pointerdown', connect, { once: true });
    return () => window.removeEventListener('pointerdown', connect);
  }, [connected, dispatch, ready, status, wallets]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClientProvider client={client}>
      <WebsiteWalletSession />
      {children}
    </ClientProvider>
  );
}
