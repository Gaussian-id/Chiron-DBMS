# ChironDB AI attachments

Date: 2026-09-15 (Asia/Jakarta). Branch: `codex/gauss-horizon-0.1.0`.

Kevin reported that attaching files remained unavailable after the composer/actions/template updates. The ChironDB-only disabled button and native rejection have been removed. The shared picker, drag/drop, image paste, preview/removal and text encoding controls now feed the native AI path.

## Behavior and boundaries

- Supported inputs follow the existing shared composer: PNG/JPEG/GIF/WebP and text-like files (CSV, TSV, TXT, Markdown, JSON, YAML, XML and logs). PDF/Office parsing was not added. Gemini rejects GIF; actual image understanding depends on the selected model, and provider errors remain visible.
- Explicit text attachments and structured inline images are carried in optional native request fields, with backwards-compatible defaults. Text is labeled untrusted data rather than user instructions or execution approval. Images use the existing provider-specific multimodal serializers.
- Text limits: eight files, up to 12,000 UTF-16 characters per file and 32,000 total, with the existing 48 KiB read-prefix limit, visible truncation and encoding controls. Backend validation rejects payloads exceeding these limits instead of silently dropping content. The separate user/template/editor prompt limit remains 32 KiB.
- Images: four, up to 5 MiB decoded per image and 12 MiB total. Backend checks MIME, base64 validity, nonempty content and size before provider/database dispatch. Unsupported types fail visibly.
- File-only sends use “Describe the attached files.” Files are snapshotted for one send and displayed with that message. File bytes remain transient: saved history keeps attachment references but not contents, and a later ordinary request does not replay them. Reattaching is required after reload.
- Picker, paste/drop entry points and send guard honor native busy/attachment-reading state. A parser correction may receive the same explicit attachments once, before any query executes.
- Ask/generate-only and exact write/destructive approval remain unchanged. User-selected file data is explicitly shared with the configured provider; query results are still local unless the separate preview-sharing consent is used. Table/SQL-library mentions remain unavailable in the native path.

## Verification

- 97 frontend tests passed across nine files, including attachment decoding/budgets/provider capability and existing native lifecycle/action/result/privacy tests. Vue/TypeScript and focused lint passed.
- 20 Rust tests passed (six credential/attachment-limit tests and 14 native connector tests). New tests inspect actual synthetic HTTP provider payloads for text plus image parts, truncation metadata, no replay on the next request, write approval retained, attachments present during parser repair, invalid base64 rejected before dispatch, and size/count/Unicode bounds.
- Branding audit and whitespace check passed.
- Browser UI on the disposable profile selected a TXT and PNG together through the real + file picker. Text encoding, image preview and removal worked. Send was disabled while files were loading and enabled after reading completed, including with an empty typed prompt. UI verification caught a separate native send-readiness condition still requiring text; it was fixed, the 97 tests/typecheck rerun successfully, and the in-progress build restarted to include the correction. No attachment request was submitted through the older fixture web executable; new request transport is covered by the Rust HTTP tests and the native verification below.

## Native verification and final artifact

- Final macOS arm64 standalone build completed in 12m58s and passed local ad-hoc signature verification. It loaded the embedded `tauri://localhost` frontend without Vite. No notarization is claimed.
- Native verification used an explicit disposable profile and the visible Disposable ChironDB connection. The native + button opened the macOS file picker; TXT and PNG were selected together. Both attachment cards and text encoding controls appeared. Sending “Attachment UI check” locked the composer controls and returned “Attachment check passed: text file and PNG received. Nothing was executed.”
- Captured synthetic provider HTTP payloads contained the text marker and exact valid PNG bytes as structured image content, plus the untrusted-data label. A subsequent Explain request had neither image parts nor the attachment text marker and completed successfully.
- Read-only inspection of the disposable conversation database confirmed saved TXT/PNG references and absence of the text marker and image base64. Browser verification covered file-only send readiness; the native end-to-end send used the explicit test prompt.
- The first PNG test constant had an invalid IDAT checksum. It was replaced with a generated, valid one-pixel PNG before native verification, and all 20 Rust tests passed again. This fixture correction did not change application code.
- Temporary browser/Vite, provider/web/ChironDB fixture processes and the native test app were stopped. Fixture files and evidence were retained. Kevin's updated app was reopened on the existing `test@ChironQL` workspace, preserving its query, saved connections and MiniMax-M3 model selection. Its attachment button is enabled and privacy copy includes attached files/images. The pre-existing connection timeout for `test` remains; no data query or AI request was submitted on that profile.

Final app: `target/release/bundle/macos/Gauss Horizon.app`. Executable SHA-256: `d9fa7e0464a8106a33b866f0b0bdccce988eabfd86aa35f001e63efbb86fca1b`. The DMG was not rebuilt. Windows/Linux/macOS Intel native acceptance was not rerun. No installation into `/Applications`, commit, push, tag or publication occurred.

AI verification used synthetic files, a synthetic local OpenAI-compatible provider and disposable ChironDB. This proves attachment transport and application behavior, not a live model's visual understanding. No user file was uploaded to a live provider.

Sources: `apps/desktop/src/components/editor/AiAssistant.vue`, `apps/desktop/src/types/chirondb.ts`, `crates/gauss-horizon-core/src/ai_chiron.rs`, `crates/gauss-horizon-core/tests/chirondb_connector.rs`, `crates/gauss-horizon-core/tests/ai_credentials.rs`.

Logs: `/tmp/gauss-horizon-attachments-tests-final.log`, `/tmp/gauss-horizon-attachments-types-final.log`, `/tmp/gauss-horizon-attachments-rust-final.log`, `/tmp/gauss-horizon-attachments-build-final.log`, `/tmp/gauss-horizon-attachments-fixture-final.log`. Initial/pre-correction logs retain the same prefix without `-final`.
