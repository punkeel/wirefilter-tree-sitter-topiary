# Wirefilter · Tree-sitter & Topiary

Syntax tooling for [Cloudflare's Wirefilter](https://github.com/cloudflare/wirefilter): a Tree-sitter grammar, a Topiary formatter, and a browser playground.

**[Try the playground →](https://wirefilter-playground.punkeel.workers.dev)** · [Development](docs/development.md) · [Conformance](docs/conformance.md) · [Contributing](CONTRIBUTING.md)

This companion project brings Wirefilter expressions into editors and formatting workflows. The upstream repository provides the language implementation and typed validation; this repository provides concrete syntax trees, highlighting queries, and formatting rules built against that language.

## See it in action

Turn this:

```text
http.request.method eq "GET" and (http.host eq "example.com" or ip.src in $office_ips)
```

Into this:

```text
http.request.method eq "GET"
and (
    http.host eq "example.com"
    or ip.src in $office_ips
)
```

Boolean chains get line breaks, nested boolean groups and calls get indentation, and simple expressions stay compact. Sets retain their input's multiline layout. Formatting is structural, with no line-width setting; literal contents and spellings are preserved.

## What's here

| Component | Purpose |
| --- | --- |
| [Tree-sitter grammar](tree-sitter-wirefilter/grammar.js) | Parse expressions into concrete syntax trees, with precedence and error recovery. |
| [Highlight queries](tree-sitter-wirefilter/queries/highlights.scm) | Identify fields, operators, functions, and literals for syntax highlighting. |
| [Topiary rules](topiary/queries/formatting.scm) | Format expressions using their syntax tree. |
| [Browser playground](demo/) | Explore highlighting, syntax errors, trees, and formatting using the actual engines in WebAssembly. |

The playground runs parsing and formatting locally in your browser. Open **Formatter rules** to edit the Topiary query and choose 2-, 4-, or 8-space indentation. The grammar stays fixed. Format with **Ctrl/⌘ + Shift + F**, inspect the result, or reset the rules to the repository defaults.

Both the checked CLI and the playground reject syntax errors, including missing tokens, and verify that formatting preserves the concrete tree and token contents. The playground also checks idempotence when you customize its rules.

## Use locally

From a checkout on Linux, with Node.js 22.12+ (or 20.19+), Rust/Cargo, and a C compiler:

```sh
npm ci --prefix tree-sitter-wirefilter
cargo install topiary-cli --version 0.8.0 --locked
npm run build

printf '%s' 'http.host eq "example.com" and not cf.client.bot' \
  | ./scripts/format.sh
```

Format a file to stdout:

```sh
./scripts/format.sh rule.wirefilter
```

Run the native parser and formatter tests with `npm test`. See the [development guide](docs/development.md) for the browser build, browser tests, Workers deployment, and platform notes. These packages currently run from a source checkout; they are not published npm packages.

## Relationship to upstream

[`cloudflare/wirefilter`](https://github.com/cloudflare/wirefilter) is the language reference. Tests in this repository pin an upstream revision and compare accepted and rejected expressions against its Rust parser. The [conformance contract](docs/conformance.md) records that revision, the test strategy, and intentional syntax approximations.

Supported syntax includes logical and comparison operators, regex and wildcard matching, membership and bitwise tests, function calls, indexes, sets, named lists, ranges, IP/CIDR forms, and quoted and raw strings. Wirefilter has no comments or commas in sets, and tabs are only accepted inside string contents.

**A valid syntax tree does not mean a valid Wirefilter rule.** Field names, types, function arity, numeric bounds, IP validity, regex compilation, and other Scheme-dependent checks belong to upstream Wirefilter. Some syntax is ambiguous without type information, and function arguments have a documented approximation. Use upstream's `Scheme` to validate expressions before using them as rules.

## Contributing

Parser fixes, formatting examples, editor integrations, and upstream conformance cases are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md); [AGENTS.md](AGENTS.md) records the repository's development and validation rules.

## License

[MIT](LICENSE). Vendored dependencies retain their own license notices in [demo/formatter/vendor](demo/formatter/vendor/).
