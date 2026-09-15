# Gauss Horizon 0.1.0

Gauss Horizon 0.1.0 is the first Gaussian desktop release. It provides the Gauss Horizon desktop workbench, ChironDB and external database connections, the scoped MCP server, AI Ask/Agent workflows, multi-statement ChironQL execution with per-write approval, and offline connection migration from earlier local profiles.

Download the installer for your platform and verify it with `SHA256SUMS` before opening it. The release contains `.dmg` files for macOS Apple Silicon and Intel, an NSIS installer for Windows x64, and `.deb` and AppImage packages for Ubuntu 22.04+ x64. macOS bundles use ad-hoc signing only, and the Windows installer is unsigned for this first release; Gatekeeper or SmartScreen may require an explicit user confirmation.

Java and native database Agents, managed JRE 21 archives, per-agent packages, offline Agent bundles, and `agent-registry.json` are included in this release. The application downloads only those Gauss Horizon release assets for Agent installation. Application auto-updates are disabled.

The `@gauss-horizon/*` npm packages are intentionally not published in 0.1.0.
