# Chiron Horizon CLI Command Reference

Use `chiron-horizon --help` as the authoritative reference for the installed CLI version.

## Environment and Connections

```bash
chiron-horizon doctor --json
chiron-horizon capabilities --json
chiron-horizon connections list --json
```

`doctor` reports connection storage and Desktop bridge health. `capabilities` identifies direct-query and bridge-required database types. Connection listings omit secrets.

## Schema Inspection

```bash
chiron-horizon schema list <connection> --json
chiron-horizon schema list <connection> --schema <schema> --database <database> --json
chiron-horizon schema describe <connection> <table> --json
chiron-horizon schema describe <connection> <table> --schema <schema> --database <database> --json
```

## Queries

```bash
chiron-horizon query <connection> "SELECT ..." --limit 50 --timeout 10s --json
chiron-horizon query <connection> --file ./query.sql --limit 50 --timeout 10s --json
```

Set `CHIRON_HORIZON_CONNECTION` to omit the connection argument from `query` and `context` commands. If SQL begins with a dash, place `--` before the SQL argument.

Writes require `--allow-writes`. Dangerous SQL such as `DROP`, `TRUNCATE`, and `ALTER` requires both `--allow-writes` and `--allow-dangerous-sql`.

## Prompt Context

```bash
chiron-horizon context <connection>
chiron-horizon context <connection> --tables users,orders --max-tables 20
```

Prefer a table filter when the task concerns a known subset of the schema.

## DBML and Documentation

```bash
chiron-horizon dbml <connection> --out schema.dbml
chiron-horizon dbml <connection> --out schema.dbml --notes chiron-horizon-docs.json --tables users,orders
chiron-horizon docs <connection> --out schema.html --lang en
chiron-horizon docs <connection> --out schema.html --notes chiron-horizon-docs.json --lang zh-CN
```

Both commands accept `--schema`, `--database`, and `--tables`. An explicitly supplied `--notes` file must exist.

## Desktop Navigation

```bash
chiron-horizon open <connection> <table>
chiron-horizon open <connection> <table> --schema <schema> --database <database> --json
```

This command requires a running Chiron Horizon Desktop instance.

## Agent Skill Management

```bash
chiron-horizon agent setup
chiron-horizon agent status
chiron-horizon agent setup --force
chiron-horizon agent setup --skills-dir /custom/skills/root
```

The CLI contains the official Chiron Horizon Skill. `setup` installs or updates its Chiron Horizon-managed files under `~/.agents/skills/chiron-horizon` by default. It refuses to replace unmanaged or locally modified files unless `--force` is supplied. `status` does not modify files.
