# Wirefilter playground, Tree-sitter grammar, and Topiary formatter

A syntax-oriented parser and formatter for [Cloudflare Wirefilter](https://github.com/cloudflare/wirefilter), with a browser playground for highlighting, syntax diagnostics, tree inspection, and formatting. The demo runs the real Tree-sitter and Topiary engines locally in WebAssembly; expressions are not sent to a formatting server.

## Develop and test

Requirements: Node.js 22.12+ (or 20.19+), a C compiler, and Rust/Cargo. Install the pinned tools:

```sh
npm ci --prefix tree-sitter-wirefilter
cargo install topiary-cli --version 0.8.0 --locked
npm test
```

`npm test` regenerates and builds the parser, runs the Tree-sitter corpus, parses the example fixtures, and checks formatter goldens, idempotence, and preservation of tree structure and leaf tokens. Generated parser sources are committed; binaries and build caches are ignored. The grammar uses ABI 14 for compatibility with the pinned browser runtime.

Format an expression:

```sh
./scripts/build.sh
printf 'http.request.method eq "GET" and ip.src in {192.0.2.0/24 10.0.0.1}' \
  | ./scripts/format.sh
```

For checked formatting of a file, run `./scripts/format.sh file.wirefilter` (writes stdout). The wrapper checks both ERROR and MISSING nodes before calling Topiary: Topiary 0.8 alone can accept incomplete trees with missing delimiters.

For known-valid files, native Topiary can also format in place:

```sh
topiary -C topiary/languages.ncl format fixtures/examples.wirefilter
```

The local Topiary registration resolves the shared library relative to `topiary/languages.ncl`. The build script targets Linux (`wirefilter.so`); macOS/Windows need the platform library suffix and a corresponding configuration change.

## Browser demo

The browser uses the repository's grammar, highlighting query, and formatting query. Topiary 0.8.0 is compiled to WebAssembly with small, documented compatibility patches in `demo/formatter/vendor/`. Native and browser output are compared against the same golden files. The demo test command rebuilds both WASM modules and the frontend before running Playwright, so it cannot silently use an old build. Boolean operators (`and`, `or`, `xor`, and their symbolic aliases) always begin a new line, even when the input is one line. Boolean groups and calls with boolean-chain arguments expand with four-space indentation. Simple expressions, calls, and groups stay compact; sets retain their input multiline structure. Literal contents are never reflowed. This is a structural formatting policy, not line-width-driven wrapping.

Building both WASM modules requires Docker, the Rust WASM target, and a matching wasm-bindgen CLI:

```sh
npm ci --prefix demo
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.126 --locked
npm run demo:build
npm run demo:test  # rebuilds both WASM modules; first: cd demo && npx playwright install chromium
npm --prefix demo run dev
```

The build uses the pinned `emscripten/emsdk:4.0.15` image. After a WASM build, frontend-only edits need only `npm --prefix demo run build`. Rebuild WASM after grammar, scanner, or Rust changes. Formatting-query and highlighting-query edits are picked up by Vite directly.

The demo includes samples, live syntax errors with line/column locations, a tree with field labels and operators, keyboard formatting (`Ctrl/⌘ + Shift + F`), and copying of output. Syntax errors prevent formatting. Input is limited to 20,000 characters; the tree display is bounded for deeply nested expressions.

For example, `http.request.method eq "GET" and (http.host eq "example.com" or ip.src in $office_ips)` becomes:

```text
http.request.method eq "GET"
and (
    http.host eq "example.com"
    or ip.src in $office_ips
)
```

## Workers hosting

`.openai/hosting.json` records the Sites deployment, which serves `dist` on Cloudflare Workers. The same static output can be deployed to your own Cloudflare account using `demo/wrangler.jsonc`:

```sh
npm run demo:build
cd demo
npx wrangler deploy
```

No service secrets, database, or backend formatter are required.

## Syntax and limits

The grammar follows the upstream Rust lexers and AST parsers under `engine/src/ast`, `engine/src/types.rs`, `engine/src/rhs_types`, and `engine/src/scheme.rs`. It supports:

- Logical operators `and`/`&&`, `xor`/`^^`, `or`/`||`, and `not`/`!`, with upstream precedence.
- Comparison operators, `contains`, regex matching, wildcards, membership, and bitwise tests.
- Fields, function calls, `any(...)`/`all(...)`, indexes and `[*]`.
- Whitespace-separated sets, named lists, integer/IP ranges, IP/CIDR, integers, and byte strings.
- Quoted strings and hash-balanced raw strings without rewriting literal contents.

This is a **syntax parser**, not Wirefilter's schema-dependent Rust validator. It does not resolve field names or check types, function arity, integer overflow, valid IP addresses, regex compatibility, or the `Array(Bool)` requirement for quantifiers. Colon-separated bytes and some IPv6 forms are lexically ambiguous without type information. Some forms accepted by this grammar require rejection by Wirefilter's `Scheme`; do not use a green syntax status as a security-policy validation result.

Wirefilter has no comments, no commas in literal sets, and no tab whitespace. Tabs inside string contents are preserved. Tree-sitter trees are concrete syntax trees rather than the typed AST produced by Wirefilter.

## Repository map

- `AGENTS.md`: contributor/agent instructions and validation expectations.
- `tree-sitter-wirefilter/`: grammar, scanner, generated parser, highlight query, and corpus.
- `topiary/`: local registration and formatting policy.
- `fixtures/`: representative expressions.
- `tests/`: exact formatting inputs and expected output.
- `scripts/`: build and native test entry points.
- `demo/`: browser UI, WASM bindings, browser tests, and Workers configuration.
