import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSolanaTokenScan, evaluateWebacyUrlScan } from '../lib/server/webacy-policy.ts';

test('Solana token passes only below risk 50 and not a honeypot', () => {
  assert.deepEqual(evaluateSolanaTokenScan({ riskScore: 49, isHoneypot: false }), { state: 'allow', riskScore: 49, isHoneypot: false });
});
test('Solana token scan blocks honeypots regardless of score', () => {
  const result = evaluateSolanaTokenScan({ riskScore: 5, isHoneypot: true });
  assert.equal(result.state, 'block');
  assert.equal(result.isHoneypot, true);
});
test('Solana token scan blocks score 50 or more', () => {
  assert.equal(evaluateSolanaTokenScan({ riskScore: 50, isHoneypot: false }).state, 'block');
  assert.equal(evaluateSolanaTokenScan({ riskScore: 91, isHoneypot: false }).state, 'block');
});
test('Solana token scan fails closed for missing or malformed indicators', () => {
  assert.equal(evaluateSolanaTokenScan(null).state, 'unknown');
  assert.equal(evaluateSolanaTokenScan({ riskScore: 5 }).state, 'unknown');
  assert.equal(evaluateSolanaTokenScan({ isHoneypot: false }).state, 'unknown');
  assert.equal(evaluateSolanaTokenScan({ riskScore: 101, isHoneypot: false }).state, 'unknown');
});
test('URL screening blocks phishing and malware', () => {
  assert.equal(evaluateWebacyUrlScan({ isPhishing: true, isMalware: false, riskScore: 12 }).state, 'block');
  assert.equal(evaluateWebacyUrlScan({ isPhishing: false, isMalware: true, riskScore: 12 }).state, 'block');
});
test('URL screening blocks caution and high-risk links before metadata publication', () => {
  assert.equal(evaluateWebacyUrlScan({ isPhishing: false, isMalware: false, riskScore: 41 }).state, 'block');
  assert.equal(evaluateWebacyUrlScan({ isPhishing: false, isMalware: false, riskScore: 70.1 }).state, 'block');
});
test('URL screening allows low-risk links but fails closed for incomplete results', () => {
  assert.equal(evaluateWebacyUrlScan({ isPhishing: false, isMalware: false, riskScore: 40 }).state, 'allow');
  assert.equal(evaluateWebacyUrlScan({ isPhishing: false, riskScore: 0 }).state, 'unknown');
});
