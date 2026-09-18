import { describe, expect, it } from "vitest";
import { buildMarketplacePluginListings, filterMarketplacePluginListings, marketplaceHomepageUrl, selectMarketplaceArtifact } from "./pluginMarketplace";
import type { InstalledPlugin, PluginRepositoryCatalogResult } from "@/types/database";

const result: PluginRepositoryCatalogResult = {
  repository: { id: "chiron-horizon-official", name: "Chiron Horizon Marketplace", kind: "official", enabled: true, managed: true },
  target: "darwin-arm64",
  catalog: {
    catalogVersion: 1,
    repository: { id: "chiron-horizon-official", name: "Chiron Horizon Marketplace" },
    plugins: [
      {
        id: "example.hello",
        name: "Hello",
        description: "Greets the user",
        publisher: "Chiron Horizon",
        verified: true,
        tags: ["sample"],
        permissions: [],
        latestVersion: "1.1.0",
        versions: [
          {
            version: "1.1.0",
            artifacts: [{ target: "darwin-arm64", url: "https://plugins.example.com/hello.chiron-horizonp", sha256: "a".repeat(64), signingKeyId: "chiron.horizon.release" }],
          },
        ],
        localizations: { "zh-CN": { name: "你好工作台", description: "用于验证插件工作台" } },
      },
    ],
  },
};

function installed(version: string): InstalledPlugin {
  return {
    manifest: {
      manifest_version: 1,
      id: "example.hello",
      name: "Hello",
      version,
      publisher: "Chiron Horizon",
      description: "",
      engines: { "chiron-horizon": "", host_api: "" },
      permissions: [],
      entrypoints: {},
      contributions: [],
      drivers: [],
      protocol_version: 1,
    },
    compatibility: { compatible: true, errors: [], warnings: [], target: "darwin-arm64" },
  };
}

describe("plugin marketplace listings", () => {
  it("localizes, detects updates, and filters by repository", () => {
    const listings = buildMarketplacePluginListings([result], [installed("1.0.0")], "zh-CN");

    expect(listings[0]).toMatchObject({ name: "你好工作台", status: "update", target: "darwin-arm64" });
    expect(filterMarketplacePluginListings(listings, "验证", "chiron-horizon-official")).toHaveLength(1);
  });

  it("marks a plugin unsupported when the current target has no artifact", () => {
    const unsupported = structuredClone(result);
    unsupported.target = "linux-x64";

    expect(buildMarketplacePluginListings([unsupported], [], "en")[0].status).toBe("unsupported");
  });

  it("uses a universal artifact when the current target has no exact artifact", () => {
    const universal = structuredClone(result);
    universal.target = "linux-x64";
    universal.catalog!.plugins[0].versions[0].artifacts = [{ target: "universal", url: "https://plugins.example.com/hello-universal.chiron-horizonp", sha256: "b".repeat(64), signingKeyId: "chiron.horizon.release" }];

    expect(buildMarketplacePluginListings([universal], [], "en")[0]).toMatchObject({ status: "install", artifact: { target: "universal" } });
  });

  it("prefers an exact artifact over the universal fallback", () => {
    const artifacts = [
      { target: "universal", url: "https://plugins.example.com/hello-universal.chiron-horizonp", sha256: "a".repeat(64), signingKeyId: "chiron.horizon.release" },
      { target: "darwin-arm64", url: "https://plugins.example.com/hello-darwin.chiron-horizonp", sha256: "b".repeat(64), signingKeyId: "chiron.horizon.release" },
    ];

    expect(selectMarketplaceArtifact(artifacts, "darwin-arm64")?.target).toBe("darwin-arm64");
  });

  it("treats a repository URL and its homepage URL as one link", () => {
    expect(marketplaceHomepageUrl("https://github.com/chiron-horizon/example/", "https://github.com/chiron-horizon/example#readme")).toBeUndefined();
    expect(marketplaceHomepageUrl("https://github.com/chiron-horizon/example", "https://chiron-horizon.com/plugins/example")).toBe("https://chiron-horizon.com/plugins/example");
  });
});
