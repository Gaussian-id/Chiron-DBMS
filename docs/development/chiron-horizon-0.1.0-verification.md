# Chiron Horizon 0.1.0 implementation evidence

Date: 2026-09-14. Branch: `codex/chiron-horizon-0.1.0`. Starting commit: `8d5f546988bd4838e43dc93ea53eda74ad80b468`. This is an unreleased working-tree implementation; no tag, package publication, updater activation, installation over the existing application, or original-profile migration was performed.

## Implemented scope

- Owned product/package/crate/executable names, protocols, environment variables, app ID, deep link, exporters, resources, documentation, agent/SDK paths and build scripts use Chiron Horizon. Component release versions start at 0.1.0; third-party dependency and schema/protocol versions are retained.
- The exact supplied Black artwork is stored at `apps/desktop/public/logo-black.png`; padded desktop PNG/ICNS assets preserve artwork proportions, transparency and colors. Black remains an independent icon preference.
- New exports use `Chiron Horizon-connections.json`; format-based legacy import remains available with the existing encryption and secret restrictions.
- Profile copy migration has restricted staging, process/change checks, OS locks, SQLite integrity validation, key validation, namespace/path relocation and atomic finalization. Existing destinations win. Explicit/portable profiles do not import a default profile and continue opening their existing database. Original source and interrupted stages are retained. macOS WKWebView data and browser-storage key compatibility are handled separately.
- ChironQL supports line-comment toggling and selection/all-editor execution. Scripts preserve quoting/comment syntax, use one native request per statement, keep local USE context, ask for every write and server destructive confirmation, retain statement results, and stop on errors/rejection/cancellation/uncertain mutation outcomes.
- Frontend/backend updater paths fail closed, cached updater installation is blocked, no updater artifacts are built, former publication workflows are disabled, and only build/test/artifact CI remains active. Chiron Horizon changelog has an offline bundled fallback and identifies 0.1.0 as unreleased.

## Completed checks

| Check | Observed result |
| --- | --- |
| Branding scan | Passed across 4,785 owned text files; see the explicit exceptions in `white-label.md` |
| Connection descriptor generation | 82 descriptors and 105 profiles consistent |
| Vue/TypeScript | Passed |
| Frontend production build | Passed; existing large-chunk warnings remain |
| Script/comment/legacy/updater focused suite | 33 tests / 6 files passed |
| Documentation distribution/changelog tests | 36 tests / 10 files passed |
| Plugin launcher | 4 tests passed |
| Publication entry point guards | 2 tests passed |
| Migration | 11 Rust tests passed, including encrypted good/missing/wrong key, no source, existing destination, active old app, corrupt database, symlink failure, interrupted staging and explicit old database |
| AI credentials + native connector/assistant | 15 Rust integration tests passed |
| Core compilation | Passed with bundled SQLite |
| CLI/MCP/web compilation | Passed with no default features |
| Plugin SDK/packager/CLI compilation | Passed |
| Frozen lockfile validation | Passed using pnpm 11.19.0, lockfile-only, scripts disabled; CI pins pnpm 10.27.0 |
| Full frontend regression | 14,181 passed, 20 failed across 11 files; all 20 failures also reproduced at the starting commit |

The original broader Rust filter `--lib legacy` also selected unrelated legacy export tests and aborted with a stack overflow in `table_export::tests::external_driver_table_export_does_not_repeat_legacy_one_shot_results`. It is not counted as a passing full Rust suite. The focused migration filter and integration suites then passed.

The detached baseline checkout uses the installed dependency tree. Its full run had additional environment/dependency-sensitive failures, so only the exact 20 matching failures are used as baseline evidence. No assertion is made that the full baseline suite is green.

## Native and platform acceptance

Native bundle/signature/startup and disposable ChironDB Run results are recorded below as they complete. Windows 10/11 x64, Intel macOS and Ubuntu 22.04+ x64 remain pending native build/install/start/restart evidence. CI configuration alone does not prove these platforms work. Go/JVM agent builds and Windows ACL behavior also require their corresponding toolchains/OS runners; no such runtime result is claimed locally.

Native macOS restart restored the saved connection, query draft and one explicitly saved history fixture; reconnect and COUNT succeeded without re-entering credentials. Remaining manual acceptance includes the other operating systems, full import/export round trips through native dialogs, real WebView preference migration and interrupted/racing old-process migration. An application configured to support a platform is not marked accepted until its native evidence exists.

## Local evidence

Logs are retained under `/tmp/chiron-horizon-*`, including `migration-complete.log`, `rust-integration.log`, `cli-web-check.log`, `sdk-check.log`, `focused-final.log`, `docs-tests.log`, `full-final.log`, `baseline-frontend2.log`, `lock-validation3.log`, and `native-build-final.log` (each prefixed with `chiron-horizon-`). The detached starting checkpoint is `/tmp/chiron-horizon-baseline-0.1.0`.


