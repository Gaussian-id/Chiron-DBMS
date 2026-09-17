import { readFileSync } from "node:fs";
import { parse } from "vue/compiler-sfc";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { CONNECTION_PROFILES } from "@/types/generated/connectionProfiles";

const appSource = readFileSync(new URL("../../../App.vue", import.meta.url), "utf8");
const script = parse(appSource).descriptor.scriptSetup!.content;
const source = ts.createSourceFile("App.vue.ts", script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function compile(text: string, bindings: Record<string, unknown>, result?: string) {
  const javascript = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(bindings), `${javascript}\n${result ? `return ${result};` : ""}`)(...Object.values(bindings));
}

describe("database availability at application entry points", () => {
  it.each(Object.entries(CONNECTION_PROFILES))("allows saved %s connections through runtime preparation", async (profile, definition) => {
    const registration = source.statements.find((statement) => statement.getText(source).startsWith("connectionStore.setBeforeConnectHandler("));
    expect(registration).toBeDefined();
    let beforeConnect!: (config: unknown) => Promise<void>;
    const ensureJdbcxRuntimeDrivers = vi.fn().mockResolvedValue(undefined);
    const ensureRegisteredJdbcProductRuntimeDrivers = vi.fn().mockResolvedValue(undefined);
    const api = {};
    compile(registration!.getText(source), {
      connectionStore: { setBeforeConnectHandler: (handler: typeof beforeConnect) => (beforeConnect = handler) },
      ensureJdbcxRuntimeDrivers,
      ensureRegisteredJdbcProductRuntimeDrivers,
      api,
    });
    const config = { id: "saved", db_type: definition.type, driver_profile: profile };
    await expect(beforeConnect(config)).resolves.toBeUndefined();
    expect(ensureJdbcxRuntimeDrivers).toHaveBeenCalledWith(config, api);
    expect(ensureRegisteredJdbcProductRuntimeDrivers).toHaveBeenCalledWith(config, api);
  });

  it.each(["agent", "jdbc", "storage", "runtime"])("opens Driver Manager on its %s tab", (tab) => {
    const declaration = source.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "openDriverStorePage");
    const driverStoreActiveTab = { value: "agent" };
    const driverStoreFocus = { value: { target: "old" } as unknown };
    const driverStoreTabOpen = { value: false };
    const activateMainContentSurface = vi.fn();
    const open = compile(declaration!.getText(source), { driverStoreActiveTab, driverStoreFocus, driverStoreTabOpen, activateMainContentSurface }, "openDriverStorePage");
    open(tab);
    expect(driverStoreActiveTab.value).toBe(tab);
    expect(driverStoreFocus.value).toBeNull();
    expect(driverStoreTabOpen.value).toBe(true);
    expect(activateMainContentSurface).toHaveBeenCalledWith("driverStore");
  });

  it("opens Plugin Center for connection extensions", () => {
    const declaration = source.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "openPluginCenterPage");
    const pluginCenterFocus = { value: null as unknown };
    const pluginCenterTabOpen = { value: false };
    const activateMainContentSurface = vi.fn();
    const open = compile(declaration!.getText(source), { pluginCenterFocus, pluginCenterTabOpen, activateMainContentSurface }, "openPluginCenterPage");
    open();
    expect(pluginCenterFocus.value).toBeNull();
    expect(pluginCenterTabOpen.value).toBe(true);
    expect(activateMainContentSurface).toHaveBeenCalledWith("pluginCenter");
  });
});
