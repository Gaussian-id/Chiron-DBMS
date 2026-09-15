import { describe, expect, it } from "vitest";
import { apiUrl, apiWebSocketUrl, gaussHorizonWebBasePath, webPath } from "@/lib/common/webPath";

describe("webPath", () => {
  it("keeps root deployments on root-relative API paths", () => {
    expect(gaussHorizonWebBasePath("/", "/")).toBe("");
    expect(apiUrl("/api/auth/check", "")).toBe("/api/auth/check");
  });

  it("uses an explicit build base path", () => {
    expect(gaussHorizonWebBasePath("/", "/gauss-horizon/")).toBe("/gauss-horizon");
    expect(webPath("/login", "/gauss-horizon")).toBe("/gauss-horizon/login");
    expect(webPath("/", "/gauss-horizon")).toBe("/gauss-horizon/");
    expect(webPath("/icons/database/mysql.svg", "/gauss-horizon")).toBe("/gauss-horizon/icons/database/mysql.svg");
    expect(webPath("/icons/ai/openai.svg", "/gauss-horizon")).toBe("/gauss-horizon/icons/ai/openai.svg");
    expect(webPath("/logo.png", "/gauss-horizon")).toBe("/gauss-horizon/logo.png");
    expect(webPath("/logo-black.png", "/gauss-horizon")).toBe("/gauss-horizon/logo-black.png");
    expect(webPath("/icon-preview-default.png", "/gauss-horizon")).toBe("/gauss-horizon/icon-preview-default.png");
    expect(webPath("/icon-preview-black.png", "/gauss-horizon")).toBe("/gauss-horizon/icon-preview-black.png");
    expect(apiUrl("/auth/check", "/gauss-horizon")).toBe("/gauss-horizon/api/auth/check");
    expect(apiUrl("/api/auth/check", "/gauss-horizon")).toBe("/gauss-horizon/api/auth/check");
    expect(apiUrl("api/auth/check", "/gauss-horizon")).toBe("/gauss-horizon/api/auth/check");
  });

  it("infers the runtime base path from the login URL for relative builds", () => {
    expect(gaussHorizonWebBasePath("/gauss-horizon/login", "./")).toBe("/gauss-horizon");
    expect(gaussHorizonWebBasePath("/tools/gauss-horizon/login", "./")).toBe("/tools/gauss-horizon");
  });

  it("infers the runtime base path from a mounted relative build", () => {
    expect(gaussHorizonWebBasePath("/gauss-horizon/", "./")).toBe("/gauss-horizon");
    expect(gaussHorizonWebBasePath("/tools/gauss-horizon/", "./")).toBe("/tools/gauss-horizon");
  });

  it("builds websocket URLs with the configured base path", () => {
    expect(apiWebSocketUrl("/redis/session/123", "/gauss-horizon", { protocol: "https:", host: "example.test" })).toBe("wss://example.test/gauss-horizon/api/redis/session/123");
  });
});
