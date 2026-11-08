import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ciWorkflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const installer = readFileSync(new URL('../scripts/install-git-hooks.mjs', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../.githooks/pre-commit', import.meta.url), 'utf8');
const checks = readFileSync(new URL('../scripts/pre-commit-checks.sh', import.meta.url), 'utf8');

test('npm prepare installs the native Git hook outside CI and Vercel builds', () => {
  assert.equal(packageJson.scripts.prepare, 'node scripts/install-git-hooks.mjs');
  assert.match(installer, /process\.env\.CI === 'true'/);
  assert.match(installer, /process\.env\.VERCEL === '1'/);
  assert.match(installer, /core\.hooksPath/);
});

test('pre-commit hook runs the repository-wide quality sweep', () => {
  assert.match(hook, /scripts\/pre-commit-checks\.sh/);
  for (const command of [
    'npm run lint',
    'npm run typecheck',
    'npm run test:charts',
    'npm run build',
    '-m unittest discover -s tests',
    'cargo clippy',
    'cargo test',
    'cargo check',
  ]) {
    assert.ok(checks.includes(command), `Expected pre-commit checks to include ${command}`);
  }
});

test('Git hook is executable and the hook test runs in CI', () => {
  if (process.platform !== 'win32') {
    assert.notEqual(statSync(new URL('../.githooks/pre-commit', import.meta.url)).mode & 0o111, 0);
    assert.notEqual(statSync(new URL('../scripts/pre-commit-checks.sh', import.meta.url)).mode & 0o111, 0);
  }
  assert.equal(packageJson.scripts['test:git-hooks'], 'node --experimental-strip-types --test tests/git-hooks.test.mjs');
  assert.match(ciWorkflow, /npm run test:git-hooks/);
});
