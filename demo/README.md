# Browser demo

The browser uses the same grammar, highlighting query, formatting query, and formatter goldens as the native tools. The browser uses unmodified Topiary 0.6.1; the native crate uses 0.8.0. See the [version rationale](formatter/README.md).

From the repository root, install the grammar and demo dependencies, Docker, Clang with WebAssembly support, the Rust WASM target, and the matching wasm-bindgen CLI:

```sh
npm ci --prefix tree-sitter-wirefilter
npm ci --prefix demo
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100 --locked
npm run demo:build
npm --prefix demo run dev
```

The WASM build uses the pinned `emscripten/emsdk:4.0.15` Docker image. Docker must be running. The production build writes to the `demo/dist/` directory.

For browser tests, install Chromium once, then run the suite:

```sh
(cd demo && npx playwright install chromium)
npm run demo:test
```

`demo:test` rebuilds the native parser, both WASM modules, and the frontend before running Playwright. It cannot silently use an old browser parser. Hosts missing browser system libraries may also need Playwright's `install-deps chromium` command.

After a WASM build, frontend-only changes need only `npm --prefix demo run build`. Rebuild WASM after grammar, scanner, or Rust changes. Vite picks up formatting-query and highlighting-query edits directly. Keep `web-tree-sitter` at the pinned version: its compatibility with the Rust WASM bindings is deliberate.

### Playground behavior

The playground pairs a highlighted input editor with highlighted formatted output. Formatting runs on every edit and sample change. Syntax diagnostics include line/column locations; the syntax tree and formatter rules are collapsed by default. Expressions are limited to 20,000 characters, custom queries to 64,000, and tree display is bounded for deeply nested input.

**Formatter rules** lets you edit the Topiary query and choose 2-, 4-, or 8-space indentation. Query and indentation edits immediately update the formatted output and stay local to the page. Invalid input or rules clear the formatted output until corrected. On malformed input, quoted text stays visually intact while syntax diagnostics remain active; this does not add single-quoted strings to the language. **Reset rules** restores defaults without changing the expression. Invalid queries, non-idempotent output, syntax changes, and token changes report errors.

## Deploy to Cloudflare Workers

The public playground is at <https://wirefilter-playground.punkeel.workers.dev>.

The Worker serves static assets from `demo/dist/`; it needs no service secrets, database, or backend formatter. To deploy a copy, authenticate Wrangler with your Cloudflare account and set your Worker name in `demo/wrangler.jsonc`:

```sh
npm run demo:build
npm exec --yes --package=wrangler@4.151.3 -- wrangler deploy --config demo/wrangler.jsonc
```

The checked-in name is `wirefilter-playground`. Wrangler reports the deployed URL. Verify that the page loads and that highlighting, syntax diagnostics, and formatting work there.
