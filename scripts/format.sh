#!/usr/bin/env bash
# Validate the whole Tree-sitter tree, including MISSING nodes, before Topiary.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if (($# > 1)); then
  echo "Usage: $0 [file.wirefilter] (otherwise reads stdin; writes stdout)" >&2
  exit 2
fi
directory="$(mktemp -d)"
trap 'rm -rf "$directory"' EXIT
source_file="$directory/input.wirefilter"
if (($#)); then
  cat -- "$1" > "$source_file"
else
  cat > "$source_file"
fi
if ! parse_tree="$(cd "$ROOT/tree-sitter-wirefilter" && ./node_modules/.bin/tree-sitter parse "$source_file")"; then
  printf '%s\n' "$parse_tree" >&2
  exit 1
fi
if [[ "$parse_tree" == *"(ERROR"* || "$parse_tree" == *"(MISSING"* ]]; then
  printf '%s\n' "$parse_tree" >&2
  exit 1
fi
topiary -C "$ROOT/topiary/languages.ncl" format --language wirefilter \
  < "$source_file" > "$directory/output.wirefilter"
# Validate the result and compare all named/anonymous nodes, fields and token
# spellings. Keep output private until the check succeeds, as in the browser.
(cd "$ROOT/tree-sitter-wirefilter" && ./node_modules/.bin/tree-sitter parse \
  --cst --no-ranges "$source_file") > "$directory/before.cst"
(cd "$ROOT/tree-sitter-wirefilter" && ./node_modules/.bin/tree-sitter parse \
  --cst --no-ranges "$directory/output.wirefilter") > "$directory/after.cst"
if ! cmp -s "$directory/before.cst" "$directory/after.cst"; then
  echo 'Formatting changed expression syntax or token contents.' >&2
  exit 1
fi
cat "$directory/output.wirefilter"
