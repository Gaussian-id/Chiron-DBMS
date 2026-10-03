# Chiron Horizon changelog

Canonical repository: [Gaussian-id/Chiron-DBMS](https://github.com/Gaussian-id/Chiron-DBMS).

The in-application changelog checks the canonical file on GitHub and falls back to the copy bundled with the installed build. Detailed, landing-page-ready notes are kept in [`docs/releases`](docs/releases/).

## 0.1.5

Stable upstream 0.6.31 integration with verified dependency hashes and cross-platform runtime packaging.

- Includes the preserved Horizon features and backup-lock correction prepared in 0.1.3 and 0.1.4.
- Restores seven Go checksum entries to the exact pinned upstream bytes and rejects malformed checksums during the branding audit.
- Runs Windows Java runtime packaging with Bash and normalizes the installed JDK path.
- Builds every Go agent target from fresh dependencies and packages Java runtimes on all four PR verification platforms before tagging.

The 0.1.3 and 0.1.4 tags did not produce public releases. This patch supersedes those unpublished builds.

See [the full 0.1.5 release notes](docs/releases/v0.1.5.md).

## 0.1.4

Stable upstream 0.6.31 integration with reliable scheduled-backup leadership release.

- Includes the Horizon features and upstream improvements prepared in 0.1.3.
- Explicitly releases backup worker locks on stop, drain, cancellation, and failed startup, even while another process retains a duplicated handle.
- Adds a deterministic lock-lifecycle regression and runs the complete Rust core suite in Linux PR verification before tagging.

The 0.1.3 tag did not produce a public release because preflight caught the backup-lock race. This patch supersedes that unpublished build.

See [the full 0.1.4 release notes](docs/releases/v0.1.4.md).

## 0.1.3

Stable upstream 0.6.31 integration with Horizon feature preservation.

- Integrated the reorganized Rust workspace, database and plugin improvements, and new driver support.
- Preserved native ChironDB, ChironDB Relational, Schema Viewer, migration compatibility, the database version monitor, and Horizon branding.
- Restored the native ChironDB assistant in the updated UI and protected AI credentials through upgrades and sync imports.
- Registered 86 connection types and 110 profiles and corrected desktop/driver release packaging.

See [the full 0.1.3 release notes](docs/releases/v0.1.3.md).

## 0.1.2

Context-aware schema inspection and complete database access registration.

- Added a Schema Viewer that selects an ERD, metagraph, expandable declared-JSON tree, metadata summary, or composite view from each connection's storage model.
- Registered explicit access and Schema Viewer contracts for all 82 connection types and their merged/versioned profiles.
- Added native-metadata adapters and safe partial/absent/not-exposed states without sampling MongoDB documents, Weaviate objects, Redis values, service payloads, or messages.
- Added the ChironDB Relational PostgreSQL-wire profile and verified Horizon connect, DDL/DML, joins, and table/column discovery against a local ChironDB build.
- Preserved permission failures as errors while improving scoped MongoDB metadata access and partial relational metadata notices.
- Corrected the Settings appearance preview to use the Gauss logo.

See [the full 0.1.2 release notes](docs/releases/v0.1.2.md).

## 0.1.1

Upstream v0.6.16 synchronization and release hardening.

- Integrated upstream v0.6.16 while preserving Chiron Horizon branding, ChironDB support, and migration compatibility.
- Aligned application, agent, JDBC, documentation, and release-asset versions on the `0.1.x` line.
- Hardened tag/version checks, checksums, Agent registry generation, and platform release packaging.

See [the full 0.1.1 release notes](docs/releases/v0.1.1.md).

## 0.1.0

The `v0.1.0` tag triggers the GitHub Release pipeline for desktop installers and Agent assets. macOS bundles use ad-hoc signing and the Windows installer is unsigned in this first release. Package-manager (`@chiron-horizon/*`) publication is deferred; application auto-update remains disabled.

Initial Chiron Horizon version.

- Chiron Horizon identity, profile migration and refreshed Black icon variant.
- Native ChironDB HTTP connection, collection browsing and ChironQL execution.
- Natural-language ChironQL assistant with encrypted credentials, parser validation, human write approval, durable history and consent-scoped result sharing.
- Sequential manual scripts with per-statement results and approvals, Run-local USE context, and Mac/Windows/Linux line-comment shortcuts.
- Offline changelog and build-only desktop CI. Automatic updates are disabled.

Build success, native platform acceptance and distribution signing are separate checks. See the development verification notes for actual results.

See [the full 0.1.0 release notes](docs/releases/v0.1.0.md).
