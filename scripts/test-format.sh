#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TOPIARY_BIN="${TOPIARY_BIN:-$(command -v topiary || true)}"
TREE_SITTER_BIN="${TREE_SITTER_BIN:-$ROOT/tree-sitter-wirefilter/node_modules/.bin/tree-sitter}"

if [[ -z "$TOPIARY_BIN" || ! -x "$TOPIARY_BIN" ]]; then
  echo "topiary-cli 0.8.0 is required (set TOPIARY_BIN to its path)" >&2
  exit 1
fi
if [[ "$("$TOPIARY_BIN" --version)" != "topiary-cli 0.8.0" ]]; then
  echo "expected topiary-cli 0.8.0, got: $("$TOPIARY_BIN" --version)" >&2
  exit 1
fi
if [[ ! -x "$TREE_SITTER_BIN" ]]; then
  echo "tree-sitter CLI not found: $TREE_SITTER_BIN" >&2
  exit 1
fi
if [[ ! -f "$ROOT/tree-sitter-wirefilter/wirefilter.so" ]]; then
  echo "generated grammar not found: $ROOT/tree-sitter-wirefilter/wirefilter.so" >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# The CST includes anonymous operators and punctuation, unlike the named-tree
# XML walker. Omitting ranges lets us compare every node/field/token while
# allowing whitespace changes. Literal contents are still in the CST output.
parse_cst() {
  local source="$1"
  local output="$2"
  if ! (cd "$ROOT/tree-sitter-wirefilter" && "$TREE_SITTER_BIN" parse --cst --no-ranges "$source") \
    >"$output" 2>"$output.stderr"; then
    cat "$output.stderr" "$output" >&2
    return 1
  fi
}

shopt -s nullglob
inputs=("$ROOT"/tests/format-*.input.wirefilter)
if ((${#inputs[@]} == 0)); then
  echo "no formatter golden inputs found" >&2
  exit 1
fi

for input in "${inputs[@]}"; do
  stem="${input%.input.wirefilter}"
  expected="$stem.expected.wirefilter"
  once="$tmpdir/$(basename "$stem").once.wirefilter"
  twice="$tmpdir/$(basename "$stem").twice.wirefilter"
  input_cst="$tmpdir/$(basename "$stem").input.cst"
  output_cst="$tmpdir/$(basename "$stem").output.cst"

  [[ -f "$expected" ]] || { echo "missing golden output: $expected" >&2; exit 1; }
  parse_cst "$input" "$input_cst"

  "$TOPIARY_BIN" -C "$ROOT/topiary/languages.ncl" format --language wirefilter \
    <"$input" >"$once"
  diff -u "$expected" "$once"

  parse_cst "$once" "$output_cst"
  diff -u "$input_cst" "$output_cst"

  "$TOPIARY_BIN" -C "$ROOT/topiary/languages.ncl" format --language wirefilter \
    <"$once" >"$twice"
  diff -u "$once" "$twice"

  echo "PASS $(basename "$input")"
done
