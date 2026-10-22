# Wirefilter formatter

An optional Rust library and CLI built on Topiary. The grammar and formatting
query are embedded; no runtime configuration or external formatter is needed.

```sh
cargo install --path topiary --locked  # from the repository root
wirefilter-fmt rule.wirefilter        # writes stdout
printf '%s' 'enabled and trusted' | wirefilter-fmt
```

As a library, call `wirefilter_format::format(source)`. It returns a formatted
`String` or an error. Input must be valid UTF-8 and syntactically complete.
Formatting checks idempotence and preserves the concrete tree and token
spellings. It does not validate field names or types against a Wirefilter Scheme.

The policy in `queries/formatting.scm` is also used by the browser demo. For users
of the standalone Topiary CLI, `languages.ncl` remains available; run the root
`npm run build` first to generate its Linux shared library.
