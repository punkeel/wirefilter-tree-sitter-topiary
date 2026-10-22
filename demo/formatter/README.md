# Browser formatter adapter

This small WASM adapter runs Topiary 0.8.0 with the same query as the native
formatter. It is independent of the native Cargo workspace.

`prepare.sh` downloads the crates.io Topiary archive, verifies its pinned SHA-256,
and applies `topiary-core.patch` to an ignored build dependency under `vendor/`.
Only the compatibility patch is maintained here; the downloaded source and its
MIT license stay together. The first build needs network access; subsequent
builds reuse the archive under `target/` and reapply the patch to fresh source. The script requires curl, sha256sum,
tar, and patch, in addition to the demo's documented prerequisites.

The patch adapts diagnostics to the WASM facade's non-Copy Range and missing
query-error ranges, node language names, and query property settings. Native
branches are unchanged. Wirefilter uses no injected languages, so the missing
injection-property API does not affect this formatter.
