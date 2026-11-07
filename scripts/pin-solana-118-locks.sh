#!/usr/bin/env bash
set -euo pipefail

# Keep Pyth's broad solana-program >=1.13 range on the workspace's pinned
# Solana 1.18 line. Newer Solana 2.x pulls incompatible Borsh/Syn types into
# Anchor 0.30.1 and the Solana 1.18 SBF toolchain.
for manifest in "$@"; do
  cargo metadata --manifest-path "$manifest" --format-version 1 >/dev/null
  lockfile="$(dirname "$manifest")/Cargo.lock"
  [[ -f "$lockfile" ]] || {
    echo "Cargo did not create expected lockfile: $lockfile" >&2
    exit 1
  }

  versions="$(
    awk '
      /^\[\[package\]\]$/ { package = ""; version = "" }
      /^name = "solana-program"$/ { package = "solana-program" }
      package == "solana-program" && /^version = / {
        gsub(/"/, "", $3); print $3; package = ""
      }
    ' "$lockfile" | sort -u
  )"

  for version in $versions; do
    if [[ "$version" != "1.18.26" ]]; then
      cargo update --manifest-path "$manifest" \
        -p "solana-program@$version" --precise 1.18.26
    fi
  done

  remaining="$(
    awk '
      /^\[\[package\]\]$/ { package = ""; version = "" }
      /^name = "solana-program"$/ { package = "solana-program" }
      package == "solana-program" && /^version = / {
        gsub(/"/, "", $3); print $3; package = ""
      }
    ' "$lockfile" | sort -u
  )"
  if [[ "$remaining" != "1.18.26" ]]; then
    echo "Unexpected Solana program versions after pinning for $manifest: $remaining" >&2
    exit 1
  fi
done
