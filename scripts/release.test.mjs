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
