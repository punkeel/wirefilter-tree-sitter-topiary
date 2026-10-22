#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PWD/tree-sitter-wirefilter/node_modules/.bin:$PATH"
./scripts/build.sh
(cd tree-sitter-wirefilter && tree-sitter test)
./scripts/smoke.sh
./scripts/test-format.sh

./scripts/test-invalid.sh
node tests/scanner.mjs
node tests/conformance.mjs

node tests/checked-format.mjs
node tests/format-properties.mjs
