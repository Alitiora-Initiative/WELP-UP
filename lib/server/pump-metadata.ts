import { lookup } from 'node:dns/promises';
import type { IncomingHttpHeaders } from 'node:http';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { checkServerIdentity } from 'node:tls';

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

type DownloadedImage = {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpg' | 'webp';
};

type UploadDependencies = {
  jwt?: string;
  fetch?: typeof fetch;
  downloadImage?: (url: string) => Promise<DownloadedImage>;
};

const PINATA_UPLOAD_URL = 'https://uploads.pinata.cloud/v3/files';
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 12_000;

function validHttpsUrl(value: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new PumpMetadataError(`${label} must be a valid HTTPS URL.`, 400);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== '443') ||
    parsed.href.length > 500
  ) {
    throw new PumpMetadataError(`${label} must be a public HTTPS URL on port 443.`, 400);
  }
  return parsed;
}

export function isPublicIpAddress(value: string): boolean {
  const family = isIP(value);
  if (family === 4) {
    const [a, b, c] = value.split('.').map(Number);
    if (![a, b, c].every(Number.isInteger)) return false;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    );
  }

  if (family !== 6) return false;
  const address = value.toLowerCase().split('%')[0];
  if (address === '::' || address === '::1') return false;

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (mapped) return isPublicIpAddress(mapped[1]);

  const first = Number.parseInt(address.split(':')[0] || '0', 16);
  if ((first & 0xe000) !== 0x2000) return false;
  if (
    address.startsWith('2001:db8:') ||
    /^2001:0{0,3}:/.test(address) ||
    address.startsWith('2002:') ||
    address.startsWith('3fff:')
  ) {
    return false;
  }
  return true;
}

async function resolvePublicAddress(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.test')
  ) {
    throw new PumpMetadataError('Token logo host must resolve to a public internet address.', 400);
  }

  if (isIP(normalized)) {
    if (!isPublicIpAddress(normalized)) {
      throw new PumpMetadataError('Private and reserved IP addresses are not allowed for token logos.', 400);
    }
    return { address: normalized, family: isIP(normalized) };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(normalized, { all: true, verbatim: true });
  } catch {
    throw new PumpMetadataError('Token logo host could not be resolved.', 400);
  }
  if (!records.length || records.some((record) => !isPublicIpAddress(record.address))) {
    throw new PumpMetadataError('Token logo host must resolve only to public internet addresses.', 400);
  }
  return records[0];
}

function readContentType(headers: IncomingHttpHeaders) {
  return String(headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
}

async function requestImageAtPublicUrl(url: URL): Promise<{
  status: number;
  location?: string;
  contentType?: string;
  bytes?: Uint8Array;
}> {
  const resolved = await resolvePublicAddress(url.hostname);
  const hostname = resolved.address;
  const tlsHostname = url.hostname.replace(/^\[|\]$/g, '');
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      {
        hostname,
        port: 443,
        method: 'GET',
        path: `${url.pathname}${url.search}`,
        servername: isIP(tlsHostname) ? undefined : tlsHostname,
        rejectUnauthorized: true,
        checkServerIdentity: (_hostname, certificate) => checkServerIdentity(tlsHostname, certificate),
        headers: {
          Host: url.host,
          Accept: 'image/png,image/jpeg,image/webp',
          'User-Agent': 'WELP-UP-LaunchStudio/1.0',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        const contentType = readContentType(response.headers);
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.resume();
          resolve({ status, location, contentType });
          return;
        }
        if (status !== 200) {
          response.resume();
          resolve({ status, contentType });
          return;
        }

        const contentLength = Number(response.headers['content-length'] ?? 0);
        if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
          response.destroy(new Error('image_too_large'));
          reject(new PumpMetadataError('Token logo must be 5 MB or smaller.', 400));
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        response.on('data', (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buffer.length;
          if (total > MAX_IMAGE_BYTES) {
            response.destroy(new Error('image_too_large'));
            reject(new PumpMetadataError('Token logo must be 5 MB or smaller.', 400));
            return;
          }
          chunks.push(buffer);
        });
        response.on('end', () => resolve({
          status,
          contentType,
          bytes: new Uint8Array(Buffer.concat(chunks)),
        }));
        response.on('error', (error) => reject(
          error.message === 'image_too_large'
            ? new PumpMetadataError('Token logo must be 5 MB or smaller.', 400)
            : new PumpMetadataError('Could not download the token logo.', 400),
        ));
      },
    );

    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('timeout')));
    request.on('error', () => reject(new PumpMetadataError('Could not download the token logo from its public HTTPS URL.', 400)));
    request.end();
  });
}

