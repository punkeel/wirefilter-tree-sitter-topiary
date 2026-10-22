# Development

Run commands from the repository root unless shown otherwise.

## Native parser and formatter

Requirements: Linux, Node.js 22.12+ (or 20.19+), a C compiler, and Rust/Cargo.

```sh
npm ci --prefix tree-sitter-wirefilter
cargo install topiary-cli --version 0.8.0 --locked
npm test
```

`npm test` regenerates and builds the parser, runs the Tree-sitter corpus, parses the example fixtures, and checks exact formatter goldens, idempotence, and concrete-tree/token preservation. It also runs generated formatting cases, scanner boundary tests, checked-CLI regression tests, and offline upstream conformance fixtures.

Generated parser sources are committed; binaries and build caches are ignored. The grammar uses ABI 14 for compatibility with the pinned browser runtime. The build script targets Linux (`wirefilter.so`); macOS and Windows require a platform-specific shared-library suffix and a corresponding change to `topiary/languages.ncl`.

The checked formatter reads a file or stdin and writes stdout:

```sh
./scripts/format.sh fixtures/examples.wirefilter
printf '%s' 'http.host eq "example.com"' | ./scripts/format.sh
```

Use this wrapper for unvalidated input. It rejects both `ERROR` and `MISSING` nodes, then verifies the formatted tree and token spellings before emitting output. Topiary 0.8 alone can accept incomplete trees with missing delimiters.

For known-valid files, native Topiary can also format in place:

```sh
topiary -C topiary/languages.ncl format fixtures/examples.wirefilter
```

The local registration resolves the parser shared library relative to `topiary/languages.ncl`. See [conformance](conformance.md) for the separate `npm run test:upstream` check against the pinned Rust implementation.

## Browser playground

The browser uses the same grammar, highlighting query, formatting query, and formatter goldens as the native tools. Topiary 0.8.0 is compiled to WebAssembly with documented compatibility patches in `demo/formatter/vendor/`.

In addition to the native prerequisites, install Docker, the Rust WASM target, and the matching wasm-bindgen CLI:

```sh
npm ci --prefix demo
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.126 --locked
npm run demo:build
npm --prefix demo run dev
```

The grammar build uses the pinned `emscripten/emsdk:4.0.15` Docker image. Docker must be running. The production build writes to the root `dist/` directory.

For browser tests, install Chromium once, then run the suite:

```sh
(cd demo && npx playwright install chromium)
npm run demo:test
```

`demo:test` rebuilds the native parser, both WASM modules, and the frontend before running Playwright. It cannot silently use an old browser parser. Hosts missing browser system libraries may also need Playwright's `install-deps chromium` command.

After a WASM build, frontend-only changes need only `npm --prefix demo run build`. Rebuild WASM after grammar, scanner, or Rust changes. Vite picks up formatting-query and highlighting-query edits directly. Keep `web-tree-sitter` at the pinned version: its compatibility with the Rust WASM bindings is deliberate.

### Playground behavior

The UI includes samples, syntax diagnostics with line/column locations, a concrete syntax tree with field labels and operators, copying, and keyboard formatting with **Ctrl/⌘ + Shift + F**. Expressions are limited to 20,000 characters, custom queries to 64,000, and tree display is bounded for deeply nested input.

**Formatter rules** lets you edit the Topiary query and choose 2-, 4-, or 8-space indentation. Rule edits apply to the next Format action and stay local to the page. **Reset rules** restores defaults without changing the expression. Invalid queries, non-idempotent output, syntax changes, and token changes report errors.

## Deploy to Cloudflare Workers

The public playground is at <https://wirefilter-playground.punkeel.workers.dev>.

The Worker serves static assets from `dist/`; it needs no service secrets, database, or backend formatter. To deploy a copy, authenticate Wrangler with your Cloudflare account and set your Worker name in `demo/wrangler.jsonc`:

```sh
npm run demo:build
npm exec --yes --package=wrangler@4.151.3 -- wrangler deploy --config demo/wrangler.jsonc
```

The checked-in name is `wirefilter-playground`. Wrangler reports the deployed URL. Verify that the page loads and that highlighting, syntax diagnostics, and formatting work there.

## Repository map

| Path | Contents |
| --- | --- |
| `tree-sitter-wirefilter/` | Grammar, external scanner, generated parser, highlight query, and parser corpus. |
| `topiary/` | Local language registration and formatting policy. |
| `fixtures/` | Representative expressions. |
| `tests/` | Formatter goldens, generated cases, scanner checks, and upstream conformance fixtures. |
| `scripts/` | Build, formatting, and test entry points. |
| `demo/` | Browser UI, WASM bindings, browser tests, and Workers configuration. |
