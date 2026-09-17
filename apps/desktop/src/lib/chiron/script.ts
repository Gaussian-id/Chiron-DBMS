import type { ChironDbReply, ChironDbRequest } from "@/types/chirondb";

export interface ChironStatement {
  query: string;
  offset: number;
}
/** ChironQL uses single-quoted strings with doubled quotes and -- line comments.
 * Preserve original statement text; the server remains the grammar authority.
 */
export function splitChironScript(source: string): ChironStatement[] {
  const statements: ChironStatement[] = [];
  let start = 0,
    quoted = false,
    comment = false,
    hasToken = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (comment) {
      if (c === "\n") comment = false;
      continue;
    }
    if (quoted) {
      if (c === "'") {
        if (source[i + 1] === "'") i++;
        else quoted = false;
      }
      continue;
    }
    if (c === "-" && source[i + 1] === "-") {
      comment = true;
      i++;
      continue;
    }
    if (c === "'") {
      quoted = true;
      hasToken = true;
      continue;
    }
    if (c === ";") {
      if (hasToken) statements.push({ query: source.slice(start, i + 1), offset: start });
      start = i + 1;
      hasToken = false;
    } else if (!/\s/.test(c)) hasToken = true;
  }
  if (quoted) throw new Error("Unterminated ChironQL string; no statements were sent.");
  if (hasToken) statements.push({ query: source.slice(start), offset: start });
  return statements;
}

export interface ChironScriptResult extends ChironStatement {
  collection: string | null;
  status: "queued" | "validating" | "awaiting approval" | "running" | "succeeded" | "failed" | "cancelled" | "not run" | "uncertain";
  reply?: ChironDbReply;
  message?: string;
}
type ExecuteRequest = Extract<ChironDbRequest, { operation: "execute" }>;
export interface ChironScriptOptions {
  source: string;
  connectionId: string;
  collection: string | null;
  trace: boolean;
  request: (connection: string, request: ChironDbRequest) => Promise<ChironDbReply>;
  approve: (request: Readonly<ExecuteRequest>, message: string) => Promise<boolean>;
  changed: (results: ChironScriptResult[]) => void;
}
export function chironReplyError(reply: ChironDbReply): string {
  const b = reply.body;
  return [b.error || `HTTP ${reply.status}`, b.hint, b.code, b.position != null ? `Byte position: ${b.position}` : "", b.query_id].filter(Boolean).join("\n");
}
const successful = (r: ChironDbReply) => r.status >= 200 && r.status < 300;

export class ChironScriptRun {
  private stopped = false;
  constructor(private readonly options: ChironScriptOptions) {}
  stop() {
    this.stopped = true;
  }
  async execute(): Promise<ChironScriptResult[]> {
    const o = this.options;
    const results: ChironScriptResult[] = splitChironScript(o.source).map((s) => ({ ...s, collection: o.collection, status: "queued" }));
    let context = o.collection;
    const update = () => o.changed(results.map((r) => ({ ...r })));
    update();
    for (const item of results) {
      if (this.stopped) {
        item.status = "not run";
        continue;
      }
      let mutationSent = false;
      try {
        item.status = "validating";
        update();
        const parsed = await o.request(o.connectionId, { operation: "parse", query: item.query });
        if (this.stopped) {
          item.status = "cancelled";
          continue;
        }
        if (!successful(parsed)) {
          item.reply = parsed;
          throw new Error(chironReplyError(parsed));
        }
        const { kind, statement } = parsed.body;
        if (parsed.body.ok !== true || !["read", "write", "admin"].includes(kind ?? "") || typeof statement !== "string" || !statement) {
          throw new Error("Unknown ChironDB statement classification; execution blocked.");
        }
        item.collection = parsed.body.collection || context;
        if (statement === "USE") {
          if (!parsed.body.collection) throw new Error("ChironDB omitted the USE collection.");
          context = parsed.body.collection;
          item.status = "succeeded";
          item.message = "Collection context set for this Run only.";
          update();
          continue;
        }
        let request: ExecuteRequest = { operation: "execute", query: item.query, collection: item.collection, trace: o.trace, confirm: false, allow_destructive: false };
        if (kind !== "read") {
          item.status = "awaiting approval";
          update();
          if (!(await o.approve(Object.freeze({ ...request }), `Approve this write to ${item.collection ?? "the explicit query target"}.`))) {
            item.status = "cancelled";
            this.stop();
            continue;
          }
          request = { ...request, allow_destructive: true };
        }
        const seen = new Set<string>();
        while (!this.stopped) {
          item.status = "running";
          update();
          mutationSent = kind !== "read";
          const reply = await o.request(o.connectionId, request);
          item.reply = reply;
          if (successful(reply)) {
            mutationSent = false;
            item.status = "succeeded";
            break;
          }
          const code = reply.body.code;
          if (code === "dbm.confirmation_required" || code === "chironql.confirmation_required") {
            mutationSent = false;
            if (this.stopped) {
              item.status = "cancelled";
              break;
            }
            if (seen.has(code)) throw new Error("Repeated confirmation response; Run stopped without retry.");
            seen.add(code);
            request = { ...request, allow_destructive: true, confirm: code === "chironql.confirmation_required" };
            item.status = "awaiting approval";
            update();
            const message = chironReplyError(reply) + (reply.body.affected_estimate != null ? `\nAffected estimate: ${reply.body.affected_estimate}` : "");
            if (!(await o.approve(Object.freeze({ ...request }), message))) {
              item.status = "cancelled";
              this.stop();
            }
          } else {
            // Server/proxy timeouts and 5xx responses can conceal a committed mutation.
            mutationSent = kind !== "read" && (reply.status >= 500 || reply.status === 408 || reply.status === 504);
            throw new Error(chironReplyError(reply));
          }
        }
        if (this.stopped && !["succeeded", "cancelled"].includes(item.status)) item.status = "cancelled";
      } catch (e) {
        item.status = mutationSent ? "uncertain" : "failed";
        item.message = String(e) + (mutationSent ? "\nMutation outcome may be unknown. Inspect state before any manual retry." : "");
        this.stop();
      } finally {
        update();
      }
    }
    update();
    return results;
  }
}
