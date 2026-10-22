import {
  AccountRole,
  address,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
} from '@solana/kit';
import type { Address, Instruction } from '@solana/kit';

export const VAULT_ACCOUNT_SIZE = 114;
export const SYSTEM_PROGRAM_ADDRESS = address('11111111111111111111111111111111');

export type VaultState = {
  owner: string;
  executor: string;
  totalCapLamports: bigint;
  spentLamports: bigint;
  openExposureLamports: bigint;
  perPositionMaxLamports: bigint;
  paused: boolean;
};

export type VaultInstructionName = 'initialize' | 'fund' | 'withdraw' | 'pause' | 'unpause' | 'revoke_executor';

function equalBytes(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function anchorDiscriminator(namespace: 'global' | 'account', name: string) {
  const input = new TextEncoder().encode(`${namespace}:${name}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
  return new Uint8Array(digest).slice(0, 8);
}

function encodeU64(value: bigint) {
  if (value < 0n || value > 18_446_744_073_709_551_615n) throw new Error('Amount is outside the supported range.');
  const bytes = new Uint8Array(8);
  let remaining = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

function concatenate(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export async function deriveVaultAddress(programAddress: Address, ownerAddress: Address) {
  const [vaultAddress] = await getProgramDerivedAddress({
    programAddress,
    seeds: [new TextEncoder().encode('vault'), getAddressEncoder().encode(ownerAddress)],
  });
  return vaultAddress;
}

export async function decodeVaultAccount(encodedData: string, expectedOwner: Address): Promise<VaultState> {
  const binary = globalThis.atob(encodedData);
  const data = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (data.length < VAULT_ACCOUNT_SIZE) throw new Error('The vault account has an unexpected data size.');

  const expectedDiscriminator = await anchorDiscriminator('account', 'Vault');
  if (!equalBytes(data.slice(0, 8), expectedDiscriminator)) throw new Error('The account is not a WELP vault.');

  const decoder = getAddressDecoder();
  const owner = decoder.decode(data.slice(8, 40));
  if (owner !== expectedOwner) throw new Error('The vault account owner does not match the connected wallet.');
  const executor = decoder.decode(data.slice(40, 72));
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  return {
    owner,
    executor,
    totalCapLamports: view.getBigUint64(72, true),
    spentLamports: view.getBigUint64(80, true),
    openExposureLamports: view.getBigUint64(88, true),
    perPositionMaxLamports: view.getBigUint64(96, true),
    paused: data[104] === 1,
  };
}

export async function createVaultInstruction(
  programAddress: Address,
  ownerAddress: Address,
  vaultAddress: Address,
  instructionName: VaultInstructionName,
  args: { amountLamports?: bigint; totalCapLamports?: bigint; perPositionMaxLamports?: bigint } = {},
): Promise<Instruction> {
  const discriminator = await anchorDiscriminator('global', instructionName);
  let argumentsData = new Uint8Array();

  if (instructionName === 'initialize') {
    if (args.totalCapLamports === undefined || args.perPositionMaxLamports === undefined) {
      throw new Error('Vault limits are required to create a vault.');
    }
    argumentsData = concatenate(encodeU64(args.totalCapLamports), encodeU64(args.perPositionMaxLamports));
  } else if (instructionName === 'fund' || instructionName === 'withdraw') {
    if (args.amountLamports === undefined) throw new Error('An amount is required for this vault action.');
    argumentsData = encodeU64(args.amountLamports);
  }

  const ownerIsWritable = instructionName === 'initialize' || instructionName === 'fund' || instructionName === 'withdraw';
  const accounts = instructionName === 'initialize'
    ? [
        { address: ownerAddress, role: AccountRole.WRITABLE_SIGNER },
        { address: vaultAddress, role: AccountRole.WRITABLE },
        { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      ]
    : [
        { address: ownerAddress, role: ownerIsWritable ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER },
        { address: vaultAddress, role: AccountRole.WRITABLE },
        ...(instructionName === 'fund' ? [{ address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY }] : []),
      ];

  return { programAddress, accounts, data: concatenate(discriminator, argumentsData) };
}

export function parseSolToLamports(value: string) {
  const match = /^(\d+)(?:\.(\d{0,9}))?$/.exec(value.trim());
  if (!match) return null;
  return BigInt(match[1]) * 1_000_000_000n + BigInt((match[2] ?? '').padEnd(9, '0') || '0');
}

export function formatLamports(value: bigint, fractionDigits = 4) {
  const whole = value / 1_000_000_000n;
  const fraction = (value % 1_000_000_000n).toString().padStart(9, '0').slice(0, fractionDigits);
  return `${whole.toLocaleString('en-US')}${fractionDigits > 0 ? `.${fraction}` : ''}`;
}
