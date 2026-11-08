import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.CI === 'true' || process.env.VERCEL === '1') {
  process.exit(0);
}

let repositoryRoot;
try {
  repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  // npm can install the package outside a Git checkout (for example, in a build image).
  process.exit(0);
}

const hookPath = join(repositoryRoot, '.githooks', 'pre-commit');
if (!existsSync(hookPath)) {
  throw new Error('Git hook setup failed: .githooks/pre-commit is missing.');
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});
process.stdout.write('WELP-UP Git pre-commit checks installed.\n');
