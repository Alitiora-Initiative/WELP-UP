import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
} from '@solana/kit';

export const JUPITER_REFERRAL_PROGRAM = 'REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3';
export const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const LEGACY_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export type ReferralAccountReadiness =
  | { kind: 'ready'; tokenAccount: string }
  | { kind: 'invalid_address' }
  | { kind: 'referral_account_missing' }
  | { kind: 'wrong_referral_program' }
  | { kind: 'mint_missing' }
  | { kind: 'unsupported_token_program' }
  | { kind: 'token_account_missing'; tokenAccount: string }
  | { kind: 'token_account_invalid'; tokenAccount: string }
  | { kind: 'rpc_unavailable' };

type RpcFetcher = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function accountValue(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload) || !isRecord(payload.result)) return null;
  const value = payload.result.value;
  return isRecord(value) ? value : null;
}

async function rpcCall({
  endpoint,
  method,
  params,
  fetcher,
}: {
  endpoint: string;
  method: string;
  params: unknown[];
  fetcher: RpcFetcher;
}): Promise<unknown> {
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('RPC request failed.');
  return response.json();
}

function tokenAccountMatches({
  account,
  tokenProgram,
  referralAccount,
  mint,
}: {
  account: Record<string, unknown>;
  tokenProgram: string;
  referralAccount: string;
  mint: string;
}): boolean {
  if (account.owner !== tokenProgram || !Array.isArray(account.data)) return false;
  const [encodedData, encoding] = account.data;
  if (typeof encodedData !== 'string' || encoding !== 'base64') return false;
  const data = Buffer.from(encodedData, 'base64');
  if (data.length < 64) return false;
  const encoder = getAddressEncoder();
  const mintBytes = encoder.encode(address(mint));
  const ownerBytes = encoder.encode(address(referralAccount));
  return mintBytes.every((byte, index) => data[index] === byte) &&
    ownerBytes.every((byte, index) => data[index + 32] === byte);
}

export async function deriveReferralTokenAccount({
  referralAccount,
  mint,
  tokenProgram,
}: {
  referralAccount: string;
  mint: string;
  tokenProgram: string;
}): Promise<string> {
  const encoder = getAddressEncoder();
  const [tokenAccount] = await getProgramDerivedAddress({
    programAddress: address(ASSOCIATED_TOKEN_PROGRAM),
    seeds: [
      encoder.encode(address(referralAccount)),
      encoder.encode(address(tokenProgram)),
      encoder.encode(address(mint)),
    ],
  });
  return tokenAccount;
}

export async function checkReferralAccountReadiness({
  referralAccount,
  feeMint,
  endpoint = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  fetcher = fetch,
}: {
  referralAccount: string;
  feeMint: string;
  endpoint?: string;
  fetcher?: RpcFetcher;
}): Promise<ReferralAccountReadiness> {
  let referralAddress: string;
  let mintAddress: string;
  try {
    referralAddress = address(referralAccount);
    mintAddress = address(feeMint);
  } catch {
    return { kind: 'invalid_address' };
  }

  try {
    const referralPayload = await rpcCall({
      endpoint,
      method: 'getAccountInfo',
      params: [referralAddress, { encoding: 'base64', commitment: 'confirmed' }],
      fetcher,
    });
    const referralInfo = accountValue(referralPayload);
    if (!referralInfo) {
      if (isRecord(referralPayload) && isRecord(referralPayload.result) && referralPayload.result.value === null) {
        return { kind: 'referral_account_missing' };
      }
      return { kind: 'rpc_unavailable' };
    }
    if (referralInfo.owner !== JUPITER_REFERRAL_PROGRAM) return { kind: 'wrong_referral_program' };

    const mintPayload = await rpcCall({
      endpoint,
      method: 'getAccountInfo',
      params: [mintAddress, { encoding: 'base64', commitment: 'confirmed' }],
      fetcher,
    });
    const mintInfo = accountValue(mintPayload);
    if (!mintInfo) {
      if (isRecord(mintPayload) && isRecord(mintPayload.result) && mintPayload.result.value === null) {
        return { kind: 'mint_missing' };
      }
      return { kind: 'rpc_unavailable' };
    }
    const tokenProgram = mintInfo.owner;
    if (tokenProgram !== LEGACY_TOKEN_PROGRAM && tokenProgram !== TOKEN_2022_PROGRAM) {
      return { kind: 'unsupported_token_program' };
    }

    const tokenAccount = await deriveReferralTokenAccount({
      referralAccount: referralAddress,
      mint: mintAddress,
      tokenProgram,
    });
    const tokenPayload = await rpcCall({
      endpoint,
      method: 'getAccountInfo',
      params: [tokenAccount, { encoding: 'base64', commitment: 'confirmed' }],
      fetcher,
    });
    const tokenInfo = accountValue(tokenPayload);
    if (!tokenInfo) {
      if (isRecord(tokenPayload) && isRecord(tokenPayload.result) && tokenPayload.result.value === null) {
        return { kind: 'token_account_missing', tokenAccount };
      }
      return { kind: 'rpc_unavailable' };
    }
    if (!tokenAccountMatches({ account: tokenInfo, tokenProgram, referralAccount: referralAddress, mint: mintAddress })) {
      return { kind: 'token_account_invalid', tokenAccount };
    }
    return { kind: 'ready', tokenAccount };
  } catch {
    return { kind: 'rpc_unavailable' };
  }
}
