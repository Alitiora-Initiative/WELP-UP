#!/usr/bin/env bash
set -euo pipefail

# Solana 1.18.26's bundled Cargo predates Cargo edition-2024 manifest
# support. Keep the Anchor 0.30 / Solana 1.18 SBF graphs on releases that
# still parse with that Cargo version.
pin_if_present() {
  local manifest="$1"
  local package="$2"
  local current_version="$3"
  local target_version="$4"
  local lockfile
  lockfile="$(dirname "$manifest")/Cargo.lock"

  if awk -v wanted_name="$package" -v wanted_version="$current_version" '
    /^\[\[package\]\]$/ { name = ""; version = "" }
    /^name = / {
      name = $0
      sub(/^name = "/, "", name)
      sub(/"$/, "", name)
    }
    /^version = / {
      version = $0
      sub(/^version = "/, "", version)
      sub(/"$/, "", version)
      if (name == wanted_name && version == wanted_version) found = 1
    }
    END { exit(found ? 0 : 1) }
  ' "$lockfile"; then
    cargo update --manifest-path "$manifest" \
      -p "$package@$current_version" --precise "$target_version"
  fi
}

for manifest in "$@"; do
  lockfile="$(dirname "$manifest")/Cargo.lock"
  if [[ ! -f "$lockfile" ]]; then
    echo "Expected Cargo.lock after metadata resolution: $lockfile" >&2
    exit 1
  fi

  # blake3 1.8.3+ requires constant_time_eq 0.4.2+, which uses edition 2024.
  pin_if_present "$manifest" blake3 1.8.7 1.8.2
  pin_if_present "$manifest" constant_time_eq 0.4.2 0.3.1

  # Recent base64ct and indexmap releases also switched to edition 2024.
  pin_if_present "$manifest" base64ct 1.8.3 1.7.3
  pin_if_present "$manifest" indexmap 2.14.2 2.11.4

  # Host Cargo may write lockfile v4. Solana 1.18's bundled Cargo needs v3.
  sed -i 's/^version = 4$/version = 3/' "$lockfile"
  grep -qx 'version = 3' "$lockfile"

  for forbidden in \
    'blake3 1.8.7' \
    'constant_time_eq 0.4.2' \
    'base64ct 1.8.3' \
    'indexmap 2.14.2'; do
    package="${forbidden% *}"
    version="${forbidden##* }"
    if awk -v package="$package" -v version="$version" '
      /^\[\[package\]\]$/ { found_name = 0; found_version = 0 }
      $0 == "name = \"" package "\"" { found_name = 1 }
      $0 == "version = \"" version "\"" { found_version = 1 }
      found_name && found_version { found = 1 }
      END { exit(found ? 0 : 1) }
    ' "$lockfile"; then
      echo "Incompatible package remains: $forbidden in $lockfile" >&2
      exit 1
    fi
  done
done
