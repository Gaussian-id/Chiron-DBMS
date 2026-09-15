// @vitest-environment happy-dom
import { it, expect } from "vitest";
import { migrateLegacyBrowserStorage } from "./legacyProfile";
import { isEncryptedConfig, encryptConfig, decryptConfig } from "../backend/configCrypto";
it("copies old storage once, retains source and never overwrites a new preference", () => {
  localStorage.clear();
  localStorage.setItem("dbx-theme", "dark");
  localStorage.setItem("dbx-theme-palette", "gaussian");
  localStorage.setItem("gauss-horizon-theme", "light");
  migrateLegacyBrowserStorage(localStorage);
  expect(localStorage.getItem("gauss-horizon-theme")).toBe("light");
  expect(localStorage.getItem("gauss-horizon-theme-palette")).toBe("gaussian");
  expect(localStorage.getItem("dbx-theme")).toBe("dark");
  localStorage.setItem("dbx-theme-palette", "changed");
  migrateLegacyBrowserStorage(localStorage);
  expect(localStorage.getItem("gauss-horizon-theme-palette")).toBe("gaussian");
});
it("accepts legacy encrypted export envelopes while new exports use the new name", async () => {
  const payload = await encryptConfig('{"connections":[]}', "test passphrase");
  expect(payload.format).toBe("gauss-horizon-encrypted");
  const legacy = { ...payload, format: "dbx-encrypted" as const };
  expect(isEncryptedConfig(legacy)).toBe(true);
  expect(await decryptConfig(legacy, "test passphrase")).toBe('{"connections":[]}');
});

import { parseSqlServerLinkedSchema } from "@/lib/database/sqlServerLinkedServers";
it("reads linked-server schema references from a copied profile without changing IDs", () => {
  expect(parseSqlServerLinkedSchema("__dbx_sqlserver_linked__:ERP|Finance%20DB|dbo")).toEqual({ server: "ERP", catalog: "Finance DB", schema: "dbo" });
});
