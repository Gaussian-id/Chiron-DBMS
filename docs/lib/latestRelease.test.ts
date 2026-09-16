import { expect, it, vi } from "vitest";
import { fetchLatestReleaseInfo } from "./latestRelease";
it("does not probe any release service before the first Chiron Horizon publication", async () => {
 const fetch=vi.spyOn(globalThis,"fetch");
 try { expect(await fetchLatestReleaseInfo()).toBeNull(); expect(fetch).not.toHaveBeenCalled(); }
 finally {fetch.mockRestore();}
});
