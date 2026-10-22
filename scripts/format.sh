#!/usr/bin/env bash
# Validate the whole Tree-sitter tree, including MISSING nodes, before Topiary.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if (($# > 1)); then
  echo "Usage: $0 [file.wirefilter] (otherwise reads stdin; writes stdout)" >&2
  exit 2
fi
source_file="$(mktemp --suffix=.wirefilter)"
trap 'rm -f "$source_file"' EXIT
cat "${1:-/dev/stdin}" > "$source_file"
(cd "$ROOT/tree-sitter-wirefilter" && ./node_modules/.bin/tree-sitter parse --quiet "$source_file") >&2
topiary -C "$ROOT/topiary/languages.ncl" format --language wirefilter < "$source_file"
