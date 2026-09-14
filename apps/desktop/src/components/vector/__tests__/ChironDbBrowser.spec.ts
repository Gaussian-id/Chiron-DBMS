// @vitest-environment happy-dom
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const backend = vi.hoisted(() => ({ chirondbRequest: vi.fn(), vectorListCollections: vi.fn() }));
vi.mock("@/lib/backend/api", () => backend);
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../ChironQueryEditor.vue", () => ({ __esModule: true, default: defineComponent({ props: ["modelValue", "readOnly"], setup: (props) => () => h("textarea", { value: props.modelValue, readOnly: props.readOnly }) }) }));
vi.mock("@/components/grid/DataGrid.vue", () => ({ __esModule: true, default: defineComponent({ props: ["result"], setup: (props) => () => h("pre", { "data-testid": "result" }, JSON.stringify(props.result)) }) }));
vi.mock("@/components/ui/button", () => ({
  Button: defineComponent({
    setup:
      (_, { attrs, slots }) =>
      () =>
        h("button", attrs, slots.default?.()),
  }),
}));
vi.mock("@/components/ui/dialog", () => {
  const part = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h("div", slots.default?.()),
  });
  return {
    Dialog: defineComponent({
      props: ["open"],
      setup:
        (props, { slots }) =>
        () =>
          props.open ? h("div", slots.default?.()) : null,
    }),
    DialogContent: part,
    DialogHeader: part,
    DialogTitle: part,
    DialogDescription: part,
    DialogFooter: part,
  };
});
vi.mock("@/components/ui/ErrorBanner.vue", () => ({ default: defineComponent({ props: ["message"], setup: (props) => () => h("div", props.message) }) }));
import ChironDbBrowser from "../ChironDbBrowser.vue";

let app: App;
let root: HTMLElement;
async function flush() {
  await vi.dynamicImportSettled();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}
function button(text: string) {
  return [...root.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;
}
async function mount(query = "SHOW COLLECTIONS;", collection = "") {
  root = document.createElement("div");
  document.body.appendChild(root);
  app = createApp(ChironDbBrowser, { connectionId: "chiron", collection, initialQuery: query });
  app.mount(root);
  await flush();
}
beforeEach(() => {
  backend.chirondbRequest.mockReset();
  backend.vectorListCollections.mockReset();
  backend.vectorListCollections.mockResolvedValue([{ name: "demo" }]);
});
afterEach(() => {
  app?.unmount();
  root?.remove();
});

describe("ChironDB workspace", () => {
  it("executes one unchanged statement and shows native diagnostics", async () => {
    backend.chirondbRequest.mockResolvedValue({ status: 200, body: { kind: "rows", columns: ["id", "payload"], rows: [{ id: "α", payload: { tags: [1, true] } }], stats: { took_ms: 1.25 }, query_id: "q-test" } });
    await mount("SEARCH demo NEAR [1,0,0] LIMIT 5;");
    button("chiron.run").click();
    await flush();
    expect(backend.chirondbRequest).toHaveBeenCalledWith("chiron", { operation: "execute", query: "SEARCH demo NEAR [1,0,0] LIMIT 5;", collection: null, trace: false, confirm: false, allow_destructive: false });
    expect(root.textContent).toContain("q-test");
    expect(root.querySelector('[data-testid="result"]')?.textContent).toContain('"tags":[1,true]');
  });

  it("does not send a confirmation after cancellation", async () => {
    backend.chirondbRequest.mockResolvedValue({ status: 400, body: { code: "dbm.confirmation_required", error: "Confirm delete" } });
    await mount("DELETE FROM demo WHERE category = 'old';");
    button("chiron.run").click();
    await flush();
    expect(root.querySelector("textarea")!.readOnly).toBe(true);
    button("chiron.cancel").click();
    await flush();
    expect(backend.chirondbRequest).toHaveBeenCalledTimes(1);
    expect(root.querySelector("textarea")!.readOnly).toBe(false);
  });

  it("confirms the exact snapshot and retains the server's affected-count gate", async () => {
    backend.chirondbRequest
      .mockResolvedValueOnce({ status: 400, body: { code: "dbm.confirmation_required", error: "Confirm delete" } })
      .mockResolvedValueOnce({ status: 409, body: { code: "chironql.confirmation_required", error: "Delete 12 points?", affected_estimate: 12 } })
      .mockResolvedValueOnce({ status: 200, body: { kind: "affected", stats: { affected: 12 }, query_id: "q-delete" } });
    await mount("DELETE FROM demo WHERE category = 'old';");
    button("chiron.run").click();
    await flush();
    button("chiron.confirm").click();
    await flush();
    expect(backend.chirondbRequest.mock.calls[1][1]).toMatchObject({ confirm: false, allow_destructive: true });
    expect(root.textContent).toContain("12");
    button("chiron.confirm").click();
    await flush();
    expect(backend.chirondbRequest.mock.calls[2][1]).toMatchObject({ query: "DELETE FROM demo WHERE category = 'old';", confirm: true, allow_destructive: true });
  });

  it("passes opaque cursors without transforming them", async () => {
    backend.chirondbRequest.mockResolvedValueOnce({ status: 200, body: { points: [{ id: "1" }], next_offset: "opaque/+α" } }).mockResolvedValueOnce({ status: 200, body: { points: [], next_offset: null } });
    await mount("SHOW COLLECTIONS;", "demo");
    button("chiron.nextPage").click();
    await flush();
    expect(backend.chirondbRequest.mock.calls[1][1]).toEqual({ operation: "browse", collection: "demo", offset: "opaque/+α", limit: 100 });
  });

  it("never retries an uncertain write", async () => {
    backend.chirondbRequest.mockRejectedValue(new Error("Outcome unknown"));
    await mount("UPSERT demo;");
    button("chiron.run").click();
    await flush();
    expect(backend.chirondbRequest).toHaveBeenCalledTimes(1);
    expect(root.textContent).toContain("Outcome unknown");
  });
});
