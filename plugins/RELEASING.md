# Publishing Gauss Horizon plugins

Gauss Horizon separates plugin source, unsigned review candidates, repository-signed installable artifacts, and catalog metadata. These artifacts have different owners and should not be copied into one Git repository.

The signing rationale and future author-attestation boundary are documented in [`SIGNING.md`](SIGNING.md).

## What goes where

### Plugin source repository

The plugin author keeps the following in the plugin's own Git repository:

- backend and frontend source code;
- `manifest.json`, schemas, tests, documentation, screenshots, and license;
- package scripts and GitHub Actions workflows;
- public release notes and issue tracker links.

The source may live inside `Gaussian-id/Gauss-Horizon` for a tightly coupled official plugin or in an independent author repository. Official and verified submissions must give Gauss Horizon reviewers access to the corresponding source. Open-source plugins normally provide a public source URL; a future closed-source commercial flow may use private reviewer access.

Official plugin authors do not receive or maintain the Gauss Horizon Store signing key.

### Candidate artifact storage

Author-controlled GitHub Releases, a CDN, or object storage contains the unsigned packages submitted for review:

```text
vendor.example-1.2.0-darwin-arm64.gauss-horizonp
vendor.example-1.2.0-darwin-x64.gauss-horizonp
vendor.example-1.2.0-windows-x64.gauss-horizonp
vendor.example-1.2.0-linux-x64.gauss-horizonp
vendor.example-1.2.0-linux-arm64.gauss-horizonp
release-candidates.json
```

Frontend-only or otherwise platform-independent plugins may publish one `vendor.example-1.2.0-universal.gauss-horizonp` candidate. Use `universal` only when the exact same package is valid on every supported Gauss Horizon target.

Candidates are not normal Marketplace installation assets. They deliberately contain no `signature.json`, and their `.artifact.json` records contain no `signingKeyId`.

### Repository-signed artifact storage

After review, the repository operator signs the accepted candidate bytes and publishes final installable `.gauss-horizonp` assets to repository-controlled release storage. Final artifact metadata contains:

- target and final download URL;
- SHA-256 and byte size of the signed package;
- repository `signingKeyId`.

The official implementation publishes these assets from a protected `gauss-horizon-store` workflow. A custom or private repository operates the same trust boundary with its own key and storage.

### Official store Git repository

`Gaussian-id/Gauss-DBM-store` contains reviewed catalog inputs, publisher identities, repository public keys, revocations, and generated catalog JSON. It does not contain plugin source trees, private keys, or `.gauss-horizonp` binaries.

A store submission references:

- plugin ID, display metadata, icon, screenshots, tags, permissions, and localization;
- publisher identity, source, homepage, support, license, and privacy links;
- release tag and release notes;
- each final artifact URL, size, SHA-256, target, and repository signing key ID;
- reviewer status and any revocation information.

Human review decides whether a plugin is allowed in the official catalog. SHA-256 and Ed25519 repository signing ensure the installed bytes are the reviewed bytes. Gauss Horizon also compares the package Manifest ID, version, publisher, and permissions with the selected catalog entry before activation.

## Author release workflow

Install the precompiled CLI and run `gauss-horizon-plugin create <directory> --template frontend|rust|go` for a complete project, or copy `sdk/templates/github/plugin-release.yml`:

```bash
npm install --global @gauss-horizon/plugin-cli@0.1.2
```

Pin both the reusable workflow reference and `plugin-cli-version`. The npm package contains the matching CLI binary, packager, and Rust/Go SDK sources. Building the CLI from a Gauss Horizon checkout is reserved for SDK development and can be enabled with `install-plugin-cli-from-source: true` plus a reviewed `sdk-ref`.

Before publishing a new CLI version, update the CLI and npm manifests together, merge them to `main`, then run the **Plugin CLI Release** workflow. The workflow creates `plugin-cli-v<version>`, builds six platform packages, publishes `@gauss-horizon/plugin-cli`, and verifies clean npm installation with frontend, Rust, and Go templates.

For local CLI development only:

```bash
cargo install --locked --path plugins/sdk/cli
```

When an author publishes a GitHub Release, the reusable workflow:

1. installs the pinned precompiled `gauss-horizon-plugin` npm package and builds on the configured target runners;
2. produces one unsigned `.gauss-horizonp` and `.artifact.json` per target;
3. rejects candidates containing `signature.json` or metadata containing `signingKeyId`;
4. validates unique targets, SHA-256 values, sizes, package names, and one shared Manifest identity;
5. uploads all candidates and merged `release-candidates.json` to the author Release.

The default native matrix covers `darwin-arm64`, `darwin-x64`, `windows-x64`, `linux-x64`, and `linux-arm64`. A frontend-only plugin uses one `universal` build.

## Official review and signing

1. The author opens a Plugin submission Issue in `Gaussian-id/Gauss-DBM-store` with the source tag and `release-candidates.json` URL.
2. Review the source tag, Manifest, permissions, release notes, and candidate metadata.
3. Verify every candidate URL is immutable and matches `release-candidates.json`.
4. Run the protected `gauss-horizon-store` signing workflow with the expected plugin ID, version, target, output filename, and reviewed Gauss Horizon SDK ref.
5. The workflow downloads the candidate, rejects pre-existing signatures, verifies Manifest identity, appends the Gauss Horizon Store signature, and publishes the signed asset plus final metadata.
6. The author opens the final catalog PR against `Gaussian-id/Gauss-DBM-store:main`, adding the final artifact URL, size, SHA-256, and repository `signingKeyId`.
7. Run store validation and complete maintainer review before making the version visible.

The protected GitHub Environment must require reviewer approval and provide matching `GAUSS_HORIZON_STORE_SIGNING_KEY` secret and `GAUSS_HORIZON_STORE_SIGNING_KEY_ID` variable values. The public key must already exist in `signing-keys.json` and must not be revoked.

## Custom and private repositories

Repository operators may create a repository key with:

```bash
gauss-horizon-plugin keygen company-plugins.release
source .gauss-horizon-repository-signing-key.env
cargo run --release \
  --manifest-path /path/to/gauss-horizon/plugins/sdk/packager/Cargo.toml \
  -- sign candidate.gauss-horizonp signed.gauss-horizonp \
  --key-id "$GAUSS_HORIZON_PLUGIN_SIGNING_KEY_ID" \
  --artifact-metadata signed.artifact.json \
  --target darwin-arm64 \
  --artifact-url https://plugins.example.com/releases/signed.gauss-horizonp
```

Distribute the public key through an independent trusted channel. Never commit the private seed or place it in the plugin package, catalog, source repository, workflow logs, or release notes.

## Immutability

Rebuilding an existing version in place is not allowed. If source, metadata, review decisions, or package bytes change, publish a new semantic version and new release assets.
