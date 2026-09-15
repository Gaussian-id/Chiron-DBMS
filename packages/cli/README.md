# Gauss Horizon CLI

Command line interface for Gauss Horizon database connections, schema inspection, safe queries, and prompt-ready schema context.

## Availability in 0.1.0

The standalone npm and native CLI distributions are deferred for 0.1.0. Build the CLI from this source tree when it is needed for development:

```bash
cargo build --release -p gauss-horizon-cli
```

Use the desktop application's built-in MCP service for supported client integrations.

## Usage

```bash
gauss-horizon doctor
gauss-horizon capabilities
gauss-horizon connections list --json
gauss-horizon connections list --format csv
gauss-horizon schema list local --json
gauss-horizon schema describe local users --json
gauss-horizon query local "select count(*) as total from users" --json
gauss-horizon query local "select id, name from users" --format csv
gauss-horizon query local "select * from users" --limit 50 --timeout 10s --json
gauss-horizon query local --file ./query.sql --json
gauss-horizon context local --tables users,orders
gauss-horizon open local users
```

## Commands

| Command                                     | Description                                           |
| ------------------------------------------- | ----------------------------------------------------- |
| `gauss-horizon doctor`                                | Show local Gauss Horizon config and desktop bridge diagnostics  |
| `gauss-horizon capabilities`                          | Show direct-query and desktop-bridge database support |
| `gauss-horizon connections list`                      | List Gauss Horizon connections without printing secrets         |
| `gauss-horizon schema list <connection>`              | List tables and views                                 |
| `gauss-horizon schema describe <connection> <table>`  | Show table columns                                    |
| `gauss-horizon query <connection> <sql>`              | Execute one SQL statement                             |
| `gauss-horizon query <connection> --file ./query.sql` | Execute SQL from a file                               |
| `gauss-horizon context <connection>`                  | Print compact schema context for prompts              |
| `gauss-horizon open <connection> <table>`             | Open a table in Gauss Horizon Desktop                           |

## Output

Use `--json` or `--format json` for stable machine-readable output. Use `--format csv` for query, connection, and schema data that should be piped into other command line tools.

Errors are written to stderr and return a non-zero exit code.

## Query Controls

`gauss-horizon query` is read-only by default.

Use `--limit <n>` to control returned query rows and `--timeout <duration>` to control query timeout. Durations accept `ms`, `s`, or `m`, such as `500ms`, `10s`, or `1m`.

Use `--allow-writes` for non-dangerous write statements. Dangerous SQL such as `DROP`, `TRUNCATE`, and `ALTER` requires both `--allow-writes` and `--allow-dangerous-sql`.

For SQL that starts with a dash, pass `--` before the SQL:

```bash
gauss-horizon query local --json -- "-- comment
select 1"
```

## Default Connection

Set `GAUSS_HORIZON_CONNECTION` to omit the connection name for query and context commands:

```bash
GAUSS_HORIZON_CONNECTION=local gauss-horizon query "select 1" --json
GAUSS_HORIZON_CONNECTION=local gauss-horizon context --tables users,orders
```

## Desktop App Requirements

Some CLI commands can run without Gauss Horizon Desktop:

- `connections list`
- `schema list`
- `schema describe`
- `query`
- `context`

Direct execution supports PostgreSQL/Redshift, MySQL-compatible databases (MySQL, Doris, StarRocks), and SQLite. Other database types use the Gauss Horizon Desktop bridge or Gauss Horizon Agent/JDBC infrastructure.

Use `gauss-horizon doctor` to check whether the Gauss Horizon connection database, connection table, native SQLite loader, and desktop bridge are available. Use `gauss-horizon capabilities` to list direct-query and bridge-required database types.

If the optional platform package was not installed, reinstall without `--no-optional`:

```bash
npm uninstall -g @gauss-horizon/cli
npm install -g @gauss-horizon/cli
```

The native CLI does not require `better-sqlite3` and is not coupled to the Node.js ABI.

## Error Codes

CLI JSON errors use stable codes:

| Code                     | Meaning                                             |
| ------------------------ | --------------------------------------------------- |
| `UNKNOWN_OPTION`         | An unsupported flag was provided                    |
| `INVALID_OPTION`         | A flag is missing a value or has an invalid value   |
| `INVALID_ARGUMENT`       | Positional arguments are missing or conflicting     |
| `CONNECTION_STORE_ERROR` | Gauss Horizon connection storage exists but could not be read |
| `CONNECTION_NOT_FOUND`   | No Gauss Horizon connection matched the requested name        |
| `SQL_BLOCKED`            | SQL safety rules blocked execution                  |
| `GAUSS_HORIZON_NOT_RUNNING`        | Gauss Horizon Desktop bridge is unavailable                   |
| `ERROR`                  | Unexpected runtime failure                          |

## Codex

Codex can call the CLI directly from shell tools:

```bash
gauss-horizon schema describe local users --json
gauss-horizon context local --tables users,orders | codex exec "Write a retention query"
```
