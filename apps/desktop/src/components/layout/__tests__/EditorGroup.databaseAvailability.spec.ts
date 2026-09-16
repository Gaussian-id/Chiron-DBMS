// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App, type Component } from "vue";
const state = vi.hoisted(() => ({
  connection: { id: "saved", db_type: "postgres", name: "Saved connection" },
  tab: { id: "draft", connectionId: "saved", title: "Unsaved draft", mode: "query", sql: "SELECT 1;", database: "demo" },
}));
vi.mock("@/stores/connectionStore", () => ({ useConnectionStore: () => ({ getConfig: () => state.connection }) }));
vi.mock("@/stores/queryStore", () => ({ useQueryStore: () => ({ tabs: [state.tab], focusedGroupId: "main" }) }));
vi.mock("@/stores/settingsStore", () => ({ useSettingsStore: () => ({ editorSettings: { tabPlacement: "top", executeMode: "all", sqlFormatter: { keywordCase: "upper" } } }) }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../EditorGroupTabBar.vue", () => ({ default: { render: () => null } }));
vi.mock("../EditorToolbar.vue", () => ({ default: { render: () => h("div", { "data-sql-toolbar": "" }) } }));
vi.mock("../QueryEditorSurface.vue", () => ({ default: { render: () => h("div", { "data-query-surface": "" }) } }));
vi.mock("../ContentArea.vue", () => ({ default: { render: () => h("div", { "data-content-surface": "" }) } }));
import EditorGroup from "../EditorGroup.vue";
import driverManifest from "../../../../../../crates/gauss-horizon-core/assets/database-drivers.manifest.json";
let app: App;
let root: HTMLElement;
async function mount(type: string, mode = "query") {
  state.connection.db_type = type;
  state.tab.mode = mode;
  root = document.createElement("div");
  document.body.append(root);
  app = createApp({ render: () => h(EditorGroup as Component, { groupId: "main", tabIds: ["draft"], activeTabId: "draft", showTabNavigation: false }) });
  app.mount(root);
  await nextTick();
}
afterEach(() => {
  app?.unmount();
  root?.remove();
});
it.each(driverManifest.drivers.map((driver) => driver.dbType))("mounts a restored %s query workspace", async (type) => {
  await mount(type);
  expect(root.querySelector("[data-query-surface]")).not.toBeNull();
  expect(root.textContent).not.toContain("Coming Soon");
  expect(state.tab.sql).toBe("SELECT 1;");
});
it.each(driverManifest.drivers.filter((driver) => "dialect" in driver).map((driver) => driver.dbType))("restores the %s SQL toolbar", async (type) => {
  await mount(type);
  expect(root.querySelector("[data-sql-toolbar]")).not.toBeNull();
});
it.each(["data", "structure"])("mounts a restored relational %s workspace", async (mode) => {
  await mount("postgres", mode);
  expect(root.querySelector("[data-content-surface]")).not.toBeNull();
  expect(root.querySelector("[data-query-surface]")).toBeNull();
});
it("keeps the native ChironDB query surface available", async () => {
  await mount("chirondb");
  expect(root.querySelector("[data-query-surface]")).not.toBeNull();
  expect(root.querySelector("[data-sql-toolbar]")).toBeNull();
  expect(root.textContent).not.toContain("Coming Soon");
});
