import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPumpTokenMetadata,
  isPublicIpAddress,
  PumpMetadataError,
  uploadPumpTokenMetadata,
} from '../lib/server/pump-metadata.ts';

const base = {
  mint: '11111111111111111111111111111111',
  name: 'WELP UP',
  symbol: 'WUP',
  description: 'Creator supplied description.',
  image: 'https://welpup.fun/token-icon.png',
};

const imageCid = 'bafy' + 'a'.repeat(55);
const metadataCid = 'bafy' + 'b'.repeat(55);

test('Pump.fun metadata includes creator fields and the pinned image URI', () => {
  const metadata = buildPumpTokenMetadata({
    ...base,
    image: 'https://ipfs.io/ipfs/' + imageCid,
  });
  assert.equal(metadata.name, base.name);
  assert.equal(metadata.symbol, base.symbol);
  assert.equal(metadata.description, base.description);
  assert.equal(metadata.image, 'https://ipfs.io/ipfs/' + imageCid);
  assert.equal(metadata.showName, true);
  assert.equal(metadata.createdOn, 'https://pump.fun');
});

test('Pump.fun metadata preserves valid HTTPS social links', () => {
  const metadata = buildPumpTokenMetadata({
    ...base,
    image: 'https://ipfs.io/ipfs/' + imageCid,
    website: 'https://example.com',
    twitter: 'https://x.com/example',
    telegram: 'https://t.me/example',
  });
  assert.equal(metadata.website, 'https://example.com/');
  assert.equal(metadata.twitter, 'https://x.com/example');
  assert.equal(metadata.telegram, 'https://t.me/example');
});

test('Pump.fun metadata rejects non-HTTPS or credential-bearing URLs', () => {
  assert.throws(
    () => buildPumpTokenMetadata({ ...base, image: 'http://example.com/logo.png' }),
    /HTTPS/,
  );
  assert.throws(
    () => buildPumpTokenMetadata({ ...base, image: 'https://user:pass@example.com/logo.png' }),
    /HTTPS/,
  );
  assert.throws(
    () => buildPumpTokenMetadata({
      ...base,
      image: 'https://ipfs.io/ipfs/' + imageCid,
      website: 'javascript:alert(1)',
    }),
    /HTTPS/,
  );
});

test('SSRF address filter rejects private, loopback, link-local and reserved addresses', () => {
  for (const ip of [
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.10',
    '198.18.0.1',
    '224.0.0.1',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
  ]) {
    assert.equal(isPublicIpAddress(ip), false, ip);
  }
});

test('SSRF address filter allows public IPv4 and IPv6 addresses', () => {
  assert.equal(isPublicIpAddress('1.1.1.1'), true);
  assert.equal(isPublicIpAddress('8.8.8.8'), true);
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true);
});

test('Pump.fun upload pins image first, then metadata referencing its IPFS CID', async () => {
  const uploads = [];
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const fakeFetch = async (url, init) => {
    assert.equal(url, 'https://uploads.pinata.cloud/v3/files');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer pinata-test-secret');
    const form = init.body;
    assert.equal(form.get('network'), 'public');
    const file = form.get('file');
    uploads.push({
      name: file.name,
      type: file.type,
      content: file.type === 'application/json' ? await file.text() : '',
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    const cid = uploads.length === 1 ? imageCid : metadataCid;
    return new Response(JSON.stringify({ data: { cid } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const uri = await uploadPumpTokenMetadata(base, {
    jwt: 'pinata-test-secret',
    fetch: fakeFetch,
    downloadImage: async (url) => {
      assert.equal(url, base.image);
      return { bytes: png, mimeType: 'image/png', extension: 'png' };
    },
  });

  assert.equal(uri, 'https://ipfs.io/ipfs/' + metadataCid);
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].name, 'welp-up-' + base.mint + '-logo.png');
  assert.equal(uploads[0].type, 'image/png');
  assert.deepEqual(Array.from(uploads[0].bytes), Array.from(png));
  assert.equal(uploads[1].name, 'welp-up-' + base.mint + '.json');
  const metadata = JSON.parse(uploads[1].content);
  assert.equal(metadata.name, base.name);
  assert.equal(metadata.symbol, base.symbol);
  assert.equal(metadata.image, 'https://ipfs.io/ipfs/' + imageCid);
  assert.equal(metadata.description, base.description);
  assert.equal(JSON.stringify(uploads).includes('pinata-test-secret'), false);
  assert.equal(uri.length <= 200, true);
});

test('Pump.fun upload fails closed without a Pinata JWT', async () => {
  await assert.rejects(
    uploadPumpTokenMetadata(base, { jwt: '' }),
    (error) => error instanceof PumpMetadataError && error.status === 503,
  );
});

test('Pump.fun upload returns a useful failure when Pinata rejects the image upload', async () => {
  await assert.rejects(
    uploadPumpTokenMetadata(base, {
      jwt: 'pinata-test-secret',
      downloadImage: async () => ({
        bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        mimeType: 'image/png',
        extension: 'png',
      }),
      fetch: async () => new Response('unauthorized', { status: 401 }),
    }),
    (error) => error instanceof PumpMetadataError && error.status === 502 && /HTTP 401/.test(error.message),
  );
});
