import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("offline JDBC verification checks every declared release platform", () => {
  const root = mkdtempSync(join(tmpdir(), "horizon-offline-verification-"));
  const json = (path, value) => writeFileSync(path, JSON.stringify(value));
  try {
    const payload = join(root, "offline-jdbc", "jdbc");
    const bundleDir = join(payload, "maven", "test-driver");
    mkdirSync(join(bundleDir, "jars"), { recursive: true });
    const bytes = Buffer.from("synthetic approved driver");
    const artifact = {
      file_name: "driver.jar",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    const bundle = { id: "test-driver", coordinate: "example:driver:1", artifact, redistribution: {} };
    const assets = join(root, "assets.json");
    json(assets, { drivers: { example: { bundles: { driver: bundle } } } });
    writeFileSync(join(bundleDir, "jars", artifact.file_name), bytes);
    json(join(bundleDir, "manifest.json"), { coordinate: bundle.coordinate, artifacts: [artifact] });
    json(join(payload, "offline-manifest.json"), {
      third_party_entry: "jdbc/third-party-notices.json",
      bundles: [{ id: bundle.id, coordinate: bundle.coordinate }],
    });
    json(join(payload, "third-party-notices.json"), { bundles: [bundle] });
    writeFileSync(join(payload, "plugin.zip"), "synthetic plugin");

    const platforms = { "macos-aarch64": {}, "macos-x64": {}, "windows-x64": {}, "linux-x64": {} };
    const registryPath = join(root, "agent-registry.json");
    json(registryPath, { jres: { 21: { platforms } } });
    for (const platform of Object.keys(platforms)) {
      const zip = spawnSync("zip", ["-qr", join(root, `chiron-horizon-agents-offline-${platform}.zip`), "jdbc"], {
        cwd: join(root, "offline-jdbc"), encoding: "utf8",
      });
      assert.equal(zip.status, 0, zip.stderr);
    }
    const verify = () => spawnSync(process.execPath, ["agents/scripts/verify_offline_jdbc_release.mjs", root, assets], { encoding: "utf8" });
    const valid = verify();
    assert.equal(valid.status, 0, valid.stderr);

    json(registryPath, { jres: { 21: { platforms: { ...platforms, "linux-aarch64": {} } } } });
    const missing = verify();
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Offline ZIP not found: .*linux-aarch64/);

    json(registryPath, { jres: { 21: { platforms } } });
    writeFileSync(join(bundleDir, "jars", artifact.file_name), "tampered driver");
    const tampered = verify();
    assert.notEqual(tampered.status, 0);
    assert.match(tampered.stderr, /Invalid bundled JDBC artifact/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