Build investigation: a web executable built with **all defaults disabled and no SQLite provider selected** failed to link macOS system SQLite extension-loading symbols. The disposable smoke build explicitly enables `chiron-horizon-core/sqlite-bundled`. The no-default compile check is not recorded as a successful standalone link; the normal desktop build retains its configured default SQLite implementation.


## Live disposable ChironDB evidence

The no-default web backend linked successfully with `--features chiron-horizon-core/sqlite-bundled`. `scripts/chirondb-smoke.mjs` then passed against the local ChironDB binary using isolated data and synthetic keys/provider responses. Evidence directory: an isolated temporary directory; summary log: `/tmp/chiron-horizon-live-smoke.log`.

The test executes the actual TypeScript `ChironScriptRun` controller through one-statement native HTTP operations. It verified six-statement create/USE/upsert/count/delete/count execution, exact write targets, three write approvals plus server destructive confirmation, Unicode and quoted/comment semicolons, Run-local collection context, no execute request for USE, rejected approval sending only parse, stop on parser failure, and retained earlier query IDs/results. Existing native connector, synthetic assistant privacy/approval/replay, RBAC, cursor/result and reconnect checks also passed. This is native backend evidence; desktop UI and per-OS acceptance remain separate.

A further compatibility check preserves old SQL Server linked-schema references without changing persisted identifiers. Final targeted export/editor/compatibility/docs run: 72 tests / 16 files passed, followed by the additional linked-schema compatibility test. Vue typecheck and production asset build were rerun after that adapter.


## macOS Apple Silicon native acceptance observed

The standalone `.app` and `.dmg` were built with default desktop features and `custom-protocol`. `codesign --verify --deep --strict` passed. No notarization is claimed. A separate copy at `/tmp/chiron-horizon-native-smoke-20260914/Chiron Horizon.app` launched against the disposable data directory, with `tauri://localhost` and visible version 0.1.0; the original application/profile remained untouched.

Through native UI, Cmd+/ commented three selected lines, Cmd+Z restored them, Cmd+Enter executed USE/count/scroll successfully, and the Run button executed only the selected scroll statement. Two writes showed separate approvals; approving the first and rejecting the second retained the first query ID/affected count and marked the last statement `not run`. Black was selected and saved while the light theme remained active. About showed 0.1.0 and bundled changelog content explicitly marked Not published. Export opened a product-named Settings file dialog and was cancelled without writing into Documents.

Screenshots are retained at `/tmp/chiron-horizon-native-smoke-20260914/batch-cancelled.png` and `/tmp/chiron-horizon-native-smoke-20260914/changelog.png`. The initial native inspection exposed stale explanatory updater text, an enabled-looking inert update preference and unpublished npm instructions. Those UI descriptions/controls were corrected; the final bundle rebuild includes them.

A successful read was saved through the standard history API as an explicitly marked restart-acceptance fixture. This verifies stored-history restoration; it does not claim manual ChironQL Runs automatically create durable history records. In-app browser access to the disposable HTTP URL was blocked by the browser client, so UI acceptance used the native application.


Restart evidence: the History panel displayed the saved `COUNT dbm_smoke;` record for Disposable ChironDB after restarting the task-only app. Screenshot: `/tmp/chiron-horizon-native-smoke-20260914/history-restored.png`. The three-line query draft and saved Black preference were preserved; a selected COUNT returned successfully after reconnect. This used synthetic credentials and the disposable profile only.


## Baseline regression failures retained

All of the following 20 assertions also failed at starting commit `8d5f546988bd4838e43dc93ea53eda74ad80b468`. They remain failures, not accepted passing checks.

| Test file | Failing assertions |
| --- | ---: |
| `packages/app-tests/aiAssistantComposerLayout.test.ts` | 2 |
| `packages/app-tests/aiAssistantSendGuard.test.ts` | 1 |
| `packages/app-tests/aiConfigStore.test.ts` | 2 |
| `packages/app-tests/aiMessageLayout.test.ts` | 1 |
| `packages/app-tests/dataGridHeaderBackground.test.ts` | 1 |
| `apps/desktop/src/stores/__tests__/settingsStore.spec.ts` | 4 |
| `apps/desktop/src/lib/__tests__/app/rightSidebarPanels.spec.ts` | 1 |
| `apps/desktop/src/lib/__tests__/connection/connectionDialogProfileSwitch.spec.ts` | 5 |
| `apps/desktop/src/lib/__tests__/connection/spannerConnectionDialog.spec.ts` | 1 |
| `apps/desktop/src/lib/__tests__/plugins/pluginCenterIntegration.spec.ts` | 1 |
| `apps/desktop/src/lib/settings/__tests__/settingsPageNavigation.spec.ts` | 1 |

## Platform evidence matrix

