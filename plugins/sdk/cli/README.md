# chiron-horizon-plugin CLI

Creates and packages Chiron Horizon plugins as frontend-only universal bundles or full-stack projects with Rust or Go sidecars. The CLI also includes a Svelte + Vite workbench starter.

For the complete plugin development guide, see [`../../../docs/content/docs/plugin-development.mdx`](../../../docs/content/docs/plugin-development.mdx). The precompiled npm plugin CLI is deferred for 0.1.0; build this CLI from the source checkout for development.

## Browser development

`chiron-horizon-plugin dev --path /path/to/plugin --port 5190` runs a local browser development host without starting Chiron Horizon. The npm package includes the prebuilt runtime; only `dev` requires Node.js 22+. Frontend-only plugins need no sidecar; Rust/Go projects are built from `[backend]` configuration. JSONL and framed v1 are supported.

Optional `[dev]` `ui_build` and `ui_watch` argument arrays configure UI builds. Without them, existing UI assets are loaded and watched. The command does not install project dependencies. Development data, including plaintext credentials, defaults to `.chiron-horizon-dev/`; use `--data-dir` to override it. See [runtime documentation](../dev-host/README.md) for supported APIs, source builds and limitations.

## Project templates

`chiron-horizon-plugin create` offers four templates:

- `frontend` — sandboxed workbench UI with no native backend; produces one `universal` package.
- `svelte` — Svelte + Vite sandboxed workbench UI with no native backend; produces one `universal` package.
- `rust` — sandboxed workbench UI plus a Rust sidecar; produces one package per native target.
- `go` — sandboxed workbench UI plus a Go sidecar; produces one package per native target.

Interactive terminals use a colored wizard, validate each answer, show a final summary, and ask before writing files. The default template is `frontend`.

For scripts and CI:

```bash
chiron-horizon-plugin create my-plugin \
  --template frontend \
  --id com.example.my-plugin \
  --name "My Plugin" \
  --publisher example \
  --description "My Chiron Horizon plugin." \
  --version 0.1.0 \
  --yes
```

`--backend none|svelte|rust|go` is an alias for template selection. `--language rust|go` remains available as a compatibility alias for native projects.

Generated frontend-only projects contain:

```text
my-plugin/
├── chiron-horizon-plugin.toml
├── manifest.json
├── assets/plugin.svg
├── ui/index.html
└── .github/workflows/plugin-release.yml
```

Rust and Go templates add a `backend/` directory containing the native sidecar project.

## Packaging

`chiron-horizon-plugin package` reads `chiron-horizon-plugin.toml`, verifies that its optional backend matches `manifest.json`, stages only declared files, and reuses `chiron-horizon-plugin-packager` to generate:

- `<id>-<version>-<target>.chiron-horizonp`
- `<id>-<version>-<target>.artifact.json`

Frontend-only projects default to target `universal`. Native projects must be built on the matching target platform. Temporary stage and backend build directories are removed after both successful and failed package attempts.

Artifact metadata always includes target, URL, SHA-256, and size. The generated Release workflow publishes these files as unsigned review candidates. After approval, Chiron Horizon Store signs official candidates and emits final metadata containing `signingKeyId`.

Use `--sdk-root /path/to/chiron-horizon` only with Rust or Go templates while developing unpublished SDK changes from a Chiron Horizon checkout. Normal npm installations use the SDK sources bundled with `@chiron-horizon/plugin-cli`. Generated release workflows pin the precompiled CLI version so local and CI packaging use the same SDK contract.

## Signing

Official plugin authors do not create or manage signing keys. They publish unsigned candidates; Chiron Horizon Store signs approved packages with the official repository key.

`keygen` is an advanced tool for private or custom repository operators. Packaging and signing are intentionally separate:

```bash
chiron-horizon-plugin keygen company-plugins.release
source .chiron-horizon-repository-signing-key.env
chiron-horizon-plugin package .
cargo run --release \
  --manifest-path /path/to/chiron-horizon/plugins/sdk/packager/Cargo.toml \
  -- sign dist/plugin.unsigned.chiron-horizonp dist/plugin.chiron-horizonp \
  --key-id "$CHIRON_HORIZON_PLUGIN_SIGNING_KEY_ID" \
  --artifact-metadata dist/plugin.artifact.json \
  --target universal
```

`keygen` writes `.chiron-horizon-repository-signing-key.env` with owner-only permissions on Unix and refuses to overwrite it unless `--force` is supplied. Generated plugin projects ignore this file by default.

The command prints the public key and key ID for configuring a custom repository trust root. The key ID is stable public metadata; the Ed25519 private seed in the generated file is secret and must stay in a password manager or protected repository-signing CI. `chiron-horizon-plugin create` and `chiron-horizon-plugin package` intentionally have no signing-key options.

## Terminal colors

Colors are enabled automatically for interactive terminals. Set `NO_COLOR=1` or `CLICOLOR=0` for plain text; set `CLICOLOR_FORCE=1` to preserve colors when piping output. `NO_COLOR` always takes precedence.

Run `chiron-horizon-plugin --help`, `chiron-horizon-plugin create --help`, or `chiron-horizon-plugin package --help` for the complete command reference.
