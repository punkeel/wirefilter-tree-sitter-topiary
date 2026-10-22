# Wirefilter: Tree-sitter grammar + Topiary formatter

A syntax-oriented Tree-sitter grammar and Topiary formatting query for
[Cloudflare Wirefilter](https://github.com/cloudflare/wirefilter). The grammar
is based on the upstream Rust lexers under `engine/src/ast`, `engine/src/types.rs`,
`engine/src/rhs_types`, and `engine/src/scheme.rs` (reviewed October 2026).

## Files

- `tree-sitter-wirefilter/grammar.js`: grammar for Wirefilter expressions
- `tree-sitter-wirefilter/src/scanner.c`: hash-balanced raw strings (`r#"..."#`)
- `tree-sitter-wirefilter/queries/highlights.scm`: editor highlighting
- `topiary/languages.ncl`: local Topiary language registration
- `topiary/queries/formatting.scm`: whitespace and line-break policy
- `fixtures/*.wirefilter`: syntax samples to exercise the main operators
- `scripts/build.sh`: build the Tree-sitter shared library
- `scripts/smoke.sh`: parse and idempotence smoke test

## Setup (Linux)

Install `tree-sitter` (CLI) and `topiary` separately, then from this folder run:

```sh
./scripts/build.sh
printf 'http.request.method eq "GET" and ip.src in {192.0.2.0/24 10.0.0.1}' \
  | topiary -C topiary/languages.ncl format --language wirefilter

# Or format .wirefilter files in place:
topiary -C topiary/languages.ncl format fixtures/examples.wirefilter

# Optional regression / idempotence checks:
./scripts/smoke.sh
```

`topiary/languages.ncl` points to `tree-sitter-wirefilter/wirefilter.so` relative
to the config file, **not** the current directory. On macOS, build a dylib and
change that path to `.dylib`; Windows requires a `.dll`.

If adapting to a published Tree-sitter grammar repository, you can replace
`grammar.source.path` with a pinned `grammar.source.git` configuration and avoid
building locally.

## Intended syntax

- Logical operators `and`/`&&`, `xor`/`^^`, `or`/`||` and `not`/`!`
- Comparisons `eq`/`==`, `ne`/`!=`, `gt`/`>`, `ge`/`>=`, `lt`/`<`, `le`/`<=`
- `contains`, `matches`/`~`, `wildcard`, `strict wildcard`, `in`, `&`/`bitwise_and`
- Bare boolean fields, functions, `any(...)` and `all(...)`
- Map indexing (`["key"]`), array indexing (`[0]`), and map-each (`[*]`)
- Whitespace-separated `in { ... }` sets, `in $list_name`, integer/IP ranges
- Decimal, hex and octal integers, IP/CIDR, byte strings, quoted and raw strings

**Important:** This is a syntactic parser, **not** a replacement for Wirefilter's
schema-dependent Rust parser. It does not validate identifiers, operator/field
types, function arity, IP validity, integer overflow, regex compatibility,
or the `Array(Bool)` requirement for quantifiers. For instance, a generic
reference can parse as a field or a call; only the Wirefilter `Scheme` can
resolve it. Colon-separated hex byte strings can be lexically ambiguous with
some IPv6 forms. Wirefilter does not accept comments, commas inside literal
sets, or tabs as whitespace; this grammar intentionally omits them.

## Validation status

JavaScript syntax, grammar-rule references, token-regex spot checks, and
the raw-string scanner (including runtime unit tests) have been checked. The **Tree-sitter parser generation and full Topiary
format run have not been executed** in the authoring environment because the
required CLI executables were unavailable. Run `./scripts/smoke.sh` after
installing both tools before using this formatter on production expressions.
