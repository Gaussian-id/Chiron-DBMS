import { expect, it } from "vitest";
import { createInstallOptions } from "./downloadLinks";
it("lists only supported targets and directs users to build evidence without fake release links", () => {
 const options=createInstallOptions("en","0.1.0");
 expect(options.map(o=>o.id)).toEqual(["macos-arm","macos-intel","windows","linux"]);
 for (const option of options) {
  expect(option.action).toBe("instructions");
  expect(option.href).toBe("https://github.com/Gaussian-id/Gauss-Horizon/actions");
  expect(option.description).toContain("not available");
  expect(option.browserStaticDownloads).toBeUndefined();
 }
});
