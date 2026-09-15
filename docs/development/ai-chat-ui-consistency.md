# Consistent AI composer across connections

Date: 2026-09-14–15 (Asia/Jakarta). Branch: `codex/gauss-horizon-0.1.0`.

Kevin requested a consistent chatbot UI after comparing ChironDB and MongoDB in the open desktop application. Inspection confirmed that both already used `AiAssistant.vue`, but ChironDB conditionals inserted a separate collection form above the messages and replaced the common mode menu with a Generate only switch. MongoDB used the standard context row and Ask/Agent menu. The separate Mongo Chat example is not the desktop chatbot and is outside this change.

**Follow-up on 2026-09-15:** actions and prompt templates are now supported; see [current behavior and verification](ai-chiron-actions-templates.md). The implementation and artifact hash below describe the earlier composer-only checkpoint.

At the initial checkpoint, the native ChironDB path used the common composer layout:

- Connection and collection appear together in the context row. The collection selector uses the shared searchable control, supports an explicit custom name for new collections, and can be cleared for global requests.
- Ask/Agent uses the same menu and saved default mode as other connections. Ask maps to `generate_only: true`; Agent maps to `false`, preserving native write approval. Unsupported generic SQL actions are omitted for ChironDB.
- The shared attachment and template positions remain visible, with ChironDB's unsupported capabilities disabled and explained. They do not silently add data to native requests.
- Provider/model, prompt, history and message controls remain shared. Native result cards retain exact-query approval, local results, stale-token protection and consent before sending a result preview to a model.
- Collection, mode, connection and model controls are locked during a native request. Connection/mode handlers also reject changes while busy.

The change does not route ChironDB through MongoDB/generic agent execution, enable native attachments/templates, alter MongoDB execution policies, or extend support to currently unavailable database integrations. ChironDB's default behavior now follows the visible Ask/Agent setting instead of an independent hidden execution flag.

## Verification

- 72 relevant frontend tests passed across eight files, including native lifecycle, result approval/privacy, conversation handling, templates and write proposals.
- Vue/TypeScript check, focused lint, branding audit and whitespace check passed.
- Existing disposable ChironDB integration script passed its request/approval/privacy, repeated-prompt, role/scope and sequential-query checks before entering native UI verification mode. Provider responses in this fixture are synthetic; ChironDB execution is real. All AI-generation/data-execution tests used the disposable fixture; no live model request or data-query test targeted Kevin's saved databases. His open application was inspected and its saved conversation restored through the UI.
- Browser visual/interaction verification used the same Vue frontend with a disposable native ChironDB backend: the collection picker is in the composer; Ask/Agent and model controls are shared; all four context controls are disabled during a request.
- Ask generated `COUNT dbm_smoke;` and displayed “Query ready. It has not been run.” Cancelling it displayed “No further query was sent.” Agent ran the same read and returned HTTP 200, count `1`, query ID `q_1a0a0dcafb0027`, with results retained locally.
- Choosing a custom collection marked previous proposals/results stale and disabled data sharing; clearing the selection restored the global-request placeholder. Merely choosing a new name did not create a collection.
- Native macOS Apple Silicon build passed with installed Rust 1.94.1; `codesign --verify --deep --strict` passed after local ad-hoc signing. No notarization is claimed.
- The standalone native app loaded the embedded `tauri://localhost` frontend without Vite, displayed the common composer, locked connection/collection/mode/model during generation and executed an Agent read against the explicit disposable profile: `COUNT dbm_smoke;`, count `1`, query ID `q_1a0a0e4b2b5028`.
- The first attempt to run a second native instance was blocked by the application single-instance guard. A launcher fallback briefly opened the default profile without running an AI test. Verification then used a foreground process with an explicit disposable data-directory environment variable and checked the visible Disposable ChironDB connection before submitting any test prompt.
- Kevin's old running instance was closed normally for the native check, then the rebuilt application was reopened on his current profile. The existing MongoDB query workspace and prior conversation were restored from History. No installation into `/Applications`, profile import, commit, push, tag or publication occurred.
- Vite, the disposable ChironDB/web/provider fixture processes and the temporary native application were stopped. Evidence/profile files were retained; Kevin's reopened application and unrelated services remain running.

Artifact at this earlier checkpoint: `target/release/bundle/macos/Gauss Horizon.app`. Executable SHA-256: `14e0638b070ca96ee022f15e003a4fd37442d0a9a33c8d2edd487825d7cab972`. The existing DMG was not rebuilt for this change. Native verification applies to macOS arm64; Windows/Linux/macOS Intel were not rerun for this UI update.

Initial tool invocations encountered pnpm's dependency auto-check rejecting an ignored third-party build script and the default Rust 1.92.0 being too old for locked dependencies. Verification was rerun using already-installed executable tools and installed Rust 1.94.1, without relaxing build-script approval or changing dependencies to work around the errors.

Logs: `/tmp/gauss-horizon-chat-ui-regression.log`, `/tmp/gauss-horizon-chat-ui-typecheck-final.log`, `/tmp/gauss-horizon-chat-ui-build-final.log`, `/tmp/gauss-horizon-chat-ui-native-fixture.log`.
