import { describe, expect, it } from "vitest";
import { apiUrl, apiWebSocketUrl, chironHorizonWebBasePath, webPath } from "@/lib/common/webPath";

describe("webPath", () => {
  it("keeps root deployments on root-relative API paths", () => {
    expect(chironHorizonWebBasePath("/", "/")).toBe("");
    expect(apiUrl("/api/auth/check", "")).toBe("/api/auth/check");
  });

  it("uses an explicit build base path", () => {
    expect(chironHorizonWebBasePath("/", "/chiron-horizon/")).toBe("/chiron-horizon");
    expect(webPath("/login", "/chiron-horizon")).toBe("/chiron-horizon/login");
    expect(webPath("/", "/chiron-horizon")).toBe("/chiron-horizon/");
    expect(webPath("/icons/database/mysql.svg", "/chiron-horizon")).toBe("/chiron-horizon/icons/database/mysql.svg");
    expect(webPath("/icons/ai/openai.svg", "/chiron-horizon")).toBe("/chiron-horizon/icons/ai/openai.svg");
    expect(webPath("/logo.png", "/chiron-horizon")).toBe("/chiron-horizon/logo.png");
    expect(webPath("/logo-black.png", "/chiron-horizon")).toBe("/chiron-horizon/logo-black.png");
    expect(webPath("/icon-preview-default.png", "/chiron-horizon")).toBe("/chiron-horizon/icon-preview-default.png");
    expect(webPath("/icon-preview-black.png", "/chiron-horizon")).toBe("/chiron-horizon/icon-preview-black.png");
    expect(apiUrl("/auth/check", "/chiron-horizon")).toBe("/chiron-horizon/api/auth/check");
    expect(apiUrl("/api/auth/check", "/chiron-horizon")).toBe("/chiron-horizon/api/auth/check");
    expect(apiUrl("api/auth/check", "/chiron-horizon")).toBe("/chiron-horizon/api/auth/check");
  });

  it("infers the runtime base path from the login URL for relative builds", () => {
    expect(chironHorizonWebBasePath("/chiron-horizon/login", "./")).toBe("/chiron-horizon");
    expect(chironHorizonWebBasePath("/tools/chiron-horizon/login", "./")).toBe("/tools/chiron-horizon");
  });

  it("infers the runtime base path from a mounted relative build", () => {
    expect(chironHorizonWebBasePath("/chiron-horizon/", "./")).toBe("/chiron-horizon");
    expect(chironHorizonWebBasePath("/tools/chiron-horizon/", "./")).toBe("/tools/chiron-horizon");
  });

  it("builds websocket URLs with the configured base path", () => {
    expect(apiWebSocketUrl("/redis/session/123", "/chiron-horizon", { protocol: "https:", host: "example.test" })).toBe("wss://example.test/chiron-horizon/api/redis/session/123");
  });
});
