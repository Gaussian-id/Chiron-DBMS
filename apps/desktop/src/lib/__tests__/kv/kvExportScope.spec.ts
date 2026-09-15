import { describe, expect, it } from "vitest";
import { isKeyInKvExportScope, kvDirectoryPrefix, kvExportFilenameStem, kvValueByteIdentity } from "@/lib/kv/kvExportScope";

describe("KV export scope", () => {
  it("matches a directory itself and descendants without leaking into adjacent prefixes", () => {
    const scope = { path: "/gauss-horizon", kind: "prefix" as const };

    expect(isKeyInKvExportScope("/gauss-horizon", scope)).toBe(true);
    expect(isKeyInKvExportScope("/gauss-horizon/app/name", scope)).toBe(true);
    expect(isKeyInKvExportScope("/gauss-horizon-other", scope)).toBe(false);
  });

  it("matches only the selected key for a key export", () => {
    const scope = { path: "gauss-horizon/key", kind: "key" as const };

    expect(isKeyInKvExportScope("gauss-horizon/key", scope)).toBe(true);
    expect(isKeyInKvExportScope("gauss-horizon/key/child", scope)).toBe(false);
  });

  it("builds stable directory prefixes and safe filenames", () => {
    expect(kvDirectoryPrefix("/gauss-horizon")).toBe("/gauss-horizon/");
    expect(kvDirectoryPrefix("gauss-horizon/")).toBe("gauss-horizon/");
    expect(kvExportFilenameStem("/应用 配置/prod")).toBe("应用-配置-prod");
    expect(kvExportFilenameStem("/")).toBe("root");
  });

  it("compares UTF-8 and Base64 representations by their original bytes", () => {
    expect(kvValueByteIdentity({ encoding: "utf8", data: "/gauss-horizon/app" })).toBe(kvValueByteIdentity({ encoding: "base64", data: "L2NoaXJvbmRibXMvYXBw" }));
    expect(kvValueByteIdentity({ encoding: "utf8", data: "/gauss-horizon/app" })).not.toBe(kvValueByteIdentity({ encoding: "utf8", data: "/gauss-horizon-other" }));
  });
});
