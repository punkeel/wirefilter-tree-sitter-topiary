# Syntax and formatting contract

The reference is Cloudflare Wirefilter at
[`f656cc5c04bc112977d949b6afd48c5ebe426ece`](https://github.com/cloudflare/wirefilter/tree/f656cc5c04bc112977d949b6afd48c5ebe426ece).
`tests/upstream-conformance/cases.json` records the revision, a typed Scheme, and
expressions accepted or rejected by its real Rust parser. The same cases run
against Tree-sitter in `npm test`. The Scheme is used only by the reference test;
Tree-sitter and the playground remain syntax-only.

To verify the recorded expectations independently:

```sh
git clone https://github.com/cloudflare/wirefilter.git /tmp/wirefilter-reference
git -C /tmp/wirefilter-reference checkout f656cc5c04bc112977d949b6afd48c5ebe426ece
WIREFILTER_UPSTREAM=/tmp/wirefilter-reference npm run test:upstream
```

This optional test uses a committed Cargo lockfile and needs Cargo and network
access for dependencies on its first run. Set `WIREFILTER_CARGO_OFFLINE=1` after
dependencies are cached. It refuses a
different revision or modified tracked upstream files unless the corresponding
`WIREFILTER_UPSTREAM_ALLOW_REVISION` or `WIREFILTER_UPSTREAM_ALLOW_DIRTY` override
is explicitly set to `1` for an audit. It does not modify upstream source.

## Upstream examples

The [native Rust example suite](../tree-sitter-wirefilter/tests/upstream-examples/README.md)
parses 408 distinct upstream inputs from documentation, benchmarks, engine tests,
FFI tests, and fixed fuzz examples. It includes finite generated test expressions
and stores concrete-tree and leaf-token snapshots. All 255 cases designated as
complete valid syntax must parse without ERROR or missing nodes. The other
cases include malformed input, prefix/value parser cases, and type errors;
their snapshots do not assert semantic validity. Each case records its source
location at the pinned revision. Unbounded fuzz and runtime inputs are outside
this finite corpus.

## What the tests establish

- Corpus tests check concrete tree shape, precedence, malformed input, and error
  recovery. Tree-sitter retains punctuation and grouping; upstream's typed AST
  can flatten boolean chains and resolve references using the Scheme.
- Native and WASM formatting share the actual Topiary query and exact goldens.
  Generated expressions exercise combinations of groups, calls, operators,
  indexes, sets, Unicode, and multiline/control-character literals.
- Formatting must be idempotent and preserve the concrete tree, operators,
  delimiters, field names, and literal spellings. Both checked CLI formatting and
  browser formatting reject changed syntax or tokens before returning output.
- Browser tests exercise highlighting, error/missing-node diagnostics, editable
  formatting rules, indentation settings, and incremental parsing after edits.

## Scope of validation

The 92 reference cases cover 54 accepted expressions and 38 syntax rejections.
Operator-specific RHS shapes are syntax rules: there is no field type for which
`in 1`, `contains {"a"}`, or `eq {1}` is accepted. Enforcing those shapes does
not resolve a field type. By contrast, `ip.src contains "x"` is syntactically
well-formed here even when the Scheme makes that operation invalid.

The relevant upstream implementations are `ast/field_expr.rs` (operators),
`ast/logical_expr.rs` (precedence), `rhs_types/bytes.rs` and
`rhs_types/regex/mod.rs` (distinct string lexers), `rhs_types/int.rs` (radix and
range lexing), and `rhs_types/list.rs` (list names).

A syntax tree cannot establish whether a name exists in a Scheme, whether a
function accepts its arguments, or whether an operation is valid for a field's
type. Numeric bounds, valid IP addresses/networks, map-key UTF-8, range ordering,
regex compilation, wildcard validation, and quantifier argument types still
belong to upstream Wirefilter. Colon-separated bytes and some IPv6 spellings
are indistinguishable without type information; Tree-sitter assigns a stable
syntactic node kind without resolving that ambiguity. Function arguments use a uniform expression grammar here; upstream's Scheme and
argument-start dispatch can require grouping for some boolean-chain arguments.
This is an intentional syntax approximation, not a claim of full acceptance
or typed-AST equivalence.

Formatting is structural. Boolean operators begin new lines, nested calls and
boolean groups expand, and simple expressions stay compact. It does not wrap
at a configurable line width or rewrite literals to fit a line. Sets preserve
whether the input spans multiple lines. No formatter layout change implies
that an expression has passed Wirefilter's semantic validation.
