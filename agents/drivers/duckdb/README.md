# Chiron Horizon DuckDB Standalone Driver

This directory contains the standalone Rust DuckDB sidecar. It reuses Chiron Horizon's
existing newline-delimited JSON worker runtime, while keeping DuckDB and
`libduckdb-sys` outside the main application dependency graph.

## Build

```bash
cd agents/drivers/duckdb
cargo build --release --bin chiron-horizon-duckdb-driver
```

Point Chiron Horizon at the resulting executable with:

```bash
CHIRON_HORIZON_DUCKDB_DRIVER_PATH=/absolute/path/to/chiron-horizon-duckdb-driver \
  cargo run -p chiron-horizon --no-default-features --features duckdb-sidecar
```

Release builds publish this driver through the Chiron Horizon driver registry. Driver
Manager installs it as `~/.chiron-horizon/agents/drivers/duckdb/agent` (or `agent.exe` on
Windows). `CHIRON_HORIZON_DUCKDB_DRIVER_PATH` remains available for local development.

## Release package

Each platform is published as a self-contained `.tar.zst` package used by both
online Driver Manager installation and manual single-driver import:

```text
agent-registry.json
drivers/chiron-horizon-agent-duckdb-<version>-<platform>[.exe]
```

Chiron Horizon decompresses the package itself, so users do not need to install `zstd`,
DuckDB, or a separate database driver. The existing aggregate offline `.zip`
packages remain supported for backward compatibility.

Windows MSVC artifacts statically link the Visual C++ runtime so they also run
on fresh Windows installations without a separate redistributable package.

## Current scope

The driver implements connect, execute, database/schema/table/column metadata,
table DDL, view source, completion assistance, attach, cancel, and shutdown over
the Chiron Horizon sidecar protocol.
