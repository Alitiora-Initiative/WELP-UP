import { NextRequest, NextResponse } from 'next/server';
import { generateKeyPairSigner, getBase64EncodedWireTransaction, getTransactionDecoder, partiallySignTransactionWithSigners } from '@solana/kit';
import { brandLaunchName, brandLaunchSymbol, launchMetadataUri } from '@/lib/launch-branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(request: NextRequest) {
  if (!new URL(request.url).protocol.startsWith('http')) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const owner = typeof body.owner === 'string' ? body.owner : '';
  const name = brandLaunchName(typeof body.name === 'string' ? body.name : '');
  const symbol = brandLaunchSymbol(typeof body.symbol === 'string' ? body.symbol : '');
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
  const logo = typeof body.logo === 'string' ? body.logo.trim().slice(0, 500) : '';
  if (logo) {
    try { if (new URL(logo).protocol !== 'https:') throw new Error(''); } catch { return NextResponse.json({ error: 'Logo URL must use HTTPS.' }, { status: 400 }); }
  }
  const social = Object.fromEntries(['website', 'twitter', 'telegram'].flatMap((key) => {
    const value = typeof body[key] === 'string' ? body[key].trim() : '';
    if (!value) return [];
    try { const url = new URL(value); return url.protocol === 'https:' ? [[key, url.toString()]] : []; }
    catch { return []; }
  })) as { website?: string; twitter?: string; telegram?: string };
  const initialBuySol = Number(body.initialBuySol ?? 0.01);
  if (!BASE58.test(owner) || !name || !symbol || !logo) return NextResponse.json({ error: 'Connect a wallet and provide a token name, ticker, and HTTPS logo URL.' }, { status: 400 });
  if (!Number.isFinite(initialBuySol) || initialBuySol < 0.001 || initialBuySol > 1) return NextResponse.json({ error: 'Initial buy must be between 0.001 and 1 SOL.' }, { status: 400 });

  try {
    const mintSigner = await generateKeyPairSigner();
    const origin = new URL(request.url).origin;
    const uri = launchMetadataUri(origin, { mint: mintSigner.address, name, symbol, description, logo, ...social });
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
      const detail = await upstream.text().catch(() => '');
      return NextResponse.json({ error: detail.slice(0, 240) || 'Launch transaction provider rejected the request.' }, { status: 502 });
    }
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    const transaction = getTransactionDecoder().decode(bytes);
    const mintSigned = await partiallySignTransactionWithSigners([mintSigner], transaction);
    const encoded = getBase64EncodedWireTransaction(mintSigned);
    return NextResponse.json({
      transaction: encoded,
      mint: mintSigner.address,
      name,
      symbol,
      metadataUri: uri,
      provider: 'pump.fun bonding curve via PumpPortal',
      network: 'solana-mainnet-beta',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not prepare the launch transaction.' }, { status: 502 });
  }
}
