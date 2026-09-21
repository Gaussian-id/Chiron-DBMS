// @vitest-environment happy-dom
import { it, expect } from "vitest";
import { migrateLegacyBrowserStorage } from "./legacyProfile";
import { isEncryptedConfig, encryptConfig, decryptConfig } from "../backend/configCrypto";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  } as Storage;
}

it("copies DBX storage once, retains source and never overwrites a new preference", () => {
  const storage = createStorage();
  storage.setItem("dbx-theme", "dark");
  storage.setItem("dbx-theme-palette", "gaussian");
  storage.setItem("chiron-horizon-theme", "light");
  migrateLegacyBrowserStorage(storage);
  expect(storage.getItem("chiron-horizon-theme")).toBe("light");
  expect(storage.getItem("chiron-horizon-theme-palette")).toBe("chiron");
  expect(storage.getItem("dbx-theme")).toBe("dark");
  storage.setItem("chiron-horizon-theme-palette", "changed");
  migrateLegacyBrowserStorage(storage);
  expect(storage.getItem("chiron-horizon-theme-palette")).toBe("changed");
});
it("migrates the former Gauss Horizon storage namespace without overwriting new preferences", () => {
  const storage = createStorage();
  storage.setItem("gauss-horizon-theme", "dark");
  storage.setItem("gauss-horizon-theme-palette", "gaussian");
  migrateLegacyBrowserStorage(storage);
  expect(storage.getItem("chiron-horizon-theme")).toBe("dark");
  expect(storage.getItem("chiron-horizon-theme-palette")).toBe("chiron");
  expect(storage.getItem("gauss-horizon-theme")).toBe("dark");
});
it("accepts legacy encrypted export envelopes while new exports use the new name", async () => {
  const payload = await encryptConfig('{"connections":[]}', "test passphrase");
  expect(payload.format).toBe("chiron-horizon-encrypted");
  const legacy = { ...payload, format: "chiron-horizon-encrypted" as const };
  expect(isEncryptedConfig(legacy)).toBe(true);
  expect(await decryptConfig(legacy, "test passphrase")).toBe('{"connections":[]}');
});

import { parseSqlServerLinkedSchema } from "@/lib/database/sqlServerLinkedServers";
it("reads linked-server schema references from a copied profile without changing IDs", () => {
  expect(parseSqlServerLinkedSchema("__chiron_horizon_sqlserver_linked__:ERP|Finance%20DB|dbo")).toEqual({ server: "ERP", catalog: "Finance DB", schema: "dbo" });
});
