import { afterEach, expect, it, vi } from "vitest";
import { changelogUrl, fetchChangelog, loadChangelogBootstrap } from "./changelog";
afterEach(()=>vi.restoreAllMocks());
it("keeps current Chiron Horizon release history available offline",async()=>{
 const fetch=vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("offline"));
 const data=await loadChangelogBootstrap("en");
 expect(data.initialRelease?.tag).toBe("v0.1.1");
 expect(data.initialRelease?.unreleased).toBeUndefined();
 expect(data.index).toHaveLength(2);
 expect(fetch).toHaveBeenCalledWith(changelogUrl("en"),expect.anything());
 expect(changelogUrl("cn")).toBe("https://raw.githubusercontent.com/Gaussian-id/Chiron-Horizon/main/crates/chiron-horizon-core/assets/changelog.json");
});
it("does not relabel an inherited release listing as Chiron Horizon history",async()=>{
 vi.spyOn(globalThis,"fetch").mockResolvedValue(Response.json({releases:[{tag:"v0.6.12"}]}));
 expect((await fetchChangelog("en")).releases.map(r=>r.tag)).toEqual(["v0.1.1","v0.1.0"]);
});
