import test from 'node:test';
import assert from 'node:assert/strict';
import { isNonWebPath, shouldIgnoreBuild } from '../scripts/vercel-ignore-build.mjs';

test('documentation, CI, tests and Anchor-only changes do not trigger a web deployment', () => {
  const changed = [
    'README.md',
    'docs/PRODUCTION_READINESS.md',
    '.github/workflows/ci.yml',
    'programs/vault/src/lib.rs',
    'programs/vault-checks/src/lib.rs',
    'tests/program-gates.test.mjs',
    'Anchor.toml',
  ];
  assert.equal(shouldIgnoreBuild(changed), true);
});

test('any Next.js application or public asset change triggers a web deployment', () => {
  for (const path of ['app/vault/page.tsx', 'components/TerminalShell.tsx', 'lib/market-scoring.ts', 'public/welp-up-logo.svg']) {
    assert.equal(isNonWebPath(path), false, path);
  }
  assert.equal(shouldIgnoreBuild(['README.md', 'app/page.tsx']), false);
});

test('package, lockfile and deployment configuration changes trigger a web deployment', () => {
  for (const path of ['package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'vercel.json', '.gitignore']) {
    assert.equal(isNonWebPath(path), false, path);
  }
  assert.equal(shouldIgnoreBuild(['package-lock.json']), false);
});

test('unknown paths default to deploying rather than being ignored', () => {
  assert.equal(shouldIgnoreBuild(['new-runtime-config.json']), false);
});

test('an empty diff is safe to ignore', () => {
  assert.equal(shouldIgnoreBuild([]), true);
});
