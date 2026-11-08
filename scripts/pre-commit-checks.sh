#!/usr/bin/env sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

fail() {
  printf '\nPRE-COMMIT BLOCKED: %s\n' "$1" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js 24+ is required."
command -v npm >/dev/null 2>&1 || fail "npm is required."
command -v cargo >/dev/null 2>&1 || fail "Rust/Cargo is required for the on-chain workspace."
if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  fail "Python 3 is required for the repository test suite."
fi

[ -d node_modules ] || fail "Dependencies are missing. Run npm ci first."

printf '\n== JavaScript quality ==\n'
npm run lint
npm run typecheck
npm run test:notifications
npm run test:vault-client
npm run test:charts
npm run test:security
npm run test:agent
npm run test:program-gates
npm run test:market-scoring
npm run test:fees
npm run test:launchpad-config
npm run test:vercel-deploy-gate
npm run test:git-hooks
npm run build

printf '\n== Python tests ==\n'
"$PYTHON" -m unittest discover -s tests -v

printf '\n== Rust formatting ==\n'
cargo fmt --check --manifest-path programs/vault-checks/Cargo.toml
cargo fmt --check --manifest-path programs/vault/Cargo.toml
cargo fmt --check --manifest-path programs/launchpad/Cargo.toml
cargo fmt --check --manifest-path programs/program-tests/Cargo.toml

printf '\n== Rust static analysis and tests ==\n'
cargo clippy --manifest-path programs/vault-checks/Cargo.toml -- -D warnings
cargo clippy --manifest-path programs/vault/Cargo.toml -- -D warnings
cargo test --manifest-path programs/vault-checks/Cargo.toml
cargo fmt --check --manifest-path programs/program-tests/Cargo.toml
cargo check --manifest-path programs/program-tests/Cargo.toml --tests
cargo clippy --manifest-path programs/launchpad/Cargo.toml -- -D warnings
cargo test --lib --manifest-path programs/launchpad/Cargo.toml

printf '\nPRE-COMMIT PASSED: all configured local checks completed.\n'
