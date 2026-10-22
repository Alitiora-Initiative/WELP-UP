import { createClient } from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { walletSigner } from '@solana/kit-plugin-wallet';

export const DEVNET_RPC_URL = 'https://api.devnet.solana.com';

export const devnetVaultClient = createClient()
  .use(walletSigner({ chain: 'solana:devnet' }))
  .use(solanaRpc({ rpcUrl: DEVNET_RPC_URL }));

export type DevnetVaultClient = Awaited<typeof devnetVaultClient>;
