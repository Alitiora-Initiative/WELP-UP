import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// These paths are deliberately narrow. Any unknown path triggers a web build,
// so new application/config files cannot be silently excluded.
const NON_WEB_PATHS = [
  /^\.github\//,
  /^docs\//,
  /^programs\//,
  /^tests\//,
  /^Anchor\.toml$/,
  /^LIMITS\.md$/,
  /^PRIVACY\.md$/,
  /^README\.md$/,
  /^ROADMAP\.md$/,
  /^TERMS\.md$/,
  /^WHITEPAPER\.md$/,
  /^WELPUP_BUILD_BLUEPRINT\.md$/,
  /^welp-original-source$/,
  /^welp-markets-[^/]+\.csv$/,
  /^requirements\.txt$/,
];

export function isNonWebPath(path) {
  return NON_WEB_PATHS.some((pattern) => pattern.test(path));
}

export function shouldIgnoreBuild(changedFiles) {
  // An empty diff means "no changes detected" (for example a branch deploy
  // whose head equals its base). Never suppress the build for an empty set.
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
    return false;
  }
  return changedFiles.every(isNonWebPath);
}

export function readChangedFiles(previousSha, commitSha) {
  if (
    typeof previousSha !== 'string' ||
    typeof commitSha !== 'string' ||
    !/^[0-9a-f]{40}$/i.test(previousSha) ||
    !/^[0-9a-f]{40}$/i.test(commitSha)
  ) {
    return null;
  }

  try {
    const output = execFileSync(
      'git',
      ['diff', '--name-only', '-z', '--no-renames', previousSha, commitSha],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return output.split('\0').filter(Boolean);
  } catch {
    // Missing history or a failed diff must never suppress a deployment.
    return null;
  }
}

function run() {
  const changedFiles = readChangedFiles(
    process.env.VERCEL_GIT_PREVIOUS_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
  );

  if (changedFiles === null) {
    console.log('Vercel Git SHAs unavailable or diff failed; continue with build.');
    process.exitCode = 1;
    return;
  }

  if (shouldIgnoreBuild(changedFiles)) {
    console.log('Only documentation, tests, CI, or Anchor sources changed; skip web build.');
    process.exitCode = 0;
    return;
  }

  console.log('Web application or deployment configuration changed; continue with build.');
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run();
}
