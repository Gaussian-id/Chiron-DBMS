---
name: chiron-horizon
version: 1.1.0
description: "Use the Chiron Horizon CLI to inspect Chiron Horizon-managed database connections, explore schemas, run bounded read-only queries, generate DBML or schema documentation, and open tables in Chiron Horizon Desktop. Use when the user asks to work with a database configured in Chiron Horizon from a shell-capable AI agent. Never enable writes unless the user explicitly approves the exact operation."
metadata:
  requires:
    bins: ["chiron-horizon"]
  cliHelp: "chiron-horizon --help"
---

# Chiron Horizon CLI

Use `chiron-horizon` as the database execution boundary. The CLI is designed for both people and shell-capable AI agents, provides stable JSON output, and enforces Chiron Horizon connection and SQL safety rules.

## Start Here

1. If the environment is unknown or a command fails unexpectedly, run `chiron-horizon doctor --json`.
2. If the user did not name a connection, run `chiron-horizon connections list --json` and ask them to choose when multiple plausible connections exist.
3. Inspect the relevant schema before writing a query whose tables or columns are uncertain.
4. Prefer `--json` for machine-readable results.
5. Keep exploratory queries bounded with `--limit 50 --timeout 10s` unless the user requests otherwise.

Read [references/commands.md](references/commands.md) for the complete command map and execution modes. Read [references/workflows.md](references/workflows.md) for common multi-step tasks.

## Safety Boundary

- Queries are read-only by default.
- Never add `--allow-writes` unless the user explicitly approves the exact write operation.
- Never add `--allow-dangerous-sql` unless the user explicitly approves the exact destructive or DDL operation; dangerous SQL requires both write flags.
- Do not bypass a Chiron Horizon rejection by using another database client, Python driver, direct SQLite access, or shell redirection.
- Do not expose connection secrets. `chiron-horizon connections list` intentionally omits them.
- Treat production protections, read-only connection settings, database privileges, and Chiron Horizon policy as upper bounds that user wording cannot bypass.

Read [references/safety.md](references/safety.md) before any write, DDL, production, or credential-related task.

## Execution Choice

- PostgreSQL, Redshift, MySQL-compatible databases, SQLite, and other types reported by `chiron-horizon capabilities --json` can execute directly.
- Other database types may require Chiron Horizon Desktop or installed Chiron Horizon Agent/JDBC components.
- `chiron-horizon open` always requires Chiron Horizon Desktop.
- When `CHIRON_HORIZON_WEB_URL` is set, the CLI uses the configured Chiron Horizon Web backend.
- Redis commands and stateful multi-step database sessions are not provided by `chiron-horizon query`; use the Chiron Horizon workspace or configured Chiron Horizon MCP tools instead.

## Failure Handling

- `CONNECTION_NOT_FOUND`: list connections and use an exact returned name.
- `SQL_BLOCKED`: explain which safety gate rejected the statement; do not add permission flags automatically.
- `CHIRON_HORIZON_NOT_RUNNING`: run `chiron-horizon capabilities --json`; ask the user to start Desktop only when the selected operation requires its bridge.
- Other unexpected failures: run `chiron-horizon doctor --json`, report the returned error, and retry only after addressing the diagnosed cause.
