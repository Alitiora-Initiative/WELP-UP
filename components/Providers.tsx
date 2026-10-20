'use client';

import { createClient } from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { walletSigner } from '@solana/kit-plugin-wallet';
import { ClientProvider } from '@solana/react';
import type { ReactNode } from 'react';

const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export const client = createClient()
  .use(walletSigner({ chain: 'solana:mainnet' }))
  .use(solanaRpc({ rpcUrl }));

export type AppClient = Awaited<typeof client>;

export function Providers({ children }: { children: ReactNode }) {
  return <ClientProvider client={client}>{children}</ClientProvider>;
}
