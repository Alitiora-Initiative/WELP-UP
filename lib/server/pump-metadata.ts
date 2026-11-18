export type PumpTokenMetadataInput = {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  website?: string;
  twitter?: string;
  telegram?: string;
};

export class PumpMetadataError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'PumpMetadataError';
    this.status = status;
  }
}

function httpsUrl(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new PumpMetadataError(`${label} must be a valid HTTPS URL.`, 400);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new PumpMetadataError(`${label} must be a public HTTPS URL.`, 400);
  }
  return parsed.toString();
}

export function buildPumpTokenMetadata(input: PumpTokenMetadataInput) {
  const metadata: Record<string, string | boolean> = {
    name: input.name,
    symbol: input.symbol,
    description: input.description || 'Launched through WELP UP on Solana mainnet.',
    image: httpsUrl(input.image, 'Token logo'),
    showName: true,
    createdOn: 'https://pump.fun',
  };

  for (const key of ['website', 'twitter', 'telegram'] as const) {
    const value = input[key]?.trim();
    if (value) metadata[key] = httpsUrl(value, key === 'twitter' ? 'X profile' : key === 'telegram' ? 'Telegram' : 'Website');
  }

  return metadata;
}

function readCid(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return '';
  const cid = (data as { cid?: unknown }).cid;
  return typeof cid === 'string' && /^[A-Za-z0-9]+$/.test(cid) ? cid : '';
}

/**
 * Pin the metadata JSON to IPFS. The JWT is server-only; never send it to the browser.
 * The user-supplied image stays at its public HTTPS URL and is referenced by the IPFS JSON.
 */
export async function uploadPumpTokenMetadata(input: PumpTokenMetadataInput): Promise<string> {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    throw new PumpMetadataError(
      'Pump.fun metadata storage is not configured on WELP UP. The site operator must add PINATA_JWT to the Vercel production environment.',
      503,
    );
  }

  const metadata = buildPumpTokenMetadata(input);
  const form = new FormData();
  form.append('network', 'public');
  form.append(
    'file',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
    `welp-up-${input.mint}.json`,
  );

  let response: Response;
  try {
    response = await fetch('https://uploads.pinata.cloud/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new PumpMetadataError('Could not reach Pinata to store the token metadata on IPFS.');
  }

  const responseText = await response.text().catch(() => '');
  let payload: unknown;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: unknown }).error)
        : responseText;
    throw new PumpMetadataError(
      `Pinata metadata upload failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : '.'}`,
      502,
    );
  }

  const cid = readCid(payload);
  if (!cid) {
    throw new PumpMetadataError('Pinata accepted the upload but did not return a valid IPFS CID.');
  }

  const uri = `https://ipfs.io/ipfs/${cid}`;
  if (new TextEncoder().encode(uri).length > 200) {
    throw new PumpMetadataError('The IPFS metadata URI exceeds Pump.fun’s 200-byte on-chain limit.');
  }
  return uri;
}
