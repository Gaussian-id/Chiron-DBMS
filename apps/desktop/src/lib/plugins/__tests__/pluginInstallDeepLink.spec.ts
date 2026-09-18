import { describe, expect, it } from "vitest";
import { parsePluginInstallDeepLink } from "../pluginInstallDeepLink";

const PACKAGE_URL = "https://dl.chiron-horizon.com/plugins/chiron.horizon.ssh/0.4.73/chiron.horizon.ssh-0.4.73-darwin-arm64.chiron-horizonp";

describe("parsePluginInstallDeepLink", () => {
  it("extracts the encoded package url", () => {
    const draft = parsePluginInstallDeepLink(`chiron_horizon://plugins/install?url=${encodeURIComponent(PACKAGE_URL)}`);
    expect(draft).toEqual({ url: PACKAGE_URL });
  });

  it("returns null for non-plugin links and junk", () => {
    expect(parsePluginInstallDeepLink("chiron_horizon://connection/new?type=mysql")).toBeNull();
    expect(parsePluginInstallDeepLink("chiron_horizon://plugins/installed?url=https://example.com/a.chiron-horizonp")).toBeNull();
    expect(parsePluginInstallDeepLink("chiron_horizon://plugins/installation?url=https://example.com/a.chiron-horizonp")).toBeNull();
    expect(parsePluginInstallDeepLink("")).toBeNull();
    expect(parsePluginInstallDeepLink("not a url")).toBeNull();
  });

  it("throws for matching links without a usable url param", () => {
    expect(() => parsePluginInstallDeepLink("chiron_horizon://plugins/install")).toThrow(/Missing url/);
    expect(() => parsePluginInstallDeepLink("chiron_horizon://plugins/install?url=")).toThrow(/Missing url/);
    expect(() => parsePluginInstallDeepLink(`chiron_horizon://plugins/install?url=${encodeURIComponent("ftp://example.com/a.chiron-horizonp")}`)).toThrow(/http/);
    expect(() => parsePluginInstallDeepLink(`chiron_horizon://plugins/install?url=${encodeURIComponent(`https://example.com/${"a".repeat(2100)}`)}`)).toThrow(/too long/);
  });
});
