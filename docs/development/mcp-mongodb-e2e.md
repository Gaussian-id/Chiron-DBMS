# MCP Gauss Horizon — MongoDB end-to-end verification

Date: 2026-09-14. Branch: `codex/gauss-horizon-0.1.0`. Requested by Kevin after clarifying that ChironDB's native MCP and Gauss Horizon's multi-database MCP are separate products/surfaces.

## Result and scope

**PASS: all 14 end-to-end acceptance groups** against real MongoDB 8.0.30 and the standalone Gauss Horizon MCP 0.1.0 binary. Both stdio and authenticated Streamable HTTP were exercised using a small JSON-RPC/MCP client, without mocking the database or MCP backend. This establishes the tested MongoDB operations and access controls in this local configuration; it does not establish universal production readiness or interaction through a particular AI model/client UI.

MongoDB ran in an isolated official `mongo:8.0` Docker container, published on loopback only with a generated root password. MCP used a new private temporary profile and persisted synthetic connection credentials. Test policy changes were made in that disposable profile while the MCP process was stopped. No existing connection/profile, production database, desktop installation or real secret was used. Test containers and MCP processes were closed and removed; evidence was retained privately.

## Observed checks

1. authenticated disposable MongoDB is ready.
2. real standalone stdio initialize and tools/list.
3. saved credentials survive MCP restart; cold database discovery without default database.
4. collection discovery and schema context; MongoDB does not expose inferred SQL columns.
5. find/filter/sort, findOne, count, aggregate, Unicode and 100-row response bound.
6. malformed/unsupported commands return tool errors; next request still succeeds.
7. permitted insert/update/filtered delete verified in MongoDB; dangerous operations blocked.
8. bad MongoDB credentials fail without affecting valid connection.
9. read-only, connection/database scope and cross-database aggregation restrictions; no side effects.
10. production connection rejects writes even with writable MCP policy.
11. tool allowlist controls discovery and direct invocation.
12. MongoDB interruption returns an error and recovers after restart (1 explicit read attempts; no write retries).
13. Streamable HTTP initialize/tools/query, bearer auth, Origin validation and read-only enforcement.
14. final direct database verification: original three records preserved.

The CRUD checks verified inserted/updated values via MCP and checked deletion directly in MongoDB. Denied writes were checked against the underlying database, including preservation of the initial three documents, the original amount value and absence of a cross-database output collection. MCP policy enforcement is independent of the MongoDB account's ability to write.

The stdio handshake reported server identity `gauss-horizon` and version `0.1.0`. HTTP tests included missing/wrong bearer tokens (401), untrusted Origin (403), successful initialize/tools/list/query and read-only rejection. Reconnect succeeded on the first explicit read attempt after the fixed-port MongoDB container restarted. There was no automatic write retry.

## Limits and accurate interpretation

- `describe_table` currently returns **No columns found** for MongoDB. It does not infer SQL-style columns from sample documents. Collection discovery and collection-level schema context work; document contents are available through Mongo shell queries.
- MongoDB MCP supports writes when permitted by configured policies. This does not promise a per-operation desktop approval dialog; manual ChironQL workspace approval is a separate implementation.
- The test used the native MongoDB driver, one MongoDB 8.0.30 server, and a macOS arm64 host. Replica sets, sharding, TLS, older MongoDB servers/legacy agents, Windows/Linux-hosted MCP and MongoDB role permutations were not certified.
- The client was a protocol test harness, not a Claude/Codex UI or live language model. AI tool selection and client installation/configuration remain separate acceptance work.
- Packages remain unpublished. No production runtime code change was needed for this test. A reusable acceptance script and evidence documentation were added.

## Regression tests and test-harness corrections

Existing Rust suites passed: `local` 6, `mongodb_databases` 4 and `protocol` 9, totaling **19 tests passed**. Seven opt-in live tests were ignored in that separate regression command; they are not counted as passes. The MongoDB live behavior above is independently covered by the new E2E script. A nested subprocess test prints an additional single-test result and is not double-counted.

Initial harness attempts stopped on an incorrect expectation that MongoDB exposes inferred SQL columns, a reconnect attempt with Docker's dynamic host-port assignment, and an empty SSE priming event. The final harness uses the actual schemaless metadata contract, a fixed loopback host port with mapping verification, and proper SSE event framing/empty-event handling. Those failed attempts are retained in the earlier logs and are not represented as successful runs. Final rerun after restricting the child-process environment again passed all 14 groups.

## Reproduce

Requires Rust, Docker, Python 3, and the official MongoDB image. From the repository root:

```sh
cargo build -p gauss-horizon-mcp --no-default-features --features sqlite-bundled
python3 scripts/mcp-mongodb-e2e.py --binary target/debug/gauss-horizon-mcp --image mongo:8.0
cargo test -p gauss-horizon-mcp --no-default-features --features sqlite-bundled --test protocol --test mongodb_databases --test local
```

Local execution used Rust 1.94.1, `CARGO_INCREMENTAL=0`, `CARGO_BUILD_JOBS=3`, `CARGO_PROFILE_DEV_DEBUG=0` and `CARGO_PROFILE_TEST_DEBUG=0`. The script creates its own database/container/profile and removes only its own container on exit. Evidence paths are printed at completion. It does not require a running Gauss Horizon desktop.

## Evidence

- Script: `/Users/kalbefarma/Documents/Projects/Gauss-DBM/scripts/mcp-mongodb-e2e.py`
- Final run log: `/tmp/gauss-horizon-mongo-mcp-acceptance.log`
- Summary and redacted-by-construction tool responses: `/var/folders/yh/8wsb5r6x1wzbzhtv2_dzl4y00000gn/T/gauss-horizon-mongo-mcp-oydhfljt/summary.json`, `/var/folders/yh/8wsb5r6x1wzbzhtv2_dzl4y00000gn/T/gauss-horizon-mongo-mcp-oydhfljt/transcript.json`
- Environment/version record: `/var/folders/yh/8wsb5r6x1wzbzhtv2_dzl4y00000gn/T/gauss-horizon-mongo-mcp-oydhfljt/environment.json`
- Build log: `/tmp/gauss-horizon-mongo-mcp-build.log`
- Regression log: `/tmp/gauss-horizon-mongo-mcp-regression.log`
- MCP executable SHA-256: `98ad6be186341756dcb1428d6bf8eb0b9e7663f29a966d5fa48aeb747548edde`
- MongoDB image ID: `sha256:4a0f30875898413139bec44c73c02a05fed172578de65b644dcdcee143ae7306`

No password/token is copied into this documentation. The private evidence directory contains synthetic test credentials and must not be published wholesale.
