import assert from 'node:assert/strict';
import test from 'node:test';
import { address, getAddressEncoder } from '@solana/kit';
import {
  checkReferralAccountReadiness,
  deriveReferralTokenAccount,
  JUPITER_REFERRAL_PROGRAM,
  LEGACY_TOKEN_PROGRAM,
} from '../lib/server/referral-readiness.ts';

const referralAccount = '2puMMFLeeVYPifiJGeNefnYiGFpXSDNTDSAMiq9ndUuV';
const mint = 'So11111111111111111111111111111111111111112';
const tokenAccount = 'EUfN6KY8nosJKwVe9jN9X67YTC5rHacSNLxNWtTDqGxt';

function response(value) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { value } }), { status: 200 });
}

function rpcFixture({ tokenAccountValue = null } = {}) {
  const encoder = getAddressEncoder();
  const tokenData = Buffer.alloc(165);
  Buffer.from(encoder.encode(address(mint))).copy(tokenData, 0);
  Buffer.from(encoder.encode(address(referralAccount))).copy(tokenData, 32);
  const calls = [];
  const fetcher = async (_input, init) => {
    const request = JSON.parse(init.body);
    calls.push(request.method);
    if (request.method !== 'getAccountInfo') throw new Error('Unexpected method');
    if (request.params[0] === referralAccount) return response({ owner: JUPITER_REFERRAL_PROGRAM, executable: false, data: ['', 'base64'] });
    if (request.params[0] === mint) return response({ owner: LEGACY_TOKEN_PROGRAM, executable: false, data: ['', 'base64'] });
    const account = tokenAccountValue === 'valid'
      ? { owner: LEGACY_TOKEN_PROGRAM, executable: false, data: [tokenData.toString('base64'), 'base64'] }
      : tokenAccountValue;
    return response(account);
  };
  return { fetcher, calls };
}

test('derives the canonical Jupiter referral ATA for the known referral and SOL mint', async () => {
  assert.equal(await deriveReferralTokenAccount({ referralAccount, mint, tokenProgram: LEGACY_TOKEN_PROGRAM }), tokenAccount);
});

test('reports an absent fee ATA instead of treating the referral quote as ready', async () => {
  const { fetcher, calls } = rpcFixture();
  const result = await checkReferralAccountReadiness({ referralAccount, feeMint: mint, endpoint: 'https://rpc.example', fetcher });
  assert.deepEqual(result, { kind: 'token_account_missing', tokenAccount });
  assert.equal(calls.length, 3);
});

test('accepts a fee ATA only when its mint, authority and token program match', async () => {
  const { fetcher } = rpcFixture({ tokenAccountValue: 'valid' });
  const result = await checkReferralAccountReadiness({ referralAccount, feeMint: mint, endpoint: 'https://rpc.example', fetcher });
  assert.deepEqual(result, { kind: 'ready', tokenAccount });
});
