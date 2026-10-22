# Local compatibility patches

This directory vendors the crates.io `topiary-core` 0.8.0 source. The
dependency remains Topiary 0.8.0; the small changes in this copy only make its
wasm32 build match the wasm API exposed by the pinned
`topiary-tree-sitter-facade` 0.8.0 and `topiary-web-tree-sitter-sys` 0.8.0.

The native branches are unchanged:

- Native query errors retain their source range and language attachment.
- Native `#set! injection.language` query properties are still used.
- Native parse errors still attach the grammar language name.
- `Range` diagnostics retain their original coordinates; the assignment is
  only reordered so the wasm facade's non-`Copy` `Range` can be used too.

The wasm facade does not expose query-error ranges, query property settings,
or node language names. The wasm compatibility branches therefore preserve
labels and ranges where available, allow dynamic `@injection.language`
captures, and omit only the unavailable optional attachments. This formatter
sets `injection_query` to `None`, so the injection-property limitation is not
used by the Wirefilter demo.

The vendored source is licensed under the upstream MIT license in `LICENSE`.
