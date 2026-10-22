#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/build.sh
mkdir -p demo/public
# A pinned Emscripten image makes the grammar's browser build reproducible.
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/src" \
  -w /src/tree-sitter-wirefilter emscripten/emsdk:4.0.15 \
  emcc -Os -s WASM=1 -s SIDE_MODULE=2 \
  -s EXPORTED_FUNCTIONS='["_tree_sitter_wirefilter"]' -fno-exceptions \
  -I src src/parser.c src/scanner.c -o /src/demo/public/tree-sitter-wirefilter.wasm
bash demo/formatter/prepare.sh
cargo build --locked --manifest-path demo/formatter/Cargo.toml \
  --target wasm32-unknown-unknown --release
wasm-bindgen --target web --out-dir demo/formatter/pkg \
  demo/formatter/target/wasm32-unknown-unknown/release/wirefilter_formatter.wasm
npm --prefix demo run build
