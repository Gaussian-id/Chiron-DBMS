import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createI18n } from "vue-i18n";
import en from "../locales/en";

describe("Chiron Horizon English fallback", () => {
  it("resolves every native ChironDB workspace label and the welcome tagline", () => {
    const i18n = createI18n({ legacy: false, locale: "en", messages: { en } });
    const files = ["../../components/vector/ChironDbBrowser.vue", "../../components/vector/ChironQueryEditor.vue"];
    const keys = new Set(["welcome.chironTagline"]);
    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      for (const match of source.matchAll(/\bt\(["'](chiron\.[^"']+)["']/g)) keys.add(match[1]);
    }
    expect(keys.size).toBeGreaterThan(10);
    for (const key of keys) expect(i18n.global.t(key), key).not.toBe(key);
  });
});
