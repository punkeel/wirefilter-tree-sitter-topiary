#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../tree-sitter-wirefilter"
tree-sitter generate
tree-sitter build --output wirefilter.so
