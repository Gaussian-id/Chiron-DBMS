---
name: gauss-horizon
version: 1.0.0
description: "Gauss Horizon CLI for database schema exploration and read-only queries. When the user needs to list connections, explore tables, describe schemas, run queries, or generate AI-friendly schema context from Gauss Horizon-managed databases. Do NOT use for write operations unless the user explicitly confirms with --allow-writes."
metadata:
  requires:
    bins: ["gauss-horizon"]
  cliHelp: "gauss-horizon --help"
---

# Gauss Horizon CLI

> **Prerequisite:** Gauss Horizon Desktop must be installed and configured with at least one connection. Run `gauss-horizon doctor` to verify setup. Install CLI: `npm install -g @gauss-horizon/cli`

## Core Concepts

- **Connection**: A named database connection configured in Gauss Horizon Desktop (e.g. "prod", "local"). Identified by name.
- **Schema**: Tables and views within a connection. Listed via `gauss-horizon schema list`.
- **Query**: Read-only SQL executed against a connection. Gated by `--allow-writes` and `--allow-dangerous-sql`.
- **Context**: Compact schema dump optimized for AI prompts — smaller and more focused than full schema output.

## Resource Relationships

```
Gauss Horizon Desktop
├── Connection (named)
│   ├── Schema (tables, views)
│   │   └── Table
│   │       └── Column (name, type, nullable, default)
│   └── Query (read-only by default)
└── Context (prompt-optimized schema dump)
```

## Commands

> **⛔ NEVER bypass gauss-horizon CLI for database operations.** If `gauss-horizon` returns `SQL_BLOCKED` or any error, do NOT use Python sqlite3, shell redirects, or any other tool to access the database directly. Always respect the CLI's safety gates. When in doubt, tell the user what the CLI returned and ask for their decision.

### 1. Check Setup

```bash
gauss-horizon doctor
gauss-horizon capabilities
```

Use `doctor` when the agent starts or when a command fails — it reveals whether the desktop bridge, connection DB, and native SQLite loader are available. Use `capabilities` to check which databases support direct execution vs require the desktop bridge.

### 2. List Connections

```bash
gauss-horizon connections list --json
```

Returns connections without exposing secrets. Parse JSON to present a clean list to the user. Always run this first before any schema or query operation — the user might not remember connection names.

### 3. Explore Schema

```bash
# List all tables in a connection
gauss-horizon schema list <connection> --json

# Describe a specific table
gauss-horizon schema describe <connection> <table> --json
```

Use `schema list` to survey what's available, then `schema describe` on specific tables the user asks about. Present column names, types, and nullability clearly.

### 4. Execute Queries

```bash
# Read-only query (default)
gauss-horizon query <connection> "SELECT ..." --json

# From file
gauss-horizon query <connection> --file ./query.sql --json

# With row limit and timeout
gauss-horizon query <connection> "SELECT ..." --limit 50 --timeout 10s --json
```

**CRITICAL — Read-only by default.** Write operations (INSERT/UPDATE/DELETE) require `--allow-writes`. Dangerous SQL (DROP/TRUNCATE/ALTER) requires BOTH `--allow-writes` AND `--allow-dangerous-sql`. Never add these flags unless the user explicitly confirms a write operation.

If the SQL starts with a dash, separate with `--`:
```bash
gauss-horizon query local --json -- "-- comment
select 1"
```

### 5. Generate Context for Prompts

```bash
# Full schema context
gauss-horizon context <connection>

# Filtered to specific tables
gauss-horizon context <connection> --tables users,orders,products
```

Use `context` when the user wants to write a query but needs schema reference first. Pipe the output directly into the prompt — it's designed for this. Prefer `--tables` to limit scope and save tokens.

### 6. Default Connection

Set `GAUSS_HORIZON_CONNECTION` to skip the connection argument:

```bash
export GAUSS_HORIZON_CONNECTION=prod
gauss-horizon query "SELECT 1" --json
gauss-horizon context --tables users
```

Detect and use this if set in the environment.

## Output

| Flag | Use Case |
|------|----------|
| `--json` | Machine-readable, auto-parsed (always use this) |
| `--format csv` | Piping to other CLI tools |

Errors go to stderr with non-zero exit code. Run `gauss-horizon doctor` first if any command fails unexpectedly.

## Error Codes

| Code | Meaning | Agent Response |
|------|---------|---------------|
| `CONNECTION_NOT_FOUND` | Connection name doesn't exist | List available connections with `gauss-horizon connections list --json` |
| `SQL_BLOCKED` | Write operation attempted without `--allow-writes` | Ask user: "This is a write operation. Confirm?" Never add write flags automatically. |
| `GAUSS_HORIZON_NOT_RUNNING` | Desktop bridge unavailable | Tell user to open Gauss Horizon Desktop. Check which commands work without bridge via `gauss-horizon capabilities`. |
| `INVALID_OPTION` | Wrong flag or flag value | Check `gauss-horizon --help` and retry |
| `ERROR` | Unexpected runtime failure | Run `gauss-horizon doctor`, check logs, retry once |

## Direct vs Bridge Execution

PostgreSQL, MySQL (and compatible: Doris, StarRocks), SQLite run directly without Gauss Horizon Desktop. Other database types require the desktop bridge. Check with `gauss-horizon capabilities` to confirm.

## Common Pitfalls

1. **Wrong connection name** — Always list connections first with `gauss-horizon connections list --json` before running schema or query commands. Never assume connection names from conversation context.

2. **Schema confusion from context pollution** — When the user asks about a table, verify the connection and table exist before running queries. `gauss-horizon schema list <conn> --json` is your verification step.

3. **Write operations by accident** — Never add `--allow-writes` or `--allow-dangerous-sql` unless the user explicitly confirms. When in doubt, ask.

4. **Missing desktop bridge** — If `gauss-horizon open` or bridge-required connections fail, run `gauss-horizon doctor` and tell the user to open Gauss Horizon Desktop. Commands that don't require the bridge: `connections list`, `schema list`, `schema describe`, `query`, `context` (for PostgreSQL/MySQL/SQLite).

5. **Timeout on large queries** — Always use `--limit 50 --timeout 10s` for exploratory queries. Remove or increase limits only when the user explicitly asks for full results.

6. **JSON parse errors** — Old Gauss Horizon versions may not support `--json` on some commands. If JSON output looks malformed, try without `--json` and parse the human-readable output instead.

## Multi-Step Workflows

### Explore then Query

1. `gauss-horizon connections list --json` — verify connection exists
2. `gauss-horizon schema list <conn> --json` — survey available tables
3. `gauss-horizon schema describe <conn> <table> --json` — understand target table
4. `gauss-horizon query <conn> "SELECT ..." --limit 50 --timeout 10s --json` — execute
5. Present results to user with row count

### Generate Context then Help Write Query

1. `gauss-horizon context <conn> --tables a,b` — get compact schema
2. Read the output, understand relationships
3. Draft the SQL, show it to user for review
4. `gauss-horizon query <conn> "polished sql" --json` — execute after approval

### Cross-Connection Comparison

1. `gauss-horizon connections list --json` — identify source and target
2. `gauss-horizon schema describe <source_conn> <table> --json` — get source structure
3. `gauss-horizon schema describe <target_conn> <table> --json` — get target structure
4. Compare and report differences
