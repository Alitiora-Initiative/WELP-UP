import { NextRequest, NextResponse } from 'next/server';
import {
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getTransactionDecoder,
  partiallySignTransactionWithSigners,
} from '@solana/kit';
import { brandLaunchName, brandLaunchSymbol } from '@/lib/launch-branding';
import { PumpMetadataError, uploadPumpTokenMetadata } from '@/lib/server/pump-metadata';
import { getWebacyUrlScan } from '@/lib/server/webacy';
import { evaluateWebacyUrlScan } from '@/lib/server/webacy-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_METADATA_BYTES = 200;

export async function GET() {
  return NextResponse.json(
    { ready: Boolean(process.env.PINATA_JWT?.trim()), metadataStorage: 'public IPFS' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

function optionalHttpsField(body: Record<string, unknown>, key: 'website' | 'twitter' | 'telegram') {
  const raw = typeof body[key] === 'string' ? body[key].trim() : '';
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PumpMetadataError(`${key} must be a valid HTTPS URL.`, 400);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new PumpMetadataError(`${key} must use a public HTTPS URL.`, 400);
  }
  if (raw.length > 200) {
    throw new PumpMetadataError(`${key} URL must be 200 characters or fewer.`, 400);
  }
  return url.toString();
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body. Send the launch details as JSON.' }, { status: 400 });
  }

  const owner = typeof body.owner === 'string' ? body.owner.trim() : '';
  const name = brandLaunchName(typeof body.name === 'string' ? body.name : '');
  const symbol = brandLaunchSymbol(typeof body.symbol === 'string' ? body.symbol : '');
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
  const logo = typeof body.logo === 'string' ? body.logo.trim() : '';

  if (!BASE58.test(owner)) {
    return NextResponse.json({ error: 'Connect a valid Solana wallet before launching.' }, { status: 400 });
  }
  if (!name || new TextEncoder().encode(name).length > 32) {
    return NextResponse.json({ error: 'Token name must contain 1–32 UTF-8 bytes.' }, { status: 400 });
  }
  if (!symbol || !/^[\x21-\x7e]{1,10}$/.test(symbol)) {
    return NextResponse.json({ error: 'Ticker must contain 1–10 printable ASCII characters.' }, { status: 400 });
  }
  if (!logo) {
    return NextResponse.json({ error: 'Add a public HTTPS token logo URL before launching.' }, { status: 400 });
  }
  if (logo.length > 500) {
    return NextResponse.json({ error: 'Token logo URL must be 500 characters or fewer.' }, { status: 400 });
  }

  let logoUrl: URL;
  try {
    logoUrl = new URL(logo);
  } catch {
    return NextResponse.json({ error: 'Token logo must be a valid HTTPS URL.' }, { status: 400 });
  }
  if (logoUrl.protocol !== 'https:' || logoUrl.username || logoUrl.password) {
    return NextResponse.json({ error: 'Token logo must use a public HTTPS URL.' }, { status: 400 });
  }

  let social: { website?: string; twitter?: string; telegram?: string };
  try {
    social = {
      website: optionalHttpsField(body, 'website'),
      twitter: optionalHttpsField(body, 'twitter'),
      telegram: optionalHttpsField(body, 'telegram'),
    };
  } catch (error) {
    if (error instanceof PumpMetadataError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'One of the social links is invalid.' }, { status: 400 });
  }

  // Check creator-supplied outbound links before publishing them in token
  // metadata. Logo ingestion uses separate DNS-pinned SSRF and image validation.
  const outboundLinks = [
    ['Project website', social.website],
    ['X profile', social.twitter],
    ['Telegram', social.telegram],
  ] as const;
  const providedLinks = outboundLinks.filter((entry): entry is readonly [string, string] => Boolean(entry[1]));
  const urlScans = await Promise.all(providedLinks.map(async ([label, url]) => ({
    label,
    result: await getWebacyUrlScan(url),
  })));
  for (const scan of urlScans) {
    if (!scan.result.ok) {
      return NextResponse.json({
        error: `WELP could not verify the ${scan.label} with Webacy. Remove the optional link or retry when the security service is available. No launch transaction was prepared.`,
        security: { provider: 'Webacy', state: 'unknown' },
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    const assessment = evaluateWebacyUrlScan(scan.result.data);
    if (assessment.state !== 'allow') {
      return NextResponse.json({
        error: `The ${scan.label} was not cleared by Webacy: ${assessment.reason || 'security review required'}. Remove or replace that link before launching.`,
        security: { provider: 'Webacy', state: assessment.state, riskScore: assessment.riskScore },
      }, { status: assessment.state === 'unknown' ? 503 : 422, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  const initialBuySol = Number(body.initialBuySol ?? 0.01);
  if (!Number.isFinite(initialBuySol) || initialBuySol < 0.001 || initialBuySol > 1) {
    return NextResponse.json({ error: 'Initial buy must be between 0.001 and 1 SOL.' }, { status: 400 });
  }

  try {
    const mintSigner = await generateKeyPairSigner();
    const uri = await uploadPumpTokenMetadata({
      mint: mintSigner.address,
      name,
      symbol,
      description,
      image: logoUrl.toString(),
      ...social,
    });

    if (new TextEncoder().encode(uri).length > MAX_METADATA_BYTES) {
      return NextResponse.json(
        { error: 'The pinned token metadata URI is too long for Pump.fun (maximum 200 bytes).' },
        { status: 502 },
      );
    }

    const upstream = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: owner,
        action: 'create',
        tokenMetadata: { name, symbol, uri },
        mint: mintSigner.address,
        denominatedInSol: 'true',
        amount: initialBuySol,
        slippage: 10,
        priorityFee: 0.00005,
        pool: 'pump',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok) {
      const detail = (await upstream.text().catch(() => '')).trim();
      return NextResponse.json(
        {
          error: detail
            ? `PumpPortal rejected the launch (HTTP ${upstream.status}): ${detail.slice(0, 220)}`
            : `PumpPortal rejected the launch request (HTTP ${upstream.status}).`,
        },
        { status: 502 },
      );
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.length === 0) {
      return NextResponse.json({ error: 'PumpPortal returned an empty launch transaction.' }, { status: 502 });
    }

    const transaction = getTransactionDecoder().decode(bytes);
    const mintSigned = await partiallySignTransactionWithSigners([mintSigner], transaction);
    const encoded = getBase64EncodedWireTransaction(mintSigned);

    return NextResponse.json(
      {
        transaction: encoded,
        mint: mintSigner.address,
        name,
        symbol,
        metadataUri: uri,
        provider: 'pump.fun bonding curve via PumpPortal',
        network: 'solana-mainnet-beta',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof PumpMetadataError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not prepare the launch transaction.' },
      { status: 502 },
    );
  }
}
