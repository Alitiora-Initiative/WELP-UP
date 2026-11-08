/**
 * WELP custom launch rail — exact client-side encoding for the Anchor
 * `launch_token` instruction on the Token-2022 rail.
 *
 * The website is a middleman: it never holds keys. The caller's wallet signs
 * the assembled transaction and /api/launch/submit broadcasts it.
 */
import {
  address,
  getProgramDerivedAddress,
  getU64Encoder,
  getU8Encoder,
  getUtf8Encoder,
  type Address,
} from '@solana/kit';

/** Anchor program id of the WELP launchpad (matches declare_id!). */
export const WELP_LAUNCHPAD_PROGRAM_ID = address('BrcdB9sV7z9DvF9rDHG263HUxXgJM3iCQdF36TcxbFEn');
/** Token-2022 on mainnet. */
export const TOKEN_2022_PROGRAM_ID = address('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
/** System program. */
export const SYSTEM_PROGRAM_ID = address('11111111111111111111111111111111');

/** Anchor selector for `launch_token` = keccak256("global:launch_token")[0..8]. */
export const LAUNCH_TOKEN_DISCRIMINANT = Uint8Array.of(
  0xf2, 0x66, 0x08, 0x80, 0xb7, 0xc0, 0x55, 0x8c,
);
/** Anchor selector for `initialize_treasury` = keccak256("global:initialize_treasury")[0..8]. */
export const INITIALIZE_TREASURY_DISCRIMINANT = Uint8Array.of(
  0x80, 0xfc, 0x84, 0xa5, 0x43, 0xe9, 0xac, 0x21,
);

/** On-chain service fee, mirrored from programs/launchpad/src/token-launch.rs. */
export const LAUNCH_SERVICE_FEE_LAMPORTS = 2_500_000n;
export const MAX_WHOLE_TOKEN_SUPPLY = 1_000_000_000;
export const MAX_TOKEN_DECIMALS = 9;

export type LaunchTokenInputs = {
  wholeTokenSupply: string;
  decimals: number;
  name: string;
  symbol: string;
  uri: string;
};

export type LaunchAccounts = {
  creator: Address;
  mint: Address;
  creatorTokenAccount: Address;
  treasury: Address;
  treasuryVault: Address;
};

/** Validate exactly what the on-chain program validates. */
export function validateLaunchInputs(inputs: LaunchTokenInputs): { ok: true; supply: bigint } | { ok: false; error: string } {
  const raw = inputs.wholeTokenSupply.trim();
  if (!/^\d+$/.test(raw)) return { ok: false, error: 'Enter a whole-token supply using digits only.' };
  const normalized = raw.replace(/^0+(?=\d)/, '');
  if (normalized.length > 10 || BigInt(normalized) > BigInt(MAX_WHOLE_TOKEN_SUPPLY)) {
    return { ok: false, error: 'Total supply cannot exceed one billion whole tokens.' };
  }
  if (!Number.isInteger(inputs.decimals) || inputs.decimals < 0 || inputs.decimals > MAX_TOKEN_DECIMALS) {
    return { ok: false, error: 'Choose mint precision from 0 through 9 decimals.' };
  }
  const nameBytes = getUtf8Encoder().encode(inputs.name);
  const symbolBytes = getUtf8Encoder().encode(inputs.symbol);
  if (nameBytes.length === 0 || nameBytes.length > 48) return { ok: false, error: 'Token name must be 1–48 characters.' };
  if (symbolBytes.length === 0 || symbolBytes.length > 10) return { ok: false, error: 'Ticker must be 1–10 characters.' };
  if (!/^[\x21-\x7e]+$/.test(inputs.symbol)) return { ok: false, error: 'Ticker can only use printable ASCII characters.' };
  if (!/^https:\/\//.test(inputs.uri) || inputs.uri.length > 200) return { ok: false, error: 'The metadata URI must be an https address of 200 characters or fewer.' };
  return { ok: true, supply: BigInt(normalized) };
}

/** Borsh-serialize TokenLaunchParams exactly as Anchor undefined does. */
export function encodeLaunchTokenData(params: LaunchTokenInputs): Uint8Array {
  const chunks: ArrayLike<number>[] = [LAUNCH_TOKEN_DISCRIMINANT];
  const supply = validateLaunchInputs(params);
  if (!supply.ok) throw new Error(supply.error);
  chunks.push(getU64Encoder().encode(supply.supply));
  chunks.push(getU8Encoder().encode(params.decimals));
  for (const value of [params.name, params.symbol, params.uri]) {
    const bytes = getUtf8Encoder().encode(value);
    chunks.push(u32LengthBytes(bytes.length));
    chunks.push(bytes);
  }
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

function u32LengthBytes(value: number): Uint8Array {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, value, true);
  return new Uint8Array(view.buffer);
}

/** Derive the canonical treasury state and vault PDAs. */
export async function deriveTreasuryAddresses(): Promise<{ treasury: Address; treasuryVault: Address }> {
  const [treasury] = await getProgramDerivedAddress({
    programAddress: WELP_LAUNCHPAD_PROGRAM_ID,
    seeds: ['treasury-v1'],
  });
  const [treasuryVault] = await getProgramDerivedAddress({
    programAddress: WELP_LAUNCHPAD_PROGRAM_ID,
    seeds: ['treasury-vault-v1'],
  });
  return { treasury, treasuryVault };
}

/** Serializable instruction shape usable with @solana/kit message assembly. */
export type LaunchInstruction = {
  programAddress: Address;
  accounts: ReadonlyArray<{ address: Address; role: number }>;
  data: Uint8Array;
};

/** Account role flags from @solana/kit (pow): writable 2, signer 1. */
export const ACCOUNT_ROLES = { READONLY: 0, WRITABLE: 2, SIGNER: 1, WRITABLE_SIGNER: 3 } as const;

export function buildLaunchTokenInstruction(accounts: LaunchAccounts, params: LaunchTokenInputs): LaunchInstruction {
  return {
    programAddress: WELP_LAUNCHPAD_PROGRAM_ID,
    accounts: [
      { address: accounts.creator, role: ACCOUNT_ROLES.WRITABLE_SIGNER },
      { address: accounts.mint, role: ACCOUNT_ROLES.WRITABLE_SIGNER },
      { address: accounts.creatorTokenAccount, role: ACCOUNT_ROLES.WRITABLE },
      { address: accounts.treasury, role: ACCOUNT_ROLES.WRITABLE },
      { address: accounts.treasuryVault, role: ACCOUNT_ROLES.WRITABLE },
      { address: TOKEN_2022_PROGRAM_ID, role: ACCOUNT_ROLES.READONLY },
      { address: SYSTEM_PROGRAM_ID, role: ACCOUNT_ROLES.READONLY },
    ],
    data: encodeLaunchTokenData(params),
  };
}
