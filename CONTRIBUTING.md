# Contributing

This repository provides syntax tooling for [Cloudflare Wirefilter](https://github.com/cloudflare/wirefilter). Upstream's Rust lexers and parsers define the language. See [development](docs/development.md) for setup and [conformance](docs/conformance.md) for the tested contract and known approximations.

## Making a change

1. Describe the expression or workflow you want to improve. For parser issues, include the input and expected tree or syntax error; for formatting issues, include the input and desired output.
2. Edit the source grammar, scanner, or formatting query. Regenerate parser artifacts with `npm run build`; do not edit generated parser tables by hand.
3. Add regression coverage. Parser changes need valid and malformed examples, precedence, and tree shape. Formatter changes need exact output, idempotence, invalid-input rejection, and concrete-tree/token preservation. Treat literal contents as opaque.
4. Run `npm test` and, for integrated changes, `npm run demo:test`, which includes a production build. When changing syntax expectations, also run `npm run test:upstream` against the pinned checkout described in the conformance guide.
5. Keep commits focused and report the checks you ran, including any checks you could not run.

Use the same Topiary query in native and browser formatting. Keep parser artifacts aligned across both runtimes. Do not introduce Scheme-dependent validation into a syntax-only success indicator; document any intentional approximation against upstream.

See [AGENTS.md](AGENTS.md) for the full development rules. Dependencies, generated binaries, build caches, credentials, and local deployment state must stay out of commits.
