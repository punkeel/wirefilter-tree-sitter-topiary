# Development

The grammar is the primary package. The formatter is an optional Rust crate; the browser demo has its own build and dependencies.

## Grammar

Install Node.js 22.12+ (or 20.19+), Rust/Cargo, and a C compiler. From the repository root:

```sh
npm ci --prefix tree-sitter-wirefilter
npm run build
cargo test
```

Edit `tree-sitter-wirefilter/grammar.js` and `src/scanner.c`, then regenerate with `npm run build`. Generated C sources are committed; binaries and caches are ignored. The parser uses ABI 14 for the browser runtime. Rust builds compile the committed C sources without Node.js.

`npm run build` also builds a Linux shared library for the optional `topiary/languages.ncl` registration. The Rust crates embed the parser and do not use that library.

## Formatter and integration tests

```sh
cargo test --workspace --locked
cargo install --path topiary --locked
npm test
```

`npm test` runs the Tree-sitter corpus, Rust tests, scanner boundary cases, offline upstream conformance fixtures, and generated formatting cases. Exact formatter goldens live under `tests/`; both native and browser formatting use them. The formatter checks syntax, idempotence, and concrete-tree/token preservation before returning output.

The offline conformance fixtures run against Tree-sitter. To verify their expectations against upstream's Rust implementation, run the separate `npm run test:upstream` command described in [conformance](conformance.md).

## Demo

See [demo/README.md](../demo/README.md) for WASM prerequisites, browser tests, and Workers deployment. Demo tooling is not required to use either Rust crate.
