// Live, disposable-data verification. Never accepts a remote server URL.
// Build dbx-web, then run with CHIRONDB_TEST_BINARY=/absolute/path/to/chirondb.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, open, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

assert(process.env.CHIRONDB_TEST_BINARY, "Set CHIRONDB_TEST_BINARY to a local ChironDB binary");
const directory = await mkdtemp(join(tmpdir(), "chirondbm-smoke-"));
const children = [];
const files = [];
const key = randomUUID();
const readerKey = randomUUID();
const restrictedKey = randomUUID();
const password = randomUUID();
let cookie = "";
const providerRequests = [];
let proposedQuery = "COUNT dbm_smoke;";
let interactive = false;
const mockProvider = createHttpServer(async (request, response) => {
  let bytes = "";
  for await (const chunk of request) bytes += chunk;
  const body = JSON.parse(bytes);
  providerRequests.push(body);
  let query = proposedQuery;
  if (interactive) {
    await delay(8000);
    const prompt = String(body.messages.at(-1).content).split("Current user request:\n").at(-1).toLowerCase();
    if (prompt.includes("simulate provider failure")) {
      response.writeHead(429, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Synthetic rate limit; try another prompt" } }));
      return;
    }
    query = prompt.includes("create") ? "CREATE COLLECTION ui_created DIM 3 METRIC cosine;" : prompt.includes("list") || prompt.includes("show collections") ? "SHOW COLLECTIONS;" : prompt.includes("count") ? "COUNT dbm_smoke;" : "SCROLL dbm_smoke LIMIT 20;";
  }
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: `\u0060\u0060\u0060chironql\n${query}\n\u0060\u0060\u0060` }, finish_reason: "stop" }] }));
});
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
const config = { id: "disposable-chiron", name: "Disposable ChironDB", db_type: "chirondb", host: "127.0.0.1", port: httpPort, username: "", password: key, save_password: false, read_only: false };
const execute = async (query, extras = {}, id = config.id) =>
  (
    await post("chirondb/request", {
      connectionId: id,
      request: { operation: "execute", query, collection: "dbm_smoke", trace: true, confirm: false, allow_destructive: false, ...extras },
    })
  ).value;
const browse = async (offset = null) =>
  (
    await post("chirondb/request", {
      connectionId: config.id,
      request: { operation: "browse", collection: "dbm_smoke", offset, limit: 1 },
    })
  ).value;

