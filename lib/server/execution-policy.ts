import 'server-only';

const integerEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
};

export const EXECUTION_POLICY = Object.freeze({
  rpcUrl: process.env.SOLANA_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com',
  privateRpcConfigured: Boolean(process.env.SOLANA_RPC_URL?.trim()),
  maxSlippageBps: integerEnv('WELP_MAX_SLIPPAGE_BPS', 50),
  maxPriorityFeeLamports: integerEnv('WELP_MAX_PRIORITY_FEE_LAMPORTS', 100_000),
  maxSolInputLamports: integerEnv('WELP_MAX_SOL_INPUT_LAMPORTS', 20_000_000),
  maxDailyDrawdownBps: integerEnv('WELP_MAX_DAILY_DRAWDOWN_BPS', 500),
  maxAllocationBps: integerEnv('WELP_MAX_ALLOCATION_BPS', 1_000),
  signerProvider: process.env.WELP_SIGNER_PROVIDER?.trim() || 'browser-wallet',
  autonomousExecutionEnabled: process.env.WELP_AUTONOMOUS_EXECUTION_ENABLED === 'true',
});

export function executionReadiness() {
  const blockers: string[] = [];
  if (!EXECUTION_POLICY.privateRpcConfigured) blockers.push('A private Solana RPC endpoint is not configured.');
  if (!['kms', 'hsm', 'custody'].includes(EXECUTION_POLICY.signerProvider)) blockers.push('No HSM/KMS/custody signer is configured.');
  if (!EXECUTION_POLICY.autonomousExecutionEnabled) blockers.push('Autonomous execution is disabled by operator gate.');
  return { ready: blockers.length === 0, blockers };
}

export function validateSwapRisk(input: { inputMint: string; amount: string; slippageBps: number; solMint: string }) {
  if (!Number.isInteger(input.slippageBps) || input.slippageBps < 10 || input.slippageBps > EXECUTION_POLICY.maxSlippageBps) {
    return `Slippage must be between 0.10% and ${(EXECUTION_POLICY.maxSlippageBps / 100).toFixed(2)}% under the execution policy.`;
  }
  if (input.inputMint === input.solMint && BigInt(input.amount) > BigInt(EXECUTION_POLICY.maxSolInputLamports)) {
    return `SOL input exceeds the ${EXECUTION_POLICY.maxSolInputLamports / 1_000_000} SOL per-swap allocation cap.`;
  }
  return null;
}
