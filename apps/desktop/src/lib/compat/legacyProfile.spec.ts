// @vitest-environment happy-dom
import { it, expect } from "vitest";
import { migrateLegacyBrowserStorage } from "./legacyProfile";
import { isEncryptedConfig, encryptConfig, decryptConfig } from "../backend/configCrypto";
it("copies old storage once, retains source and never overwrites a new preference", () => {
  localStorage.clear();
  localStorage.setItem("dbx-theme", "dark");
  localStorage.setItem("dbx-theme-palette", "gaussian");
  localStorage.setItem("chiron-horizon-theme", "light");
  migrateLegacyBrowserStorage(localStorage);
  expect(localStorage.getItem("chiron-horizon-theme")).toBe("light");
  expect(localStorage.getItem("chiron-horizon-theme-palette")).toBe("chiron");
  expect(localStorage.getItem("dbx-theme")).toBe("dark");
  localStorage.setItem("dbx-theme-palette", "changed");
  migrateLegacyBrowserStorage(localStorage);
  expect(localStorage.getItem("chiron-horizon-theme-palette")).toBe("chiron");
});
it("migrates the former Gauss Horizon storage namespace without overwriting new preferences", () => {
  localStorage.clear();
  localStorage.setItem("gauss-horizon-theme", "dark");
  localStorage.setItem("gauss-horizon-theme-palette", "gaussian");
  migrateLegacyBrowserStorage(localStorage);
  expect(localStorage.getItem("chiron-horizon-theme")).toBe("dark");
  expect(localStorage.getItem("chiron-horizon-theme-palette")).toBe("chiron");
  expect(localStorage.getItem("gauss-horizon-theme")).toBe("dark");
});
it("accepts legacy encrypted export envelopes while new exports use the new name", async () => {
  const payload = await encryptConfig('{"connections":[]}', "test passphrase");
  expect(payload.format).toBe("chiron-horizon-encrypted");
  const legacy = { ...payload, format: "dbx-encrypted" as const };
  expect(isEncryptedConfig(legacy)).toBe(true);
  expect(await decryptConfig(legacy, "test passphrase")).toBe('{"connections":[]}');
});

import { parseSqlServerLinkedSchema } from "@/lib/database/sqlServerLinkedServers";
it("reads linked-server schema references from a copied profile without changing IDs", () => {
  expect(parseSqlServerLinkedSchema("__dbx_sqlserver_linked__:ERP|Finance%20DB|dbo")).toEqual({ server: "ERP", catalog: "Finance DB", schema: "dbo" });
});
