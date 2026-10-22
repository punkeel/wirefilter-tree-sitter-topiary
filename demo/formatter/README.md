# Browser formatter adapter

The demo uses unmodified crates.io releases: Topiary 0.6.1, wasm-bindgen
0.2.100, and web-tree-sitter 0.20.8. Cargo.lock pins their dependencies.
The native formatter remains on Topiary 0.8.0. Both use the same formatting
query, and browser tests compare exact goldens and generated cases against
native output.

Upstream [documents that its web playground has diverged from current releases](https://github.com/topiary/topiary/blob/01261964a42297c37cb91adf0cf2dab0a95e187b/docs/book/src/playground/web.md).
Its [standalone playground](https://github.com/topiary/playground/tree/39cdd5dfa9146e5dc43d84e7d1d17195adbf13dd)
uses 0.5.1, which normalizes whitespace inside multiline literals. We use
0.6.1 because it preserves those literals and passes our browser regressions.
Versions 0.7.3 and 0.8.0 reference APIs absent from their WASM facades.

Topiary 0.6.1 has a transitive native Tree-sitter dependency even on WASM.
`demo/build.sh` supplies Clang with C headers from the same pinned Emscripten
image used to build the grammar. No vendored source, patches, or separate
dependency download scripts are needed. The wasm-bindgen CLI must match 0.2.100.
