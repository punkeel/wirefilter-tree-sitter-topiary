# Upstream expression corpus

`cases.json` contains 408 distinct expression inputs from Cloudflare Wirefilter
at `f656cc5c04bc112977d949b6afd48c5ebe426ece`. Each input keeps its upstream
file, line, parser entry point, and outcome where observed. Duplicate inputs
share a case but retain their origins. Upstream example code is MIT licensed.

The inventory covers the README and Rustdoc example, all 15 benchmark filters,
engine filter/value/typed-expression tests (including finite generated loops),
FFI Rust and C examples, and the two fixed fuzz inputs. All 151 default-feature
engine unit tests were run during the import. Runtime tracing of the filter,
value, and typed-expression parser entry points closed gaps that literal
extraction missed: 168 distinct complete filter inputs and 379 distinct parser
inputs overall. The remaining 29 inputs come from the documentation,
benchmarks, FFI tests, and fixed fuzz examples.

There are deliberately no invented samples for the CLI/WASM inputs or the four
raw-string fuzz templates: those accept unbounded runtime data. Standalone
byte/IP/integer/token lexer fragments are not complete expressions and remain
covered by the existing scanner/conformance suites. This corpus pins the
current finite examples; it does not automatically discover future upstream
additions or claim exhaustive language coverage.

## Expectations

The Rust test parses every case and compares its concrete tree and every leaf
token with `trees.snap`. A snapshot block contains the JSON-escaped input, the
Tree-sitter S-expression, and `[kind, text]` leaf pairs. This preserves operators,
punctuation, Unicode, raw delimiters, escapes, and literal whitespace without
an additional snapshot dependency.

255 cases require a tree with neither ERROR nor missing nodes: 226 complete
expressions accepted by upstream's typed parsers and 29 reviewed static examples.
The remaining cases retain their observed syntax snapshots; they include
malformed input, accepted prefixes with trailing input, value-parser inputs,
and Scheme/type errors. An upstream rejection does **not** automatically imply
a syntax error. Some sources have both successful and rejected upstream
outcomes under different Schemes or parser limits.

## Running and updating

The normal test needs no upstream checkout or network access:

```sh
cargo test --locked -p tree-sitter-wirefilter --test upstream_examples
```

Verify recorded source locations against the pinned checkout:

```sh
WIREFILTER_UPSTREAM=/path/to/wirefilter \
  cargo test --locked -p tree-sitter-wirefilter --test upstream_examples \
  upstream_example_provenance_matches_checkout -- --ignored
```

When refreshing the corpus, audit the files and entry points listed above,
expand finite loops, preserve the exact input (including trailing newlines),
and verify successful parses with upstream before setting `must_parse`.
Retain explicit prefix/value/error outcomes. The provenance check verifies
revision and source context; it does not run upstream's parser or discover new
expressions. The separate `npm run test:upstream` checks the existing 92 Scheme
conformance cases against the reference implementation.

Regenerate syntax snapshots only after reviewing the intended grammar change:

```sh
UPDATE_UPSTREAM_SNAPSHOTS=1 \
  cargo test --locked -p tree-sitter-wirefilter --test upstream_examples
```

Review the snapshot diff before committing. Snapshot generation still refuses
any rejection of a case marked `must_parse`.