try {
  const rbacPath = join(directory, "rbac.json");
  await writeFile(
    rbacPath,
    JSON.stringify({
      keys: [
        { id: "dbm-admin", key, role: "admin" },
        { id: "dbm-reader", key: readerKey, role: "read_only", allowed_collections: ["dbm_smoke"] },
        { id: "dbm-restricted", key: restrictedKey, role: "read_only", allowed_collections: ["unavailable"] },
      ],
    }),
    { mode: 0o600 },
  );
  const chiron = await start(
    resolve(process.env.CHIRONDB_TEST_BINARY),
    ["--listen-http", `127.0.0.1:${httpPort}`, "--listen-grpc", `127.0.0.1:${grpcPort}`, "--listen-wire", `127.0.0.1:${wirePort}`, "--data-dir", join(directory, "chiron"), "--api-key", [key, readerKey, restrictedKey].join(","), "--rbac-config-file", rbacPath],
    {},
    "chiron",
  );
  await ready(`http://127.0.0.1:${httpPort}/health`, chiron);
  const web = await start(resolve(process.env.DBM_TEST_BINARY || "target/debug/dbx-web"), [], { DBX_DATA_DIR: join(directory, "dbm"), DBX_PORT: String(webPort), DBX_PASSWORD: password }, "dbm");
  await ready(`${base}/api/auth/check`, web);
  const login = await post("auth/login", { password });
  cookie = login.response.headers.get("set-cookie").split(";")[0];
  const bad = await post("connection/test", { config: { ...config, password: "wrong-key" } }, false);
  assert(!bad.response.ok, "Invalid key must not connect");
  await post("connection/test", { config });
  await post("connection/connect", { config });
  assert.deepEqual((await post("document-store/list-collections", { connectionId: config.id, database: "default" })).value, []);
  console.log("PASS: authenticated connection, rejected bad key, empty collection list");

  const created = await execute("CREATE COLLECTION dbm_smoke DIM 3 METRIC cosine;", { allow_destructive: true });
  assert.equal(created.status, 200, JSON.stringify(created));
  for (const id of ["first", "second"]) {
    const written = await execute(`UPSERT INTO dbm_smoke {id: '${id}', vector: [1,0,0], payload: {category: 'test', nested: {tags: ['a', 'b']}}};`);
    assert.equal(written.status, 200, JSON.stringify(written));
  }
  const list = (await post("document-store/list-collections", { connectionId: config.id, database: "default" })).value;
  assert.equal(list[0].name, "dbm_smoke");
  assert.equal(list[0].dimension, 3);
  const first = await browse();
  assert.equal(first.status, 200, JSON.stringify(first));
  assert.deepEqual(first.body.points[0].payload.nested.tags, ["a", "b"]);
  assert.equal(typeof first.body.next_offset, "string");
  const second = await browse(first.body.next_offset);
  assert.notEqual(second.body.points[0].id, first.body.points[0].id);
  const read = await execute("SEARCH dbm_smoke NEAR [1,0,0] LIMIT 5 WITH PAYLOAD;");
  assert.equal(read.status, 200, JSON.stringify(read));
  assert.equal(read.body.rows.length, 2);
  assert(read.body.query_id);
  const malformed = await execute("NOT A QUERY;");
  assert(malformed.status >= 400);
  assert(malformed.body.code);
  const multiple = await execute("COUNT dbm_smoke; COUNT dbm_smoke;");
  assert(multiple.status >= 400, "Only one statement is accepted");
  console.log("PASS: create, upsert, metadata, nested results, cursor pagination, retrieve, structured parse errors, single-statement guard");

  // Same shared assistant endpoint used by the chat UI, against the real parser
  // and disposable database. The provider is synthetic; no external AI call.
  await new Promise((done) => mockProvider.listen(0, "127.0.0.1", done));
  const aiConfig = { id: "mock-provider", name: "Synthetic ChironQL provider", provider: "openai-compatible", endpoint: `http://127.0.0.1:${mockProvider.address().port}/v1`, model: "synthetic-model", apiKey: "synthetic-provider-key", apiStyle: "completions", maxRetries: 0 };
  await post("ai/config-item", { config: aiConfig });
  const saved = await (await fetch(`${base}/api/ai/configs`, { headers: { Cookie: cookie } })).json();
  assert(!JSON.stringify(saved).includes(aiConfig.apiKey));
  assert(saved[0].apiKey.startsWith("dbx-ai-secret:v1:"));
  const assistant = async (request, expected = true, connectionId = config.id) => (await post("chirondb/request", { connectionId, request: { operation: "assistant", request } }, expected)).value;
  const generate = (prompt, generate_only = false) => assistant({ action: "generate", config_id: aiConfig.id, model: aiConfig.model, prompt, collection: "dbm_smoke", generate_only });
  const approve = (body) => assistant({ action: "approve", run_id: body.run_id, approval_token: body.approval_token });
  proposedQuery = "GET dbm_smoke POINTS 'first';";
  const aiRead = await generate("Retrieve the point named first");
  assert.equal(aiRead.body.result.status, 200, JSON.stringify(aiRead));
  assert(aiRead.body.result.body.query_id);
  assert(!JSON.stringify(providerRequests).includes("tags"));
  const beforeSharing = providerRequests.length;
  await assistant({ action: "explain", run_id: aiRead.body.run_id, approved_preview: "[]" }, false);
  assert.equal(providerRequests.length, beforeSharing);
  await assistant({ action: "explain", run_id: aiRead.body.run_id, approved_preview: aiRead.body.sharing_preview });
  assert(JSON.stringify(providerRequests.at(-1)).includes("tags"));
  assert(!JSON.stringify(providerRequests.at(-1)).includes('\\"vector\\"'));
  proposedQuery = "UPSERT INTO dbm_smoke {id: 'assistant', vector: [1,0,0], payload: {category: 'assistant'}};";
  const aiWrite = await generate("Create point assistant using vector [1,0,0] and category assistant");
  assert(aiWrite.body.approval_token);
  assert.equal(aiWrite.body.result, null);
  const aiWritten = await approve(aiWrite.body);
  assert.equal(aiWritten.body.result.status, 200, JSON.stringify(aiWritten));
  const replay = await post("chirondb/request", { connectionId: config.id, request: { operation: "assistant", request: { action: "approve", run_id: aiWrite.body.run_id, approval_token: aiWrite.body.approval_token } } }, false);
  assert(!replay.response.ok, "Replayed grant must fail");
  proposedQuery = "DELETE FROM dbm_smoke WHERE category = 'assistant';";
  const aiCancelled = await generate("Delete category assistant");
  await assistant({ action: "cancel", run_id: aiCancelled.body.run_id });
  assert.equal((await execute("GET dbm_smoke POINTS 'assistant';")).body.rows.length, 1);
  const aiDelete = await generate("Delete category assistant");
  const aiCounted = await approve(aiDelete.body);
  assert.equal(aiCounted.body.result.body.affected_estimate, 1);
  const aiDeleted = await approve(aiCounted.body);
  assert.equal(aiDeleted.body.result.body.stats.affected, 1);
  proposedQuery = "COUNT dbm_smoke; COUNT dbm_smoke;";
  const rejected = await generate("Generate only two statements", true);
  assert.equal(rejected.body.result.status, 400);
  console.log("PASS: native assistant real-parser reads, exact write approval, replay rejection, cancellation, affected-count confirmation, metadata-only provider payloads and consent-scoped sharing");
  proposedQuery = "SHOW COLLECTIONS;";
  for (let round = 1; round <= 5; round++) {
    const response = await assistant({ action: "generate", config_id: aiConfig.id, model: aiConfig.model, prompt: "Show collections", collection: "", generate_only: false, request_id: `list-${round}` });
    assert.equal(response.body.result.status, 200, JSON.stringify(response));
    const status = await assistant({ action: "status", request_id: `list-${round}` });
    assert.equal(status.body.phase, "Finished");
  }
  proposedQuery = "CREATE COLLECTION ai_created DIM 3 METRIC cosine;";
  const createProposal = await generate("Create collection ai_created with dimension 3 and cosine distance");
  assert.equal(createProposal.body.collection, "ai_created");
  assert(createProposal.body.approval_token);
  const createResult = await approve(createProposal.body);
  assert.equal(createResult.body.result.status, 200, JSON.stringify(createResult));
  assert((await post("document-store/list-collections", { connectionId: config.id, database: "default" })).value.some((c) => c.name === "ai_created"));
  const removed = await execute("DROP COLLECTION ai_created;", { collection: "ai_created", allow_destructive: true, confirm: true });
  assert.equal(removed.status, 200, JSON.stringify(removed));
  console.log("PASS: five consecutive global collection-list prompts, progress lookup, and native AI collection creation with exact-target approval");
  for (const [query, prompt] of [
    ["DESCRIBE dbm_smoke;", "Describe this collection"],
    ["COUNT dbm_smoke;", "Count the points"],
    ["SCROLL dbm_smoke LIMIT 2;", "List two points"],
    ["GET dbm_smoke POINTS 'first';", "Retrieve point first"],
    ["SEARCH dbm_smoke NEAR [1,0,0] LIMIT 2 WITH PAYLOAD;", "Find two nearest points using [1,0,0]"],
    ["RECOMMEND dbm_smoke LIKE 'first' LIMIT 2;", "Recommend two points like point first"],
    ["MULTI dbm_smoke NEAR [1,0,0], NEAR [0,1,0] FUSION rrf LIMIT 2;", "Search using vectors [1,0,0] and [0,1,0], fuse with rrf"],
  ]) {
    proposedQuery = query;
    const result = await generate(prompt);
    assert.equal(result.body.result.status, 200, `${query}: ${JSON.stringify(result)}`);
    assert(result.body.result.body.query_id);
  }
  proposedQuery = "UPDATE dbm_smoke POINT 'first' SET PAYLOAD {reviewed: true};";
  const updateProposal = await generate("Set payload reviewed to true on point first");
  assert(updateProposal.body.approval_token);
  assert.equal((await approve(updateProposal.body)).body.result.status, 200);
  console.log("PASS: native prompt matrix for describe/count/scroll/get/search/recommend/multi-vector reads and approved payload update");

  const reader = { ...config, id: "server-reader", password: readerKey };
  await post("connection/connect", { config: reader });
  assert.equal((await execute("COUNT dbm_smoke;", {}, reader.id)).status, 200);
  const forbiddenWrite = await execute("UPSERT INTO dbm_smoke {id: 'forbidden', vector: [1,0,0]};", {}, reader.id);
  assert.equal(forbiddenWrite.status, 403, JSON.stringify(forbiddenWrite));
  const restricted = { ...config, id: "server-restricted", password: restrictedKey };
  await post("connection/connect", { config: restricted });
  assert.deepEqual((await post("document-store/list-collections", { connectionId: restricted.id, database: "default" })).value, []);
  // The server may hide a restricted collection as not found.
  assert([403, 404].includes((await execute("COUNT dbm_smoke;", {}, restricted.id)).status));
  console.log("PASS: server read-only role and restricted collection scope remain enforced");

  const readonly = { ...config, id: "readonly-chiron", read_only: true };
  await post("connection/connect", { config: readonly });
  assert.equal((await execute("COUNT dbm_smoke;", {}, readonly.id)).status, 200);
  assert.equal((await execute("UPSERT INTO dbm_smoke {id: 'blocked', vector: [1,0,0]};", {}, readonly.id)).body.code, "dbm.read_only");
  const bypass = await post("query/execute", { connectionId: config.id, database: "default", sql: "DELETE FROM dbm_smoke WHERE category = 'test';" }, false);
  assert(!bypass.response.ok, "Generic SQL must reject ChironQL");
  const deletion = "DELETE FROM dbm_smoke WHERE category = 'test';";
  assert.equal((await execute(deletion)).body.code, "dbm.confirmation_required");
  // Cancelling here means sending nothing; verify data still exists.
  assert.equal((await execute("SEARCH dbm_smoke NEAR [1,0,0] LIMIT 5;")).body.rows.length, 2);
  const counted = await execute(deletion, { allow_destructive: true });
  assert.equal(counted.body.code, "chironql.confirmation_required");
  assert.equal(counted.body.affected_estimate, 2);
  const deleted = await execute(deletion, { allow_destructive: true, confirm: true });
  assert.equal(deleted.status, 200, JSON.stringify(deleted));
  assert.equal(deleted.body.stats.affected, 2);
  console.log("PASS: DBM read-only enforcement, generic execution rejection, confirmation cancellation and exact approved deletion");
  await post("connection/disconnect", { connectionId: config.id });
  await post("connection/connect", { config });
  assert.equal((await browse()).body.points.length, 0);
  console.log("PASS: reconnect with session-only API key and empty result after deletion");
  console.log(`Evidence/logs: ${directory}`);
  if (process.env.DBM_SMOKE_UI === "1") {
    interactive = true;
    await post("connection/save", { configs: [{ ...config, save_password: true }] });
    proposedQuery = "SCROLL dbm_smoke LIMIT 20;";
    await execute("UPSERT INTO dbm_smoke {id: 'visual-only', vector: [1,0,0], payload: {category: 'synthetic-ui'}};");
    await writeFile(join(directory, "ui-handoff.json"), JSON.stringify({ base, password }), { mode: 0o600 });
    console.log(`Temporary UI test ready: ${directory}/ui-handoff.json (20-minute maximum)`);
    await delay(1200000);
  }
} finally {
  if (mockProvider.listening) await new Promise((done) => mockProvider.close(done));
  for (const child of children.reverse()) {
    if (child.exitCode == null) {
      child.kill("SIGTERM");
      await Promise.race([new Promise((done) => child.once("exit", done)), delay(3000)]);
      if (child.exitCode == null) child.kill("SIGKILL");
    }
  }
  for (const file of files) await file.close();
}
