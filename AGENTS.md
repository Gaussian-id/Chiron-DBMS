# Chiron Horizon engineering rules

- DBX upstream is `https://github.com/t8y2/dbx.git` (`dbx-upstream`). Before any integration: fetch and fast-forward `origin/main`, then run `git fetch dbx-upstream --tags --prune`.
- Integrate the newest stable DBX release tag. Preserve Chiron Horizon branding, ChironDB support, migration compatibility, and English documentation while resolving conflicts.
- The application release line is `0.1.x`: begin at `0.1.0`, then increment the patch for every completed update (`0.1.1`, `0.1.2`, …) until an approved `1.0.0` release.
- Run `node scripts/bump-app-version.mjs patch` before validation. Create and push annotated `v<version>` tags only after the release commit is on `main`, required CI is green, and the tag matches `src-tauri/tauri.conf.json`.
- Keep work uncommitted while implementing. Commit only when the feature works in development, relevant tests and type checks pass, `git diff --check` passes, and the staged diff is ready to push with no follow-up changes.
- For desktop or upstream work, run branding audit, desktop typecheck, database availability tests, focused affected tests, and affected Rust checks. Pull `origin/main` again before opening or merging a PR.
