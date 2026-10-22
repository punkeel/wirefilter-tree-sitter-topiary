#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/build.sh
mkdir -p demo/public demo/formatter/target/sysroot
# One pinned SDK builds the grammar and supplies C headers for Topiary's
# transitive tree-sitter crate. Dependency sources remain unmodified.
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/src" \
  -w /src/tree-sitter-wirefilter emscripten/emsdk:4.0.15 bash -ec '
  emcc -Os -s WASM=1 -s SIDE_MODULE=2 \
    -s EXPORTED_FUNCTIONS="[\"_tree_sitter_wirefilter\"]" -fno-exceptions \
    -I src src/parser.c src/scanner.c -o /src/demo/public/tree-sitter-wirefilter.wasm
  cp -a /emsdk/upstream/emscripten/cache/sysroot/include /src/demo/formatter/target/sysroot/
'
CFLAGS_wasm32_unknown_unknown="--sysroot=$PWD/demo/formatter/target/sysroot" \
  cargo build --locked --manifest-path demo/formatter/Cargo.toml \
  --target wasm32-unknown-unknown --release
wasm-bindgen --target web --out-dir demo/formatter/pkg \
  demo/formatter/target/wasm32-unknown-unknown/release/wirefilter_formatter.wasm
npm --prefix demo run build
