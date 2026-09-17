# Chiron Horizon CLI

Command line interface for Chiron Horizon database connections, schema inspection, safe queries, and prompt-ready schema context.

## Availability in 0.1.0

The standalone npm and native CLI distributions are deferred for 0.1.0. Build the CLI from this source tree when it is needed for development:

```bash
cargo build --release -p chiron-horizon-cli
```

Use the desktop application's built-in MCP service for supported client integrations.

## Usage

```bash
chiron-horizon doctor
chiron-horizon capabilities
chiron-horizon connections list --json
chiron-horizon connections list --format csv
chiron-horizon schema list local --json
chiron-horizon schema describe local users --json
chiron-horizon query local "select count(*) as total from users" --json
chiron-horizon query local "select id, name from users" --format csv
chiron-horizon query local "select * from users" --limit 50 --timeout 10s --json
chiron-horizon query local --file ./query.sql --json
chiron-horizon context local --tables users,orders
chiron-horizon open local users
```

## Commands

| Command                                     | Description                                           |
| ------------------------------------------- | ----------------------------------------------------- |
| `chiron-horizon doctor`                                | Show local Chiron Horizon config and desktop bridge diagnostics  |
| `chiron-horizon capabilities`                          | Show direct-query and desktop-bridge database support |
| `chiron-horizon connections list`                      | List Chiron Horizon connections without printing secrets         |
| `chiron-horizon schema list <connection>`              | List tables and views                                 |
| `chiron-horizon schema describe <connection> <table>`  | Show table columns                                    |
| `chiron-horizon query <connection> <sql>`              | Execute one SQL statement                             |
| `chiron-horizon query <connection> --file ./query.sql` | Execute SQL from a file                               |
| `chiron-horizon context <connection>`                  | Print compact schema context for prompts              |
| `chiron-horizon open <connection> <table>`             | Open a table in Chiron Horizon Desktop                           |

## Output

Use `--json` or `--format json` for stable machine-readable output. Use `--format csv` for query, connection, and schema data that should be piped into other command line tools.

Errors are written to stderr and return a non-zero exit code.

## Query Controls

`chiron-horizon query` is read-only by default.

Use `--limit <n>` to control returned query rows and `--timeout <duration>` to control query timeout. Durations accept `ms`, `s`, or `m`, such as `500ms`, `10s`, or `1m`.

Use `--allow-writes` for non-dangerous write statements. Dangerous SQL such as `DROP`, `TRUNCATE`, and `ALTER` requires both `--allow-writes` and `--allow-dangerous-sql`.

For SQL that starts with a dash, pass `--` before the SQL:

```bash
chiron-horizon query local --json -- "-- comment
select 1"
```

## Default Connection

Set `CHIRON_HORIZON_CONNECTION` to omit the connection name for query and context commands:

```bash
CHIRON_HORIZON_CONNECTION=local chiron-horizon query "select 1" --json
CHIRON_HORIZON_CONNECTION=local chiron-horizon context --tables users,orders
```

## Desktop App Requirements

Some CLI commands can run without Chiron Horizon Desktop:

- `connections list`
- `schema list`
- `schema describe`
- `query`
- `context`

Direct execution supports PostgreSQL/Redshift, MySQL-compatible databases (MySQL, Doris, StarRocks), and SQLite. Other database types use the Chiron Horizon Desktop bridge or Chiron Horizon Agent/JDBC infrastructure.

Use `chiron-horizon doctor` to check whether the Chiron Horizon connection database, connection table, native SQLite loader, and desktop bridge are available. Use `chiron-horizon capabilities` to list direct-query and bridge-required database types.

If the optional platform package was not installed, reinstall without `--no-optional`:

```bash
npm uninstall -g @chiron-horizon/cli
npm install -g @chiron-horizon/cli
```

The native CLI does not require `better-sqlite3` and is not coupled to the Node.js ABI.

## Error Codes

CLI JSON errors use stable codes:

| Code                     | Meaning                                             |
| ------------------------ | --------------------------------------------------- |
| `UNKNOWN_OPTION`         | An unsupported flag was provided                    |
| `INVALID_OPTION`         | A flag is missing a value or has an invalid value   |
| `INVALID_ARGUMENT`       | Positional arguments are missing or conflicting     |
| `CONNECTION_STORE_ERROR` | Chiron Horizon connection storage exists but could not be read |
| `CONNECTION_NOT_FOUND`   | No Chiron Horizon connection matched the requested name        |
| `SQL_BLOCKED`            | SQL safety rules blocked execution                  |
| `CHIRON_HORIZON_NOT_RUNNING`        | Chiron Horizon Desktop bridge is unavailable                   |
| `ERROR`                  | Unexpected runtime failure                          |

## Codex

Codex can call the CLI directly from shell tools:

```bash
chiron-horizon schema describe local users --json
chiron-horizon context local --tables users,orders | codex exec "Write a retention query"
```
