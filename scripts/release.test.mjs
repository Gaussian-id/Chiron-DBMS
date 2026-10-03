import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
for (const script of ["release.mjs", "release-node-packages.mjs"]) {
  test(`${script} cannot publish any artifact`, () => {
    const result = spawnSync(process.execPath, [`scripts/${script}`, "app", "--yes"], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /disabled|not available/i);
  });
}

test("desktop staging accepts Horizon names and rejects legacy product names", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const root = mkdtempSync(join(tmpdir(), "horizon-release-staging-"));
  try {
    const input = join(root, "input");
    mkdirSync(input);
    writeFileSync(join(input, "bundle.dmg"), "synthetic bundle");
    const output = join(root, "release", "Chiron-Horizon_0.1.3_macos-arm64.dmg");
    const stage = (path) => spawnSync(process.execPath, ["scripts/stage-desktop-release.mjs", "--input", input, "--output", path], { encoding: "utf8" });
    const result = stage(output);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, "utf8"), "synthetic bundle");
    const legacy = stage(join(root, "release", "Gauss-Horizon_0.1.3_macos-arm64.dmg"));
    assert.notEqual(legacy.status, 0);
    assert.match(legacy.stderr, /Legacy product name/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
