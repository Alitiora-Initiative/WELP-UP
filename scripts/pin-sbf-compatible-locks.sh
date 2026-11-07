#!/usr/bin/env bash
set -euo pipefail

# Solana 1.18.26's bundled Cargo is 1.75. Newer transitive releases used by
# the Anchor/Solana graph can declare edition2024, which that Cargo cannot
# parse. Resolve dependencies using host Cargo first, then constrain the SBF
# lockfiles to the last compatible releases documented by the Solana toolchain.
#
# Run after cargo metadata has created each deployable program's Cargo.lock and
# before cargo-build-sbf/anchor build consumes it.

pin_if_present() {
  local manifest="$1"
  local package="$2"
  local version="$3"
  local lockfile
  lockfile="$(dirname "$manifest")/Cargo.lock"

  if ! grep -q "^name = \"$package\"$" "$lockfile"; then
    return 0
  fi

  local current_versions
  current_versions="$(
    awk -v wanted="$package" '
      /^\[\[package\]\]$/ { package = ""; version = "" }
      $0 == "name = \"" wanted "\"" { package = wanted }
      package == wanted && /^version = / {
        gsub(/"/, "", $3); print $3; package = ""
      }
    ' "$lockfile" | sort -u
  )"

  for current in $current_versions; do
    if [[ "$current" != "$version" ]]; then
      cargo update --manifest-path "$manifest" \
        -p "$package@$current" --precise "$version"
    fi
  done
}

for manifest in "$@"; do
  lockfile="$(dirname "$manifest")/Cargo.lock"
  if [[ ! -f "$lockfile" ]]; then
    echo "Missing Cargo.lock for $manifest; run cargo metadata first." >&2
    exit 1
  fi

  # blake3 1.8.3+ uses constant_time_eq 0.4.2+, whose manifest requires the
  # Cargo edition2024 feature. Pin both to the compatible 1.8.2 / 0.3.1 pair.
  pin_if_present "$manifest" blake3 1.8.2
  pin_if_present "$manifest" constant_time_eq 0.3.1

  # These packages can also resolve to edition2024 releases through modern
  # proc-macro/TOML dependency chains. Pin only when present in this lockfile.
  pin_if_present "$manifest" base64ct 1.7.3
  pin_if_present "$manifest" indexmap 2.11.4

  # Fail closed if any known incompatible version remains.
  if grep -q 'name = "blake3"' "$lockfile"; then
    grep -A2 'name = "blake3"' "$lockfile" | grep -q 'version = "1.8.2"' || {
      echo "blake3 was not pinned to 1.8.2 for $manifest" >&2
      exit 1
    }
  fi
  if grep -q 'name = "constant_time_eq"' "$lockfile"; then
    grep -A2 'name = "constant_time_eq"' "$lockfile" | grep -q 'version = "0.3.1"' || {
      echo "constant_time_eq was not pinned to 0.3.1 for $manifest" >&2
      exit 1
    }
  fi
done
