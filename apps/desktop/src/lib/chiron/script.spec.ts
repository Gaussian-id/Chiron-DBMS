import { describe, it, expect, vi } from "vitest";
import { ChironScriptRun, splitChironScript, type ChironScriptOptions } from "./script";
import type { ChironDbReply, ChironDbRequest } from "@/types/chirondb";
const ok = (body: ChironDbReply["body"]): ChironDbReply => ({ status: 200, body });
function harness(source: string, overrides: Partial<ChironScriptOptions> = {}) {
  const sent: ChironDbRequest[] = [];
  const options: ChironScriptOptions = {
    source,
    connectionId: "original",
    collection: "initial",
    trace: false,
    request: vi.fn(async (_id, request) => {
      sent.push(request);
      if (request.operation === "parse") {
        const q = request.query.trim();
        const statement = q.split(/\s/)[0];
        return ok({ ok: true, kind: ["DELETE", "UPSERT"].includes(statement) ? "write" : "read", statement, collection: statement === "USE" ? "new_target" : null });
      }
      return ok({ kind: "rows", rows: [], query_id: `q-${sent.length}` });
    }),
    approve: vi.fn(async () => true),
    changed: vi.fn(),
    ...overrides,
  };
  return { run: new ChironScriptRun(options), options, sent };
}
describe("ChironQL script execution", () => {
  it("splits only real delimiters, preserving strings, doubled quotes, Unicode and comments", () => {
    expect(splitChironScript("-- ; ignore\nUPSERT c {id: 'α;it''s',payload: {x: '--;'}};\nCOUNT c; -- tail;").map((s) => s.query)).toEqual(["-- ; ignore\nUPSERT c {id: 'α;it''s',payload: {x: '--;'}};", "\nCOUNT c;"]);
    expect(splitChironScript(";; -- only comments\n;")).toEqual([]);
    expect(splitChironScript("COUNT c")[0].query).toBe("COUNT c");
    expect(() => splitChironScript("COUNT c; UPSERT c 'unterminated")).toThrow("Unterminated");
  });
  it("runs sequentially with Run-local USE and explicit target precedence", async () => {
    const h = harness("USE new_target; COUNT; COUNT explicit;", {
      request: vi.fn(async (_id, r) => (r.operation === "parse" ? ok({ ok: true, kind: "read", statement: r.query.includes("USE") ? "USE" : "COUNT", collection: r.query.includes("USE") ? "new_target" : r.query.includes("explicit") ? "explicit" : null }) : ok({ rows: [], query_id: "query" }))),
    });
    const results = await h.run.execute();
    const calls = vi.mocked(h.options.request).mock.calls.filter((c) => c[1].operation === "execute");
    expect(calls.map((c) => (c[1] as any).collection)).toEqual(["new_target", "explicit"]);
    expect(results.map((r) => r.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
    expect(h.options.collection).toBe("initial");
  });
  it("approves every write separately and stops on rejected approval", async () => {
    const h = harness("UPSERT c; UPSERT c; COUNT c;", { approve: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false) });
    const results = await h.run.execute();
    expect(h.options.approve).toHaveBeenCalledTimes(2);
    expect(h.sent.filter((r) => r.operation === "execute")).toHaveLength(1);
    expect(results.map((r) => r.status)).toEqual(["succeeded", "cancelled", "not run"]);
  });
  it("keeps the exact query and context across destructive confirmation", async () => {
    let execution = 0;
    const request = vi.fn(async (_id: string, r: ChironDbRequest) => {
      if (r.operation === "parse") return ok({ ok: true, kind: "write", statement: "DELETE", collection: "explicit" });
      execution++;
      return execution === 1 ? { status: 409, body: { code: "chironql.confirmation_required", affected_estimate: 12 } } : ok({ stats: { affected: 12 }, query_id: "done" });
    });
    const h = harness("DELETE FROM explicit WHERE x = 'a';", { request });
    expect((await h.run.execute())[0].status).toBe("succeeded");
    expect(h.options.approve).toHaveBeenCalledTimes(2);
    const mutations = request.mock.calls.filter((c) => c[1].operation === "execute").map((c) => c[1]);
    expect(mutations).toEqual([
      { operation: "execute", query: h.options.source, collection: "explicit", trace: false, confirm: false, allow_destructive: true },
      { operation: "execute", query: h.options.source, collection: "explicit", trace: false, confirm: true, allow_destructive: true },
    ]);
  });
  it("fails closed on parser rejection or unknown classification", async () => {
    for (const parsed of [{ status: 400, body: { error: "Invalid query" } }, ok({ ok: true, kind: "empty", statement: "UPSERT" })]) {
      const h = harness("COUNT c; DELETE c;", { request: vi.fn(async () => parsed) });
      expect((await h.run.execute()).map((r) => r.status)).toEqual(["failed", "not run"]);
      expect(h.options.request).toHaveBeenCalledTimes(1);
    }
  });
  it("never retries a mutation after a transport error or sends the next statement", async () => {
    const request = vi.fn(async (_id: string, r: ChironDbRequest): Promise<ChironDbReply> => {
      if (r.operation === "parse") return ok({ ok: true, kind: "write", statement: "UPSERT" });
      throw new Error("timeout");
    });
    const h = harness("UPSERT c; COUNT c;", { request });
    const results = await h.run.execute();
    expect(results.map((r) => r.status)).toEqual(["uncertain", "not run"]);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("preserves completed results and stops on authorization rejection", async () => {
    let n = 0;
    const request = vi.fn(async (_id: string, r: ChironDbRequest): Promise<ChironDbReply> => {
      if (r.operation === "parse") return ok({ ok: true, kind: "read", statement: "COUNT" });
      return ++n === 1 ? ok({ query_id: "first", rows: [{ count: 2 }] }) : { status: 403, body: { error: "Forbidden" } };
    });
    const h = harness("COUNT c; COUNT other; COUNT c;", { request });
    const results = await h.run.execute();
    expect(results.map((r) => r.status)).toEqual(["succeeded", "failed", "not run"]);
    expect(results[0].reply?.body.query_id).toBe("first");
  });
  it("Stop during an in-flight request retains its outcome and sends nothing further", async () => {
    let finish!: (r: ChironDbReply) => void;
    const request = vi.fn(async (_id: string, r: ChironDbRequest) =>
      r.operation === "parse"
        ? ok({ ok: true, kind: "write", statement: "UPSERT" })
        : await new Promise<ChironDbReply>((resolve) => {
            finish = resolve;
          }),
    );
    const h = harness("UPSERT c; COUNT c;", { request });
    const running = h.run.execute();
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    h.run.stop();
    finish(ok({ query_id: "completed" }));
    expect((await running).map((r) => r.status)).toEqual(["succeeded", "not run"]);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
