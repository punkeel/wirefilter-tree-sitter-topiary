#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
checksum=958195c18d04f21aefbb0961313d11328f197c00883cbf6023a14d119b19818f
archive=target/topiary-core-0.8.0.crate
mkdir -p target vendor
if [[ ! -f "$archive" ]]; then
  curl --fail --location --retry 3 https://static.crates.io/crates/topiary-core/topiary-core-0.8.0.crate -o "$archive.tmp"
  mv "$archive.tmp" "$archive"
fi
printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --status
patch_hash="$(sha256sum topiary-core.patch)"
if [[ -f vendor/topiary-core/.patched ]] && [[ "$(cat vendor/topiary-core/.patched)" == "$checksum $patch_hash" ]]; then
  exit 0
fi
stage="$(mktemp -d target/topiary-core.XXXXXX)"
trap 'rm -rf "$stage"' EXIT
tar -xzf "$archive" --strip-components=1 -C "$stage"
patch --batch --fuzz=0 -d "$stage" -p1 < topiary-core.patch
printf '%s\n' "$checksum $patch_hash" > "$stage/.patched"
rm -rf vendor/topiary-core
mv "$stage" vendor/topiary-core
