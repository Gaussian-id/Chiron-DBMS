import { afterEach, expect, it, vi } from "vitest";
import { changelogUrl, fetchChangelog, loadChangelogBootstrap } from "./changelog";
afterEach(()=>vi.restoreAllMocks());
it("keeps the unpublished Gaussian baseline available offline",async()=>{
 const fetch=vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("offline"));
 const data=await loadChangelogBootstrap("en");
 expect(data.initialRelease?.tag).toBe("v0.1.0");
 expect(data.initialRelease?.unreleased).toBe(true);
 expect(data.index).toHaveLength(1);
 expect(fetch).toHaveBeenCalledWith(changelogUrl("en"),expect.anything());
 expect(changelogUrl("cn")).toBe("https://raw.githubusercontent.com/Gaussian-id/Gauss-Horizon/main/crates/gauss-horizon-core/assets/changelog.json");
});
it("does not relabel an inherited release listing as Gaussian history",async()=>{
 vi.spyOn(globalThis,"fetch").mockResolvedValue(Response.json({releases:[{tag:"v0.6.12"}]}));
 expect((await fetchChangelog("en")).releases.map(r=>r.tag)).toEqual(["v0.1.0"]);
});
