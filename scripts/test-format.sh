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

parse_xml() {
  local source="$1"
  local xml="$2"
  local diagnostics="$xml.stderr"

  if ! (cd "$ROOT/tree-sitter-wirefilter" && "$TREE_SITTER_BIN" parse --xml "$source") \
    >"$xml" 2>"$diagnostics"; then
    cat "$diagnostics" >&2
    cat "$xml" >&2
    return 1
  fi
  if rg -q '<(ERROR|MISSING)([ >])' "$xml"; then
    echo "parse tree contains ERROR/MISSING for $source" >&2
    cat "$xml" >&2
    return 1
  fi
}

compare_ast_and_tokens() {
  python3 - "$1" "$2" <<'PY'
import sys
import xml.etree.ElementTree as ET


def signature(path):
    root = ET.parse(path).getroot()
    shape = []
    tokens = []

    def visit(node):
        if node.tag in {"ERROR", "MISSING"}:
            raise AssertionError(f"{node.tag} in {path}")
        shape.append(("open", node.tag, node.attrib.get("field", "")))
        children = list(node)
        if not children:
            tokens.append(node.text or "")
        for child in children:
            visit(child)
        shape.append(("close", node.tag, ""))

    visit(root)
    return shape, tokens


before_shape, before_tokens = signature(sys.argv[1])
after_shape, after_tokens = signature(sys.argv[2])
if before_shape != after_shape:
    raise SystemExit("AST shape changed during formatting")
if before_tokens != after_tokens:
    raise SystemExit(
        "leaf tokens changed during formatting:\n"
        f"before={before_tokens!r}\nafter={after_tokens!r}"
    )
PY
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
  input_xml="$tmpdir/$(basename "$stem").input.xml"
  output_xml="$tmpdir/$(basename "$stem").output.xml"

  [[ -f "$expected" ]] || { echo "missing golden output: $expected" >&2; exit 1; }
  parse_xml "$input" "$input_xml"

  "$TOPIARY_BIN" -C "$ROOT/topiary/languages.ncl" format --language wirefilter \
    <"$input" >"$once"
  diff -u "$expected" "$once"

  parse_xml "$once" "$output_xml"
  compare_ast_and_tokens "$input_xml" "$output_xml"

  "$TOPIARY_BIN" -C "$ROOT/topiary/languages.ncl" format --language wirefilter \
    <"$once" >"$twice"
  diff -u "$once" "$twice"

  echo "PASS $(basename "$input")"
done
