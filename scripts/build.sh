#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PWD/tree-sitter-wirefilter/node_modules/.bin:$PATH"
cd tree-sitter-wirefilter
tree-sitter generate --abi 14
tree-sitter build --output wirefilter.so
