#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cases="$root/tests/upstream-conformance/cases.json"
upstream="${WIREFILTER_UPSTREAM:-}"

if [[ ! -d "$upstream/.git" ]]; then
  printf 'FAIL upstream checkout not found: %s\n' "$upstream" >&2
  printf 'Set WIREFILTER_UPSTREAM to a clean clone of the pinned repository.\n' >&2
  exit 1
fi

pinned_revision="$(node -e \
  'const fs = require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).upstream.revision)' \
  "$cases")"
actual_revision="$(git -C "$upstream" rev-parse HEAD)"

if [[ "$actual_revision" != "$pinned_revision" && "${WIREFILTER_UPSTREAM_ALLOW_REVISION:-0}" != 1 ]]; then
  printf 'FAIL upstream revision mismatch: expected %s, got %s\n' \
    "$pinned_revision" "$actual_revision" >&2
  printf 'Use the pinned checkout or set WIREFILTER_UPSTREAM_ALLOW_REVISION=1 for an audit.\n' >&2
  exit 1
fi

if [[ "${WIREFILTER_UPSTREAM_ALLOW_DIRTY:-0}" != 1 ]] &&
  { ! git -C "$upstream" diff --quiet || ! git -C "$upstream" diff --cached --quiet; }; then
  printf 'FAIL upstream checkout has uncommitted changes: %s\n' "$upstream" >&2
  printf 'Set WIREFILTER_UPSTREAM_ALLOW_DIRTY=1 only for a local audit.\n' >&2
  exit 1
fi

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/wirefilter-upstream-conformance.XXXXXX")"
trap 'rm -rf "$temp_dir"' EXIT
manifest="$temp_dir/Cargo.toml"

printf '%s\n' \
  '[package]' \
  'name = "wirefilter-upstream-conformance"' \
  'version = "0.0.0"' \
  'edition = "2021"' \
  '' \
  '[[bin]]' \
  'name = "wirefilter-upstream-conformance"' \
  "path = \"$root/tests/upstream-conformance/verify.rs\"" \
  '' \
  '[dependencies]' \
  "wirefilter = { package = \"wirefilter-engine\", path = \"$upstream/engine\" }" \
  'serde = { version = "1", features = ["derive"] }' \
  'serde_json = "1"' \
  >"$manifest"

export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$root/target/upstream-conformance}"
cp "$root/tests/upstream-conformance/Cargo.lock" "$temp_dir/Cargo.lock"
cargo_args=(run --locked --quiet --manifest-path "$manifest")
if [[ "${WIREFILTER_CARGO_OFFLINE:-0}" == 1 ]]; then
  cargo_args+=(--offline)
fi

"${CARGO:-cargo}" "${cargo_args[@]}" -- "$cases"
