# Gauss Horizon white-label boundary

Product: Gauss Horizon by Gaussian. Application identifier: `id.gaussian.gauss-horizon`.
Initial Gaussian version: 0.1.0 (unreleased). Repository: Gaussian-id/Gauss-Horizon.

The active application, internally owned packages, events, environment names, exporters and installers use the Gauss Horizon identity. The old upstream updater is unavailable at the frontend and backend; old cached packages cannot be installed. Default driver/plugin distribution is unavailable until Gaussian artifacts exist. `.invalid` distribution sentinels are explicitly disabled before network access; they are not proposed Gaussian services.

## Deliberate legacy references

- LICENSE/NOTICE files, README attribution, contributor history, pinned third-party dependencies and vendored source retain their original identity.
- `crates/gauss-horizon-core/src/legacy.rs` identifies old profiles, encrypted formats, persisted binary format markers and old environment-variable names. These are compatibility input, never branding or new exports.
- `src-tauri/src/data_dir.rs` recognizes the old portable marker for existing users.
- `apps/desktop/src/lib/compat/` reads old export/storage formats and tests migration.
- `packages/{mcp-server,plugin-cli}/bin/legacy-environment.js` adapts legacy launcher environment variables.
- `agents/go-common/{go-gssapi/krb5,gosasl}/legacy_env.go` adapts project-specific Kerberos environment options in local forks; their third-party module names remain intact. The owned `gohive` wrapper module uses the Gaussian repository namespace.
- Dependency checksums (`go.sum`, lockfile integrity values) and embedded image data are opaque, preserved bytes; a coincidental substring in those values is not branding.
- Historical architecture/source citations and disabled workflows retain provenance. They are not an active distribution channel.

`node scripts/audit-branding.mjs` checks owned tracked and new files, reports prohibited references and validates release isolation. It does not claim that a static text scan constitutes native UI acceptance.

## Profile migration

Default desktop profiles copy from the previous application ID, once, using restricted staging. Existing new profiles and explicit/portable data directories are not overwritten or merged. Original data remains available. SQLite integrity and encrypted AI material are checked before the staged profile is made active. The old application must be closed. The migration lock is an OS advisory lock and releases if the process crashes; abandoned staging copies are retained rather than deleted automatically.

macOS persistent WKWebView data is copied before the application data profile is finalized. Browser storage keys are then migrated without overwriting new preferences. Windows/Linux browser data within the profile travels with the copy. Explicit absolute profile paths in structured preferences/connection configuration are relocated in the copy. User query text, collection names and ciphertext are never subject to the source-code rename. Source file metadata is rechecked after copying; a changed source fails closed. A missing or wrong encryption key stops migration without creating a replacement profile. Explicit and portable directories keep their existing database filename until deliberately migrated.

## Distribution and acceptance

Only `.github/workflows/verify.yml` is active. It builds CI artifacts, with read-only repository permissions. Archived workflows have a `.disabled` suffix. Release entry scripts stop before publication.

Native launch evidence is required for each supported target: macOS arm64/x64, Windows 10/11 x64 and Ubuntu 22.04+ x64. A configuration or successful cross-build alone does not establish native acceptance. No Apple Developer ID/notarization, Windows signing or Gaussian updater signing is implied by development builds.


Build prerequisites follow [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and [distribution guidance](https://v2.tauri.app/distribute/). CI uses native OS runners, Linux WebKitGTK 4.1 dependencies, Windows NSIS/WebView2, and local ad-hoc macOS signing. No updater artifacts or publication steps run.

See [0.1.0 implementation verification](gauss-horizon-0.1.0-verification.md) for measured outcomes and pending acceptance.
