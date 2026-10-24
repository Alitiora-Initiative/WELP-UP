export const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Mainnet trading gate.
 *
 * false  → UI shows "Pending STRIDE security review" notice.
 * true   → Live bot execution enabled (set automatically by the
 *           "Enable Mainnet Trading" GitHub Actions workflow after
 *           STRIDE evaluation clears).
 *
 * Set via Vercel environment variable NEXT_PUBLIC_MAINNET_TRADING_ENABLED.
 * The enable-mainnet.yml workflow sets this automatically — you do not
 * need to change this file manually.
 */
export const MAINNET_TRADING_ENABLED =
  process.env.NEXT_PUBLIC_MAINNET_TRADING_ENABLED === 'true';
