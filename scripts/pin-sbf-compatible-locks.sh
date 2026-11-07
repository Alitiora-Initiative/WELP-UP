#!/usr/bin/env bash
set -euo pipefail

# Solana 1.18.26's bundled Cargo is 1.75 and cannot parse manifests that
# require Cargo edition-2024 support. Keep known transitive packages on
# compatible releases before cargo-build-sbf reads the generated lockfiles.

package_version_exists() {
  local lockfile="$1"
  local package="$2"
  local version="$3"

  awk -v wanted_name="$package" -v wanted_version="$version" '
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
  ' "$lockfile"
}

pin_if_present() {
  local manifest="$1"
  local package="$2"
  local current_version="$3"
  local target_version="$4"
  local lockfile
  lockfile="$(dirname "$manifest")/Cargo.lock"

  if package_version_exists "$lockfile" "$package" "$current_version"; then
    cargo update --manifest-path "$manifest" \
      -p "$package@$current_version" --precise "$target_version"
  fi
}

for manifest in "$@"; do
  lockfile="$(dirname "$manifest")/Cargo.lock"
  if [[ ! -f "$lockfile" ]]; then
    echo "Missing Cargo.lock for $manifest; run cargo metadata first." >&2
    exit 1
  fi

  # Borsh 1.8.1 requires Rust 1.77. Keep Solana's Borsh 1.x graph
  # on 1.5.7 / matching derive (MSRV 1.67).
  pin_if_present "$manifest" borsh 1.8.1 1.5.7
  pin_if_present "$manifest" borsh-derive 1.8.1 1.5.7

  # borsh-derive 1.5.7 allows proc-macro-crate 3.x. Pin away from 3.5.0
  # (MSRV 1.82, toml_edit 0.25) to 3.2.0 (toml_edit 0.22).
  pin_if_present "$manifest" proc-macro-crate 3.5.0 3.2.0

  # blake3 1.8.3+ pulls constant_time_eq 0.4.2+, both edition-2024-only.
  pin_if_present "$manifest" blake3 1.8.7 1.8.2
  pin_if_present "$manifest" constant_time_eq 0.4.2 0.3.1

  # Newer crypto/TOML transitive releases also exceed the bundled Cargo.
  pin_if_present "$manifest" base64ct 1.8.3 1.7.3
  # Keep only the incompatible indexmap 2.x release constrained; indexmap 1.x
  # may be needed by unrelated host-side transitive dependencies.
  pin_if_present "$manifest" indexmap 2.14.2 2.11.4

  sed -i 's/^version = 4$/version = 3/' "$lockfile"
  grep -qx 'version = 3' "$lockfile"

  for entry in \
    "blake3:1.8.7" \
    "constant_time_eq:0.4.2" \
    "base64ct:1.8.3" \
    "indexmap:2.14.2" \
    "proc-macro-crate:3.5.0" \
    "borsh:1.8.1" \
    "borsh-derive:1.8.1"; do
    package="${entry%%:*}"
    version="${entry##*:}"
    if package_version_exists "$lockfile" "$package" "$version"; then
      echo "Incompatible package remains: $package $version in $lockfile" >&2
      exit 1
    fi
  done
done
