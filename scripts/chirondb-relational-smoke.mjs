// Disposable local ChironDB Relational verification through Horizon's PostgreSQL driver.
// Set CHIRONDB_TEST_BINARY and DBM_TEST_BINARY to locally built binaries.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, open } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

assert(process.env.CHIRONDB_TEST_BINARY, "Set CHIRONDB_TEST_BINARY to a local ChironDB binary");
assert(process.env.DBM_TEST_BINARY, "Set DBM_TEST_BINARY to a local Horizon web binary");
const directory = await mkdtemp(join(tmpdir(), "chiron-horizon-relational-smoke-"));
const children = [];
const files = [];
const key = randomUUID();
const password = randomUUID();
let cookie = "";
async function port() {
  const server = createServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const value = server.address().port;
  await new Promise((done) => server.close(done));
  return value;
}
async function start(binary, args, env, name) {
  const log = await open(join(directory, `${name}.log`), "a");
  files.push(log);
  const child = spawn(binary, args, { env: { ...process.env, ...env }, stdio: ["ignore", log.fd, log.fd] });
  child.on("error", (error) => {
    child.startError = error;
  });
  children.push(child);
  return child;
}
async function ready(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.startError) throw child.startError;
    assert(child.exitCode == null, `Server exited with ${child.exitCode}; see ${directory}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Server not ready: ${url}; see ${directory}`);
}
const httpPort = await port();
const grpcPort = await port();
const wirePort = await port();
const webPort = await port();
const base = `http://127.0.0.1:${webPort}`;
async function post(path, body, expectSuccess = true) {
  const response = await fetch(`${base}/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  if (expectSuccess) assert(response.ok, JSON.stringify(value));
  return { response, value };
}
const config = { id: "relational-smoke", name: "Disposable ChironDB Relational", db_type: "postgres", driver_profile: "chirondb-relational", host: "127.0.0.1", port: wirePort, username: "chiron", password: key, database: "chiron", save_password: false, ssl: false };
const query = async sql => (await post("query/execute", { connectionId: config.id, database: "chiron", schema: "public", sql })).value;
try {
  const chiron = await start(resolve(process.env.CHIRONDB_TEST_BINARY), ["--listen-http", `127.0.0.1:${httpPort}`, "--listen-grpc", `127.0.0.1:${grpcPort}`, "--listen-wire", `127.0.0.1:${wirePort}`, "--data-dir", join(directory, "chiron"), "--api-key", key], {}, "chiron");
  await ready(`http://127.0.0.1:${httpPort}/health`, chiron);
  const web = await start(resolve(process.env.DBM_TEST_BINARY), [], { CHIRON_HORIZON_DATA_DIR: join(directory, "dbm"), CHIRON_HORIZON_PORT: String(webPort), CHIRON_HORIZON_PASSWORD: password }, "dbm");
  await ready(`${base}/api/auth/check`, web);
  cookie = (await post("auth/login", { password })).response.headers.get("set-cookie").split(";")[0];
  await post("connection/test", { config });
  await post("connection/connect", { config });
  console.log("PASS: ChironDB Relational profile test and connection");
  await query("CREATE TABLE horizon_people (id INT PRIMARY KEY, name TEXT)");
  await query("CREATE TABLE horizon_orders (id INT PRIMARY KEY, person_id INT, amount INT)");
  await query("INSERT INTO horizon_people VALUES (1, 'Synthetic Person')");
  await query("INSERT INTO horizon_orders VALUES (10, 1, 42)");
  const result = await query("SELECT p.name, o.amount FROM horizon_people p JOIN horizon_orders o ON p.id = o.person_id");
  // The native PostgreSQL-wire preview returns scalar cells as text.
  assert.deepEqual(result.rows, [["Synthetic Person", "42"]]);
  console.log("PASS: relational DDL, DML and join through the current PostgreSQL driver");
  for (const [endpoint, expected] of [["tables", "horizon_people"], ["columns", "name"]]) {
    const params = new URLSearchParams({connection_id: config.id, database: "chiron", schema: "public", table: "horizon_people"});
    const response = await fetch(`${base}/api/schema/${endpoint}?${params}`, {headers:{cookie}});
    const data = await response.json();
    assert(response.ok, JSON.stringify(data));
    assert(JSON.stringify(data).includes(expected), JSON.stringify(data));
  }
  console.log("PASS: relational table and column discovery");
  const descriptor = (await post("schema/viewer/describe", {connectionId: config.id})).value;
  assert.equal(descriptor.kind, "relational");
  const view = (await post("schema/viewer/view", {connectionId: config.id, scope: {database: "chiron", schema: "public"}})).value;
  assert(JSON.stringify(view).includes("horizon_people"), JSON.stringify(view));
  assert(view.facets.some(facet => ["partial", "notExposed"].includes(facet.availability)), "Unsupported relational catalogs must remain visibly incomplete");
  console.log("PASS: Schema Viewer retains relational tables and incomplete-catalog diagnostics");
} finally {
  for (const child of children.reverse()) {
    if (child.exitCode == null) {
      child.kill("SIGTERM");
      await Promise.race([new Promise(done => child.once("exit", done)), delay(3000)]);
      if (child.exitCode == null) child.kill("SIGKILL");
    }
  }
  for (const file of files) await file.close();
  console.log(`Disposable evidence: ${directory}`);
}
