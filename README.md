# Tree-sitter Wirefilter

A [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for [Cloudflare Wirefilter](https://github.com/cloudflare/wirefilter), with highlighting queries and an optional [Topiary](https://topiary.tweag.io/) formatter.

## Grammar

[`tree-sitter-wirefilter/`](tree-sitter-wirefilter/) contains the grammar, external scanner, generated C parser, highlight queries, and Rust bindings. It can be used independently of the formatter and demo.

```sh
npm ci --prefix tree-sitter-wirefilter
cd tree-sitter-wirefilter
npx tree-sitter test
npx tree-sitter parse ../fixtures/examples.wirefilter
```

In Rust, add `tree-sitter-wirefilter` as a path or Git dependency and load `tree_sitter_wirefilter::LANGUAGE` into a Tree-sitter parser. `HIGHLIGHTS_QUERY` exposes the bundled highlighting query. `cargo test` at the repository root tests just the grammar crate.

This is a syntax parser. Upstream Wirefilter remains the reference for field names, types, function arity, and rule validation. See [conformance](docs/conformance.md) for supported syntax, the pinned upstream revision, and intentional approximations.

## Optional formatter

[`topiary/`](topiary/) provides the `wirefilter-format` Rust library and `wirefilter-fmt` CLI. The parser and formatting query are embedded; installing the CLI needs Rust and a C compiler, with no Node.js, separate Topiary installation, or shared-library setup.

```sh
cargo install --path topiary --locked
printf '%s' 'http.host eq "example.com" and (enabled or trusted)' | wirefilter-fmt
# Or: wirefilter-fmt rule.wirefilter
```

```text
http.host eq "example.com"
and (
    enabled
    or trusted
)
```

The library entry point is `wirefilter_format::format(source)`. Formatting preserves the concrete tree and literal contents, rejects syntax errors, and checks idempotence. Boolean chains and nested expressions expand; simple expressions stay compact. There is no line-width setting.

## Development

Run `npm test` for parser, formatter, scanner, and conformance regressions. The Rust parser suite snapshots 408 upstream expression inputs; Tree-sitter’s own corpus covers focused tree regressions. See [development](docs/development.md) and [contributing](CONTRIBUTING.md).

The optional [browser demo](demo/) pairs a highlighted editor with automatically formatted, highlighted output. It includes syntax diagnostics, tree inspection, and editable formatting rules. [Try it online](https://wirefilter-playground.punkeel.workers.dev).

[MIT](LICENSE). Packages are currently used from this repository, not published to package registries.
