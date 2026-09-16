# ChironDB AI actions and prompt templates

Date: 2026-09-15 (Asia/Jakarta). Branch: `codex/chiron-horizon-0.1.0`.

The screenshot follow-up identified two remaining differences: ChironDB hid the shared action list, and its template selector was disabled. Both are now enabled in the shared `AiAssistant.vue` composer and connected to native prompt generation.

## Behavior

- Ask offers General, Generate ChironQL, Explain ChironQL, Optimize ChironQL, Fix Error, Convert Dialect and Sample Data. Every Ask action stays generate-only. Explain asks for plain text without an executable proposal.
- Agent offers General, Query Data, Inspect Schema, Run & Explain and Generate (no run). Generate (no run) remains a draft even in Agent mode. Native parsing, authorization and exact-query write/destructive approval remain authoritative.
- The existing template selector opens, supports multiple selection/deselection, remembers the selected IDs and includes only selected template content plus saved global instructions. It is locked while a native request is busy.
- Explain/Optimize/Fix/Convert/Run & Explain include a snapshot of the current editor query. Unrelated actions do not automatically include it. Action, mode, query and template IDs are captured at send time. Combined prompt text over 32 KiB is rejected rather than truncated.
- The mode menu uses ChironQL labels for ChironDB and retains other databases' existing labels. Privacy copy explains that prompts, selected templates and relevant query text are shared. Attachments were unavailable at this checkpoint; see [attachment follow-up](ai-chiron-attachments.md) for the subsequent implementation.
- Query-producing responses can retain accompanying query-semantic commentary. It is stored separately from the executable proposal. Run & Explain does not silently share execution results; actual result explanation still needs the existing preview-sharing consent.

## Verification

- 85 relevant frontend tests passed across eight files. All Ask/Agent action policies, selected/global templates, editor query inclusion, prompt size limits, lifecycle, native result/privacy and existing shared composer regressions were checked.
- Five focused Rust credential/proposal tests passed, including commentary extraction without changing executable text. The first commentary assertion was overly specific about blank-line count; it was corrected to assert semantic boundaries, then the full focused test target passed. This initial failed assertion is not counted as a passing run.
- Vue/TypeScript check, focused lint, full branding audit (4,795 owned text files) and whitespace check passed.
- The disposable integration fixture passed its existing request/approval/privacy, repeated-prompt, scope and sequential-query groups. Generation uses a synthetic OpenAI-compatible provider; execution targets real disposable ChironDB. No live provider or data query targeted Kevin's saved databases.
- Browser UI displayed all seven Ask and five Agent actions. A selected template and Explain action reached the synthetic provider with the current editor query; an unselected template did not. Explain returned text without executing a query.
- Agent Generate (no run) displayed a draft and was cancelled without execution. Deselect All removed both template markers from the next provider request. Agent Query Data then executed `COUNT dbm_smoke;` and returned a local result with query ID `q_1a0a28c6ebc027`.
- Connection, collection, templates, mode/action and model controls were disabled during generation.

## Native execution evidence and packaging

The first macOS arm64 standalone build completed in 15m40s and passed ad-hoc signature verification. It ran with the explicit disposable profile and an embedded `tauri://localhost` frontend. The native menu exposed all actions, the template selector opened and selected Concise Chiron, and busy controls locked. Agent Run & Explain executed `COUNT dbm_smoke;`, returned count `1` with query ID `q_1a0a29363f5028`, and displayed “This query counts matching points. Results remain local.” alongside the local result.

This first bundle contained frontend assets from before the final SQL-to-ChironQL label/privacy-copy edit. Native inspection caught the mismatch; a second complete build was started from the final assets. Execution logic and template wiring were already present in the first bundle. The second build completed in 10m16s, passed local ad-hoc signature verification, and was launched as a foreground process on Kevin's existing profile. Final native inspection confirmed Generate/Explain/Optimize ChironQL labels and the updated privacy text. The template dropdown opened normally; this profile has no saved templates, so it showed the empty state. Templates can be created in Settings → AI → Scenario Prompt Templates. The original `test@ChironQL` workspace/query and saved model selection remained intact; no user-database query or live model request was submitted.

App at the actions/templates checkpoint (superseded by the attachment follow-up): `target/release/bundle/macos/Chiron Horizon.app`. Executable SHA-256: `a68699b72e1549ff2e7f0897d881a0b6ffc98f689b5f56e0bee7f81f14f5035c`. The final app is running with its embedded frontend and no Vite server. The earlier DMG was not rebuilt. Native evidence applies to macOS arm64 only; Windows, Linux and macOS Intel were not rerun for this update. No notarization is claimed.

The temporary native app, browser tab, Vite (1420) and disposable provider/web/ChironDB processes were stopped. Fixture evidence was retained. Kevin's application was reopened on its existing profile with the original `test@ChironQL` workspace. No release, tag, push, package publication or installation into `/Applications` is part of this update.

Sources: `apps/desktop/src/lib/ai/chironPrompt.ts`, `apps/desktop/src/components/editor/AiAssistant.vue`, `crates/chiron-horizon-core/src/ai_chiron.rs`, `crates/chiron-horizon-core/assets/chironql-reference.md`, `scripts/chirondb-smoke.mjs`.

Logs: `/tmp/chiron-horizon-actions-templates-tests-final.log`, `/tmp/chiron-horizon-actions-templates-types-final.log`, `/tmp/chiron-horizon-actions-templates-rust-tests-final.log`, `/tmp/chiron-horizon-actions-templates-build.log`, `/tmp/chiron-horizon-actions-templates-build-final.log`, `/tmp/chiron-horizon-actions-templates-fixture.log`.
