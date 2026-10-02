# Crates

Rust crates for Chiron Horizon live here.

## Directories

- `chiron-horizon-core/` - application orchestration: connections, queries, schema operations, data workflows, AI tools, administration, persistence, safety, and host services.
- `chiron-horizon-types/` - shared connection, query, metadata, and serialization contracts; generated database identities.
- `chiron-horizon-sql/` - SQL parsing, dialects, analysis, risk classification, DDL/DML generation, and schema diff planning.
- `chiron-horizon-drivers/` - native database adapters, database Agents, tunnels, execution budgets, and driver lifecycle.
- `chiron-horizon-formats/` - data formatting and file encoders, independent of database connections.
- `chiron-horizon-ai-provider/` - AI provider clients, CLI adapters, streaming, and token usage.
- `chiron-horizon-plugin-runtime/` - plugin packages, signatures, marketplace, subprocess sessions, and host requests.
- `chiron-horizon-platform/` - shared process, path, proxy, download, version, and host-prompt primitives.
- `chiron-horizon-web/` - the Docker/web backend service binary published as `chiron-horizon-web`.
- `chiron-horizon-cli/` - the command-line application.
- `chiron-horizon-mcp/` - the MCP service library and binary.
- `chiron-horizon-sqlite-worker/` - the isolated SQLite file-host worker and protocol.

The workspace root is defined in the repository-level `Cargo.toml`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for dependency rules, compatibility exports, feature selection, and validation commands.
