#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PWD/tree-sitter-wirefilter/node_modules/.bin:$PATH"
./scripts/build.sh
(cd tree-sitter-wirefilter && tree-sitter test)
cargo test --locked --workspace
node tests/scanner.mjs
node tests/conformance.mjs
node tests/format-properties.mjs
