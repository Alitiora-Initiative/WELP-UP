import 'server-only';
import { EXECUTION_POLICY } from '@/lib/server/execution-policy';

export async function solanaRpc<T>(method: string, params: unknown[] = [], timeoutMs = 10_000): Promise<T> {
  const response = await fetch(EXECUTION_POLICY.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Solana RPC returned ${response.status}.`);
  const payload = await response.json() as { result?: T; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message || 'Solana RPC request failed.');
  return payload.result as T;
}

export async function getFinalizedSignatureStatus(signature: string) {
  const result = await solanaRpc<Array<{ confirmationStatus?: string; err?: unknown } | null>>(
    'getSignatureStatuses',
    [[signature], { searchTransactionHistory: true }],
  );
  const status = result?.[0] ?? null;
  return {
    signature,
    state: status?.err ? 'failed' : status?.confirmationStatus === 'finalized' ? 'finalized' : status?.confirmationStatus || 'pending',
    error: status?.err ?? null,
  } as const;
}
