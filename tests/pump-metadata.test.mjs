import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPumpTokenMetadata } from '../lib/server/pump-metadata.ts';

const base = {
  mint: '11111111111111111111111111111111',
  name: 'WELP UP',
  symbol: 'WUP',
  description: 'Creator supplied description.',
  image: 'https://welpup.fun/token-icon.png',
};

test('Pump.fun metadata includes the user logo and standard discoverability fields', () => {
  const metadata = buildPumpTokenMetadata(base);
  assert.equal(metadata.name, base.name);
  assert.equal(metadata.symbol, base.symbol);
  assert.equal(metadata.description, base.description);
  assert.equal(metadata.image, base.image);
  assert.equal(metadata.showName, true);
  assert.equal(metadata.createdOn, 'https://pump.fun');
});

test('Pump.fun metadata preserves valid HTTPS social links', () => {
  const metadata = buildPumpTokenMetadata({
    ...base,
    website: 'https://example.com',
    twitter: 'https://x.com/example',
    telegram: 'https://t.me/example',
  });
  assert.equal(metadata.website, 'https://example.com/');
  assert.equal(metadata.twitter, 'https://x.com/example');
  assert.equal(metadata.telegram, 'https://t.me/example');
});

test('Pump.fun metadata rejects non-HTTPS or credential-bearing image URLs', () => {
  assert.throws(() => buildPumpTokenMetadata({ ...base, image: 'http://example.com/logo.png' }), /HTTPS/);
  assert.throws(() => buildPumpTokenMetadata({ ...base, image: 'https://user:pass@example.com/logo.png' }), /HTTPS/);
});

test('Pump.fun metadata rejects invalid social URLs instead of silently dropping them', () => {
  assert.throws(() => buildPumpTokenMetadata({ ...base, website: 'javascript:alert(1)' }), /HTTPS/);
});
