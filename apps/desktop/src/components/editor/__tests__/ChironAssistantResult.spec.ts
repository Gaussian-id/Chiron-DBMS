// @vitest-environment happy-dom
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/components/vector/ChironQueryEditor.vue", () => ({ default: defineComponent({ props: ["modelValue", "readOnly"], setup: (p) => () => h("textarea", { value: p.modelValue, readOnly: p.readOnly }) }) }));
vi.mock("@/components/grid/DataGrid.vue", () => ({ default: defineComponent({ props: ["result"], setup: (p) => () => h("pre", JSON.stringify(p.result)) }) }));
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
        (p, { slots }) =>
        () =>
          p.open ? h("div", slots.default?.()) : null,
    }),
    DialogContent: part,
    DialogHeader: part,
    DialogTitle: part,
    DialogDescription: part,
    DialogFooter: part,
  };
});
import ChironAssistantResult from "../ChironAssistantResult.vue";
import type { ChironAssistantReply } from "@/types/chirondb";
let app: App;
let root: HTMLElement;
const action = vi.fn();
async function mount(value: ChironAssistantReply, stale = false) {
  action.mockClear();
  root = document.createElement("div");
  document.body.append(root);
  app = createApp(ChironAssistantResult, { value, busy: false, stale, connectionName: "Synthetic connection", model: "manual-model", onAction: action });
  app.mount(root);
  await nextTick();
}
function button(label: string) {
  return [...root.querySelectorAll("button")].find((b) => b.textContent === label)!;
}
afterEach(() => {
  app?.unmount();
  root?.remove();
});
it("renders narrative as safe plain text with line breaks and leaves the query untouched", async () => {
  const query = "SCROLL gaussdb_paper WHERE score < 10;";
  await mount({ query, message: "## Ready\n\nChoose **one** collection.", explanation: "First line\n\nSecond line\n<script>window.bad = true</script>" });
  expect(root.textContent).toContain("Ready\n\nChoose one collection.");
  expect(root.textContent).not.toContain("## Ready");
  expect(root.querySelector("script")).toBeNull();
  expect(root.querySelector("textarea")?.value).toBe(query);
  expect(root.querySelector('p[role="status"]')?.classList.contains("whitespace-pre-wrap")).toBe(true);
});
it("requires a click and binds approval to the returned run and token", async () => {
  await mount({ query: "DELETE FROM demo POINTS 'a';", collection: "demo", run_id: "run-1", approval_token: "one-use" });
  expect(action).not.toHaveBeenCalled();
  expect(root.querySelector("textarea")?.readOnly).toBe(true);
  button("Approve unchanged query").click();
  expect(action).toHaveBeenCalledExactlyOnceWith({ action: "approve", run_id: "run-1", approval_token: "one-use" });
});
it("disables stale approvals but still allows cancellation", async () => {
  await mount({ query: "DELETE", run_id: "run-2", approval_token: "one-use" }, true);
  expect(button("Approve unchanged query").disabled).toBe(true);
  button("Cancel").click();
  expect(action).toHaveBeenCalledExactlyOnceWith({ action: "cancel", run_id: "run-2" });
});
it("does not share data until the preview is explicitly approved", async () => {
  const preview = '[{"id":"synthetic"}]';
  await mount({ run_id: "run-3", sharing_preview: preview });
  button("Preview data sharing").click();
  await nextTick();
  expect(root.textContent).toContain(preview);
  expect(action).not.toHaveBeenCalled();
  button("Cancel").click();
  await nextTick();
  expect(action).not.toHaveBeenCalled();
  button("Preview data sharing").click();
  await nextTick();
  button("Share this preview and explain").click();
  expect(action).toHaveBeenCalledExactlyOnceWith({ action: "explain", run_id: "run-3", approved_preview: preview });
});