function validateImageBytes(bytes: Uint8Array, mimeType: string): DownloadedImage {
  if (mimeType === 'image/png' &&
      bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { bytes, mimeType, extension: 'png' };
  }
  if (mimeType === 'image/jpeg' &&
      bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { bytes, mimeType, extension: 'jpg' };
  }
  if (mimeType === 'image/webp' &&
      bytes.length >= 12 &&
      Buffer.from(bytes.slice(0, 4)).toString('ascii') === 'RIFF' &&
      Buffer.from(bytes.slice(8, 12)).toString('ascii') === 'WEBP') {
    return { bytes, mimeType, extension: 'webp' };
  }
  throw new PumpMetadataError('Token logo must be a valid PNG, JPEG, or WebP image.', 400);
}

export async function downloadPublicTokenImage(sourceUrl: string): Promise<DownloadedImage> {
  let current = validHttpsUrl(sourceUrl, 'Token logo');
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await requestImageAtPublicUrl(current);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.location || redirects === MAX_REDIRECTS) {
        throw new PumpMetadataError('Token logo redirected too many times or returned an invalid redirect.', 400);
      }
      current = validHttpsUrl(new URL(response.location, current).toString(), 'Token logo redirect');
      continue;
    }
    if (response.status !== 200 || !response.bytes) {
      throw new PumpMetadataError(`Token logo server returned HTTP ${response.status || 'error'}.`, 400);
    }
    return validateImageBytes(response.bytes, response.contentType ?? '');
  }
  throw new PumpMetadataError('Token logo could not be downloaded.', 400);
}

export function buildPumpTokenMetadata(input: PumpTokenMetadataInput) {
  const metadata: Record<string, string | boolean> = {
    name: input.name,
    symbol: input.symbol,
    description: input.description || 'Launched through WELP UP on Solana mainnet.',
    image: validHttpsUrl(input.image, 'Pinned IPFS image').toString(),
    showName: true,
    createdOn: 'https://pump.fun',
  };

  for (const key of ['website', 'twitter', 'telegram'] as const) {
    const value = input[key]?.trim();
    if (value) metadata[key] = validHttpsUrl(value, key === 'twitter' ? 'X profile' : key === 'telegram' ? 'Telegram' : 'Website').toString();
  }

  return metadata;
}

function readCid(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return '';
  const cid = (data as { cid?: unknown }).cid;
  return typeof cid === 'string' && /^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/.test(cid) ? cid : '';
}

function ipfsUri(cid: string) {
  return `${IPFS_GATEWAY}${cid}`;
}

async function pinataUpload(
  file: Blob,
  filename: string,
  jwt: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  const form = new FormData();
  form.append('network', 'public');
  form.append('file', file, filename);

  let response: Response;
  try {
    response = await fetchImpl(PINATA_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new PumpMetadataError('Could not reach Pinata to store token assets on IPFS.');
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
      `Pinata upload failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : '.'}`,
      502,
    );
  }

  const cid = readCid(payload);
  if (!cid) {
    throw new PumpMetadataError('Pinata accepted the upload but did not return a valid IPFS CID.');
  }
  return cid;
}

/**
 * Pin the image and metadata JSON separately to public IPFS storage.
 * The JWT remains server-side; neither upload credential nor private key is
 * returned to the browser. External logo downloads are HTTPS-only, DNS checked,
 * IP pinned, redirect-limited, and size/type validated to prevent SSRF.
 */
export async function uploadPumpTokenMetadata(
  input: PumpTokenMetadataInput,
  dependencies: UploadDependencies = {},
): Promise<string> {
  const jwt = (dependencies.jwt ?? process.env.PINATA_JWT)?.trim();
  if (!jwt) {
    throw new PumpMetadataError(
      'Pump.fun metadata storage is not configured on WELP UP. Add PINATA_JWT to the Vercel Production environment.',
      503,
    );
  }

  const downloadImage = dependencies.downloadImage ?? downloadPublicTokenImage;
  const fetchImpl = dependencies.fetch ?? fetch;
  const downloaded = await downloadImage(input.image);
  const imageFile = new Blob([Buffer.from(downloaded.bytes)], { type: downloaded.mimeType });
  const imageCid = await pinataUpload(
    imageFile,
    `welp-up-${input.mint}-logo.${downloaded.extension}`,
    jwt,
    fetchImpl,
  );

  const metadata = buildPumpTokenMetadata({ ...input, image: ipfsUri(imageCid) });
  const metadataFile = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
  const metadataCid = await pinataUpload(
    metadataFile,
    `welp-up-${input.mint}.json`,
    jwt,
    fetchImpl,
  );

  const uri = ipfsUri(metadataCid);
  if (new TextEncoder().encode(uri).length > 200) {
    throw new PumpMetadataError('The IPFS metadata URI exceeds Pump.fun’s 200-byte on-chain limit.');
  }
  return uri;
}