| Target | Build/package | Native acceptance |
| --- | --- | --- |
| macOS Apple Silicon | Local standalone app and DMG, ad-hoc signature verified | Startup, restart, persisted connection/draft/history fixture, Black, comments and script approvals observed; full import round trip and real old-profile WebView migration remain pending |
| macOS Intel | CI configured; run pending | Pending native runner |
| Windows 10/11 x64 | NSIS CI configured; run pending | Pending installation/WebView2/start/restart and owner-only key ACL verification |
| Ubuntu 22.04+ x64 | DEB/AppImage CI configured; run pending | Pending runtime dependencies/start/restart |


## Final local verification checkpoint

The final build completed successfully (`/tmp/chiron-horizon-desktop-complete.log`). Both standalone macOS Apple Silicon artifacts are version 0.1.0 with app ID `id.chiron.horizon`. Final signature verification passed (`/tmp/chiron-horizon-final-signature.log`); the signature is local ad-hoc and the app is not notarized.

A task-only copy at `/tmp/chiron-horizon-final-smoke-20260914/Chiron Horizon.app` started with the explicit disposable data directory and embedded `tauri://localhost` frontend, without Vite. Final native UI confirmed the corrected script hint, saved Black selection with the light theme, disabled/off update reminders, unavailable driver/update message, About v0.1.0, bundled 0.1.0 Not published changelog, and `Chiron Horizon-settings-2026-09-14` save dialog. The save was cancelled. Screenshots: `/tmp/chiron-horizon-final-smoke-20260914/black-updater.png` and `/tmp/chiron-horizon-final-smoke-20260914/about.png`.

The disposable ChironDB server had stopped at its test deadline before this final visual pass, so a saved connection's collection refresh correctly reported unavailable; no write was sent. Live queries, per-write approvals, rejection, comments and persisted-credential reconnect had already passed on the preceding signed bundle. Final UI changes did not change that script execution controller. Both task-only native applications and disposable test services were closed.

Artefacts (not installed or published):

- App: `/Users/kalbefarma/Documents/Projects/Gauss-DBM/target/release/bundle/macos/Chiron Horizon.app`
- DMG: `/Users/kalbefarma/Documents/Projects/Gauss-DBM/target/release/bundle/dmg/ChironHorizon_0.1.0_aarch64.dmg` (31,713,637 bytes)
- Executable SHA-256: `68994a61393110016f2e08016abb6137d3e9908f633b14124ecab408c9bfc896`
- DMG SHA-256: `cfdb3fabdd9f890a16f5c2d69772ce4014902af088cf9b8e1df964c164b16826`

Final source checks: branding audit 4,785 owned text files passed; 82 generated connection descriptors and 105 profiles consistent; exact Black source byte comparison passed; `git diff --check` passed. Full frontend results remain 14,181 passed and 20 baseline failures. This is an implemented, locally verified working tree with platform acceptance still pending as listed above, not a published or universally accepted release. Existing installed 0.6.11 app, historical 0.6.12 bundle and backup branch were preserved; no original-profile migration, commit, push, release or tag occurred.


## 2026-09-14 — About changelog 404 follow-up

Kevin reported that Settings → About → changelog → “View on website” returned 404 and said the remainder matched expectations. The button pointed to an unpublished `blob/main/CHANGELOG.md`. Read-only verification also found the old Chiron Horizon repository address redirects to [Gaussian-id/Gauss-Horizon](https://github.com/Gaussian-id/Gauss-Horizon).

Changed the changelog navigation to the verified canonical repository root and renamed the action “View repository” in all ten locales. Header, error fallback and unreleased-entry actions now share that destination; unreleased entries no longer promise a published source changelog. Published-release links use the same canonical repository. Bundled changelog and updater behavior are unchanged. No GitHub publication or repository mutation was performed.

Validation: the actual URL helper returned HTTP 200 for both changelog languages; 32 existing changelog/docs/WebView tests passed, Vue/TypeScript passed, branding audit passed for 4,785 files and `git diff --check` passed. Logs: `/tmp/chiron-horizon-changelog-link-tests.log`, `/tmp/chiron-horizon-changelog-link-typecheck.log` and `/tmp/chiron-horizon-changelog-link-build.log`. Updated native app/DMG packaging completed successfully, and `codesign --verify --deep --strict` passed (local ad-hoc signature; no notarization). DMG SHA-256: `945f8e223dd7a483c8d610fd0a7fb3b1d53c46d9acf5f0d6321b9422f1b87ecc`. This supersedes the earlier same-version artifact checksum. No installation or native UI rerun was performed for this URL-only follow-up. Previous native/cross-platform acceptance boundaries remain as recorded above.


## MongoDB MCP acceptance follow-up

Real MongoDB 8.0.30 + standalone MCP 0.1.0 passed all 14 E2E groups over stdio and authenticated HTTP. Existing Rust regressions: 19 passed, 7 live opt-in tests ignored. See [MongoDB MCP evidence](mcp-mongodb-e2e.md) for reproducible commands, access-control checks, schema limits and separate AI-client/platform acceptance.
