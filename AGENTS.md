# Working on Wirefilter

## Scope and source of truth

This repository provides a syntax-only Tree-sitter parser and a Topiary formatter
for Cloudflare Wirefilter. Upstream `cloudflare/wirefilter` Rust lexers and parser
are the language reference. Do not claim that accepting a syntax tree validates
field names, types, arity, regexes, IP addresses, or other Scheme-dependent rules.
Document intentional syntax approximations and verify changes against upstream.

## Layout

- `tree-sitter-wirefilter/grammar.js`: grammar and precedence.
- `tree-sitter-wirefilter/src/scanner.c`: external raw-string scanner.
- `tree-sitter-wirefilter/test/corpus/`: parser tree regression cases.
- `tree-sitter-wirefilter/queries/highlights.scm`: highlighting queries.
- `topiary/queries/formatting.scm`: actual Topiary formatting policy.
- `tests/`: regression checks and formatter goldens.
- `demo/`: browser playground and Workers deployment source.

## Development rules

Use Git to save progress in focused commits. Preserve unrelated changes. For
nontrivial work, delegate independent bounded tasks when useful; agents share the
workspace, so give each editing agent separate file ownership. Prefer configured
Luna agents with xhigh reasoning. Do not delegate trivial or tightly coupled edits.

Edit grammar and scanner source, then regenerate parser artifacts. Never hand-edit
generated parser tables. Keep CLI and browser parser artifacts in sync. Use the
same formatting query in the demo and native Topiary; do not substitute a regex
formatter. Treat literal contents as opaque, including whitespace, escapes,
Unicode, raw-string delimiter hashes, and embedded newlines.

## Validation

Run the documented root test command after changes. Grammar changes need corpus
coverage for valid syntax, malformed input, precedence, and AST shape. Formatter
changes need exact output goldens, idempotence, rejection of invalid syntax, and
AST/token preservation. Run the demo tests and production build after integration.
Report any validation that was not run. Syntax diagnostics must include missing
nodes as well as ERROR nodes; never display user input through unescaped HTML.

## Publishing

The requested demo may be published to its own Workers deployment. Keep deployment
configuration reproducible and do not change unrelated services or domains. Never
commit credentials, node_modules, build caches, or local service state. Verify the
deployment result and report the URL and any access restrictions explicitly.
