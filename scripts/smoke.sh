#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/build.sh

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

for file in fixtures/*.wirefilter; do
  echo "Checking $file"
  input_tree="$(cd tree-sitter-wirefilter && tree-sitter parse "../$file")"
  if grep -Eq '(ERROR|MISSING)' <<<"$input_tree"; then
    printf '%s\n' "$input_tree" >&2
    exit 1
  fi

  topiary -C topiary/languages.ncl format --language wirefilter \
    < "$file" > "$tmpdir/once.wirefilter"
  topiary -C topiary/languages.ncl format --language wirefilter \
    < "$tmpdir/once.wirefilter" > "$tmpdir/twice.wirefilter"
  diff -u "$tmpdir/once.wirefilter" "$tmpdir/twice.wirefilter"

  output_tree="$(cd tree-sitter-wirefilter && tree-sitter parse "$tmpdir/once.wirefilter")"
  if grep -Eq '(ERROR|MISSING)' <<<"$output_tree"; then
    printf '%s\n' "$output_tree" >&2
    exit 1
  fi
  echo "  PASS"
done
