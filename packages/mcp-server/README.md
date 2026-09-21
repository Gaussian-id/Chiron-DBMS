# Chiron Horizon MCP Server

Rust-powered Model Context Protocol server for [Chiron Horizon](https://github.com/Gaussian-id/Chiron-Horizon). It lets MCP-compatible AI agents inspect schemas and run safe database operations using connections configured in Chiron Horizon.

[Source repository](https://github.com/Gaussian-id/Chiron-Horizon) | [Desktop MCP guide](../../docs/content/docs/mcp.mdx)

## Architecture

```text
Chiron Horizon desktop MCP service
└── local Streamable HTTP endpoint with a bearer token
    └── chiron-horizon-core database and agent infrastructure

Development stdio server
└── Rust chiron-horizon-mcp binary built from the matching source revision
```

The MCP protocol, connection loading, SQL safety, schema access, Redis support, MongoDB shell parsing, Web backend access, and database execution are implemented in Rust.

## Features

- **18 MCP tools** for connection and database discovery, schemas, SQL, Redis, sessions, messages, and Chiron Horizon UI integration
- **No `better-sqlite3` runtime dependency** and no Node native-addon ABI coupling
- **Local, Web, and Docker modes** using the same tool interface
- **Optional Streamable HTTP transport** protected by a bearer token, while stdio remains the default
- **Direct native execution** for supported SQL, Redis, and MongoDB connections
- **Agent/JDBC database support** through Chiron Horizon agent infrastructure when the required agent and JRE are installed
- **Chiron Horizon-managed access policy** with a connection allowlist and three execution modes
- **SQL, Redis, and MongoDB safety controls** that reload the policy for every request
- **Optional desktop integration** for opening tables and displaying query results in Chiron Horizon

## Installation

Chiron Horizon 0.1.0 provides the managed MCP service in the desktop application. Configure an MCP client with the local Streamable HTTP endpoint and bearer token shown in **Settings → MCP**.

The npm package and prebuilt stdio distribution are deferred for this release. To run the Rust stdio server during development, build it from the checked-out source tree:

```bash
cargo build --release -p chiron-horizon-mcp --no-default-features
```

Then configure the MCP client to run the produced `chiron-horizon-mcp` executable. Verify its source revision and build it with the same version as the desktop application.

## Requirements

### Desktop and source requirements

- The desktop MCP service needs a running Chiron Horizon desktop application.
- The development stdio server requires the matching Rust toolchain and source revision.

### Database configuration

Chiron Horizon MCP reads connection profiles from Chiron Horizon storage. Chiron Horizon does not need to remain open for native connections. However:

- the connection must already exist in Chiron Horizon storage, unless it is added through `chiron_horizon_add_connection`;
- Chiron Horizon Agent/JDBC databases require the matching agent, JDBC driver, and JRE to be installed;
- `chiron_horizon_open_table` and `chiron_horizon_execute_and_show` require a running Chiron Horizon desktop application;
- Chiron Horizon Web mode requires a reachable Chiron Horizon Web server.

## Usage Examples

Ask the MCP client to:

- "List my Chiron Horizon connections"
- "Show tables in the production PostgreSQL connection"
- "Describe the `orders` table"
- "Build schema context for the billing database"
- "Count orders created in the last seven days"
- "Run `INFO memory` on the Redis connection"
- "Find the latest MongoDB documents in the events collection"
- "Open the orders table in Chiron Horizon"

## Tools

| Tool | Description |
| --- | --- |
| `chiron_horizon_list_connections` | List connections visible to the MCP session |
| `chiron_horizon_list_databases` | List databases available through a connection, respecting its MCP database scope |
| `chiron_horizon_add_connection` | Add a connection to Chiron Horizon storage |
| `chiron_horizon_duplicate_connection` | Duplicate a Chiron Horizon connection with its complete settings |
| `chiron_horizon_remove_connection` | Remove a connection from Chiron Horizon storage |
| `chiron_horizon_list_tables` | List tables, views, collections, or message queue topics |
| `chiron_horizon_describe_table` | Return columns and table metadata |
| `chiron_horizon_list_routines` | List stored procedures and functions in a schema, with an optional `routine_type` filter (PROCEDURE or FUNCTION) |
| `chiron_horizon_get_routine_source` | Return the source of a stored procedure or function by name, with an optional `signature` for overloaded names |
| `chiron_horizon_get_schema_context` | Return compact schema context suitable for an AI model |
| `chiron_horizon_execute_query` | Execute SQL or a supported MongoDB shell command, returning at most 100 rows |
| `chiron_horizon_execute_batch` | Execute a SQL script containing multiple statements in one call, returning a result per statement (or a single merged result with `use_transaction` on a multi-statement script) |
| `chiron_horizon_open_session` | Open a stateful SQL query session pinned to one backend connection |
| `chiron_horizon_close_session` | Close a session and release its pinned connection resources |
| `chiron_horizon_execute_redis_command` | Execute a Redis command |
| `chiron_horizon_peek_messages` | Read Kafka messages without committing consumer offsets |
| `chiron_horizon_send_message` | Send a message to a supported message queue topic |
| `chiron_horizon_open_table` | Open a table in the running Chiron Horizon desktop application |
| `chiron_horizon_execute_and_show` | Execute a query and display the result in the Chiron Horizon desktop application |

When connection scoping is enabled, mutating connection tools and desktop UI tools are hidden.

`chiron_horizon_peek_messages` reads a Kafka topic in local or Web mode when `mq-admin` is enabled. Pass `connection_id` or `connection_name`, `topic`, optional `count` (1–100, default 20), `start_position` (`latest` by default, `earliest`, or `offset`), and optional non-negative `partition`. A non-negative `offset` is required only in offset mode; without a partition it applies to all partitions. The JSON response preserves base64 payloads and metadata, reports broker partial reads via `incomplete`, and reports whole-message omissions under a 256 KiB output budget via `outputTruncated`. It respects connection/tool scopes and permits read-only and production reads without committing consumer offsets. It does not support other MQ types or continuous subscriptions.

`chiron_horizon_list_databases` returns only database names allowed by the selected connection's MCP database scope. `chiron_horizon_send_message` is available when message-queue support is included in the server build.

## Execution Modes

### Local native mode

This is the default. MCP reads Chiron Horizon connection storage and executes supported connections locally in the Rust process.

Common native paths include PostgreSQL, MySQL, SQLite, compatible SQL databases, Redis standalone, and MongoDB. SSH, cluster, vendor-specific, or Agent/JDBC connections may require additional Chiron Horizon infrastructure.

DuckDB runs through the standalone Chiron Horizon DuckDB driver. Install it from Chiron Horizon Driver Manager before using a DuckDB connection through local MCP. The MCP binary includes the sidecar client but does not bundle the DuckDB engine.

Chiron Horizon connection storage defaults to:

- macOS: `~/Library/Application Support/id.chiron.horizon/chiron-horizon.db`
- Linux: `~/.local/share/id.chiron.horizon/chiron-horizon.db`
- Windows: `%APPDATA%\id.chiron.horizon\chiron-horizon.db`

Override the directory with `CHIRON_HORIZON_DATA_DIR`.

### Agent/JDBC databases

Databases such as Dameng, KingbaseES, Oracle, DB2, Hive, Trino, Snowflake, SAP HANA, and other Chiron Horizon Agent profiles use Chiron Horizon's Java agent infrastructure rather than a Node.js database driver.

The native npm/GitHub binary does not bundle every proprietary JDBC driver or JRE. Install the database agent through Chiron Horizon first, or provide a compatible agent installation under the Chiron Horizon agent directory. Availability depends on the installed driver and license terms of the database vendor.

### Chiron Horizon Web / Docker mode

Set `CHIRON_HORIZON_WEB_URL` to use a deployed Chiron Horizon Web backend instead of local desktop storage:

```json
{
  "mcpServers": {
    "chiron-horizon": {
      "command": "chiron-horizon-mcp-server",
      "env": {
        "CHIRON_HORIZON_WEB_URL": "https://chiron-horizon.example.com",
        "CHIRON_HORIZON_WEB_PASSWORD": "your-web-login-password"
      }
    }
  }
}
```

`CHIRON_HORIZON_WEB_PASSWORD` is the password used on the Chiron Horizon Web login page. Desktop-local mode does not use it. Desktop UI tools are hidden in Web mode.

Chiron Horizon Web requests honor the standard system proxy environment variables (`HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY`, bypass via `NO_PROXY`); an empty value means no proxy. Proxies requiring authentication use the `http://user:pass@host:port` URL form. Extra headers can be attached via `CHIRON_HORIZON_WEB_HEADERS` (a JSON object, e.g. `{"Authorization":"Bearer <token>"}`) — applied to every request, including authentication. For self-signed HTTPS backends, set `CHIRON_HORIZON_WEB_INSECURE_SKIP_VERIFY=1` to skip certificate verification, or `CHIRON_HORIZON_WEB_CA_CERT` to trust a private CA (verification is on by default).

Docker and Chiron Horizon Web also require the standalone DuckDB driver. Install it from Driver Manager after the first launch; when `/app/data` is persisted, the driver is stored under `/app/data/agents` and survives container upgrades.

### Native Streamable HTTP

The native server uses stdio by default. To host a local Streamable HTTP endpoint instead, start it with a bearer token:

```bash
CHIRON_HORIZON_MCP_HTTP_TOKEN=replace-with-a-long-random-secret chiron-horizon-mcp-server --http
```

It listens on `http://127.0.0.1:5225/mcp` by default. Configure an HTTP-capable MCP client with that URL and `Authorization: Bearer <token>`:

```json
{
  "type": "http",
  "url": "http://127.0.0.1:5225/mcp",
  "headers": {
    "Authorization": "Bearer replace-with-a-long-random-secret"
  }
}
```

The default loopback address accepts only clients on the same computer. Binding to a non-loopback address requires all of the following: `CHIRON_HORIZON_MCP_HTTP_ALLOW_REMOTE=1`, the `--http-allow-remote` flag, and non-empty `CHIRON_HORIZON_MCP_HTTP_ALLOWED_HOSTS` plus `CHIRON_HORIZON_MCP_HTTP_ALLOWED_ORIGINS` allowlists. Use exact public Host authorities and browser Origins.

Chiron Horizon Web can host native Streamable HTTP on its existing listener, rather than opening a second port. Enable it with `CHIRON_HORIZON_WEB_MCP_TOKEN` (or `CHIRON_HORIZON_WEB_MCP_TOKEN_FILE`) and configure the public Host allowlist. For a container published as `4225:4224`, the endpoint is `http://localhost:4225/mcp`:

```yaml
environment:
  CHIRON_HORIZON_WEB_MCP_TOKEN: replace-with-a-long-random-secret
  CHIRON_HORIZON_WEB_MCP_ALLOWED_HOSTS: localhost:4225
ports:
  - "4225:4224"
```

Clients send `Authorization: Bearer <CHIRON_HORIZON_WEB_MCP_TOKEN>`. Browser clients also require an exact `CHIRON_HORIZON_WEB_MCP_ALLOWED_ORIGINS` entry. When a reverse proxy adds a path prefix, set `CHIRON_HORIZON_PUBLIC_BASE_PATH`; the endpoint becomes `<base-path>/mcp`. Native HTTP and the `CHIRON_HORIZON_WEB_URL` stdio adapter can coexist and share the same Chiron Horizon policy.

### Windows portable Chiron Horizon

Point `CHIRON_HORIZON_DATA_DIR` at the portable `data` directory containing `chiron-horizon.db`:

```json
{
  "mcpServers": {
    "chiron-horizon": {
      "command": "chiron-horizon-mcp-server",
      "env": {
        "CHIRON_HORIZON_DATA_DIR": "D:\\CHIRON_HORIZON_x64-portable\\data"
      }
    }
  }
}
```

## Chiron Horizon-managed MCP Policy

Chiron Horizon stores one authoritative policy under **Settings → MCP** and reloads it for every request:

| Permission mode | Allowed operations |
| --- | --- |
| Read only | Queries and metadata reads |
| Data read/write | Regular inserts, effectively filtered updates/deletes, scoped MongoDB mutations, and ordinary Redis writes |
| Full access | Also permits broad updates/deletes, DDL, `TRUNCATE`, MongoDB destructive operations, and Redis `FLUSH*` |

**Allowed connections** controls which stable connection IDs MCP can list or resolve. Connection-level read-only protection, production protection, database credentials, and the allowlist remain upper bounds in every mode.

Conditions such as `WHERE TRUE`, `WHERE 1 = 1`, `_id: {$exists: true}`, complementary predicates, and opaque MongoDB filters remain high risk. Unknown Redis commands also fail closed.

Legacy connection scope variables can still narrow the Chiron Horizon allowlist for existing client configurations:

```json
{
  "mcpServers": {
    "chiron-horizon-production-scope": {
      "command": "chiron-horizon-mcp-server",
      "env": {
        "CHIRON_HORIZON_MCP_SCOPE_CONNECTION_NAME": "production-postgres",
        "CHIRON_HORIZON_MCP_SCOPE_DATABASE": "analytics"
      }
    }
  }
}
```

Use `CHIRON_HORIZON_MCP_SCOPE_CONNECTION_ID`, comma-separated `CHIRON_HORIZON_MCP_SCOPE_CONNECTION_IDS`, or `CHIRON_HORIZON_MCP_SCOPE_CONNECTION_NAME`. ID scopes take precedence over the name scope. The scoped database is optional.

## Safety

Choose **Read only**, **Data read/write**, or **Full access** in Chiron Horizon instead of placing permission flags in client configuration. Updated servers do not let `CHIRON_HORIZON_MCP_ALLOW_WRITES` or `CHIRON_HORIZON_MCP_ALLOW_DANGEROUS_SQL` widen the Chiron Horizon policy. For upgrade compatibility, `CHIRON_HORIZON_MCP_ALLOW_WRITES=0` (or `false`) keeps MCP read-only until a central policy is saved for the first time; the legacy permission variables are ignored afterward.

MongoDB update/delete operations require a verifiably effective filter unless Full access is enabled. Aggregation stages such as `$out` and `$merge` are treated as high-risk writes.

SQL text is not included in normal MCP errors or logged by default. Enable temporary diagnostics with `CHIRON_HORIZON_MCP_DEBUG_SQL=1` and disable it after troubleshooting.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `CHIRON_HORIZON_DATA_DIR` | Override the local Chiron Horizon data directory |
| `CHIRON_HORIZON_WEB_URL` | Use a Chiron Horizon Web/Docker backend |
| `CHIRON_HORIZON_WEB_PASSWORD` | Authenticate to the Chiron Horizon Web backend |
| `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` | Standard system proxy variables for Chiron Horizon Web requests; empty value means no proxy. Auth via `http://user:pass@host:port` |
| `NO_PROXY` | Standard comma-separated bypass list for the proxy above |
| `CHIRON_HORIZON_WEB_HEADERS` | JSON object of extra HTTP headers for Chiron Horizon Web requests, e.g. `{"Authorization":"Bearer token"}` |
| `CHIRON_HORIZON_WEB_INSECURE_SKIP_VERIFY` | `1`/`true` disables TLS certificate verification for self-signed backends |
| `CHIRON_HORIZON_WEB_CA_CERT` | PEM/DER CA file to trust for Chiron Horizon Web TLS verification |
| `CHIRON_HORIZON_WEB_MCP_TOKEN` | Enable native Chiron Horizon Web Streamable HTTP MCP with this bearer token |
| `CHIRON_HORIZON_WEB_MCP_TOKEN_FILE` | Read the native Chiron Horizon Web MCP token from a file; cannot be combined with `CHIRON_HORIZON_WEB_MCP_TOKEN` |
| `CHIRON_HORIZON_WEB_MCP_ALLOWED_HOSTS` | Required comma-separated public Host authorities for native Chiron Horizon Web MCP |
| `CHIRON_HORIZON_WEB_MCP_ALLOWED_ORIGINS` | Comma-separated browser Origins allowed for native Chiron Horizon Web MCP |
| `CHIRON_HORIZON_MCP_TRANSPORT` | `stdio` (default) or `streamable-http` for the native server |
| `CHIRON_HORIZON_MCP_HTTP_HOST` | Native HTTP bind address (default: `127.0.0.1`) |
| `CHIRON_HORIZON_MCP_HTTP_PORT` | Native HTTP bind port (default: `5225`) |
| `CHIRON_HORIZON_MCP_HTTP_PATH` | Native HTTP endpoint path (default: `/mcp`) |
| `CHIRON_HORIZON_MCP_HTTP_TOKEN` | Bearer token required by native Streamable HTTP |
| `CHIRON_HORIZON_MCP_HTTP_TOKEN_FILE` | Read the native HTTP bearer token from a file; cannot be combined with `CHIRON_HORIZON_MCP_HTTP_TOKEN` |
| `CHIRON_HORIZON_MCP_HTTP_ALLOW_REMOTE` | Set to `1` together with `--http-allow-remote` before a non-loopback bind is allowed |
| `CHIRON_HORIZON_MCP_HTTP_ALLOWED_HOSTS` | Required Host authority allowlist for a non-loopback native bind |
| `CHIRON_HORIZON_MCP_HTTP_ALLOWED_ORIGINS` | Required browser Origin allowlist for a non-loopback native bind |
| `CHIRON_HORIZON_MCP_ALLOW_WRITES` | Upgrade compatibility only: `0`/`false` keeps an unconfigured policy read-only |
| `CHIRON_HORIZON_MCP_SCOPE_CONNECTION_ID` | Compatibility scope for one connection ID |
| `CHIRON_HORIZON_MCP_SCOPE_CONNECTION_IDS` | Compatibility scope for multiple connection IDs |
| `CHIRON_HORIZON_MCP_SCOPE_CONNECTION_NAME` | Restrict tools to one connection name |
| `CHIRON_HORIZON_MCP_SCOPE_DATABASE` | Restrict tools to one database |
| `CHIRON_HORIZON_MCP_DEBUG_SQL` | Include SQL in temporary diagnostics |

## Troubleshooting

### MCP package availability

The npm package is deferred for 0.1.0. Use the desktop MCP endpoint shown in **Settings → MCP**, or build the stdio server from the checked-out `v0.1.0` source.

### Unsupported Linux distribution

The published Linux packages target glibc. Alpine Linux uses musl by default and is not currently supported.

### `chiron-horizon.db` cannot be found

Set `CHIRON_HORIZON_DATA_DIR` to the directory containing `chiron-horizon.db`, not to the database file itself.

### Desktop action says Chiron Horizon is not running

Database queries can run without the desktop application when the connection is supported locally. `chiron_horizon_open_table` and `chiron_horizon_execute_and_show` intentionally require Chiron Horizon desktop to be running.

### Agent/JDBC database cannot start

Open Chiron Horizon Driver Manager and install/update the matching database agent and JRE. The standalone MCP binary does not redistribute every proprietary JDBC driver.

### `better-sqlite3` or Node ABI error

The Rust MCP runtime does not depend on `better-sqlite3`. Rebuild the stdio server from the matching 0.1.0 source revision if a local development build is stale.

## Development

Run the Rust server from source:

```bash
cargo run -p chiron-horizon-mcp --no-default-features
```

Run tests:

```bash
cargo test -p chiron-horizon-mcp --no-default-features
pnpm --filter @chiron-horizon/mcp-server test
```

Build a release binary:

```bash
cargo build --release -p chiron-horizon-mcp --no-default-features
```

## Chiron Horizon CLI

The standalone npm CLI is deferred for 0.1.0. Build the Rust CLI from this source tree when it is needed during development.

See the [CLI README](../cli/README.md).

## License

Apache-2.0
