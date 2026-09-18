# Chiron Horizon changelog

Canonical repository: [Gaussian-id/Chiron-Horizon](https://github.com/Gaussian-id/Chiron-Horizon).

## 0.1.0

The `v0.1.0` tag triggers the GitHub Release pipeline for desktop installers and Agent assets. macOS bundles use ad-hoc signing and the Windows installer is unsigned in this first release. Package-manager (`@chiron-horizon/*`) publication is deferred; application auto-update remains disabled.

Initial Chiron Horizon version.

- Chiron Horizon identity, profile migration and refreshed Black icon variant.
- Native ChironDB HTTP connection, collection browsing and ChironQL execution.
- Natural-language ChironQL assistant with encrypted credentials, parser validation, human write approval, durable history and consent-scoped result sharing.
- Sequential manual scripts with per-statement results and approvals, Run-local USE context, and Mac/Windows/Linux line-comment shortcuts.
- Offline changelog and build-only desktop CI. Automatic updates are disabled.

Build success, native platform acceptance and distribution signing are separate checks. See the development verification notes for actual results.
