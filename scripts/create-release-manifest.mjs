import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const directory = process.argv[2];
if (!directory) throw new Error("Usage: create-release-manifest.mjs <release-directory>");
const root = resolve(directory);
const files = readdirSync(root).filter((name) => statSync(`${root}/${name}`).isFile() && !["SHA256SUMS", "release-manifest.json"].includes(name)).sort();
const assets = files.map((name) => {
  const bytes = readFileSync(`${root}/${name}`);
  return { name, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
});
writeFileSync(`${root}/SHA256SUMS`, assets.map((asset) => `${asset.sha256}  ${asset.name}`).join("\n") + "\n");
writeFileSync(`${root}/release-manifest.json`, JSON.stringify({ product: "Chiron Horizon", version: "0.1.0", assets }, null, 2) + "\n");
console.log(`Wrote checksums and manifest for ${assets.length} assets in ${basename(root)}`);
