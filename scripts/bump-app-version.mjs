import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const requested = process.argv[2];
const current = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")).version;
const next = requested === "patch" ? current.replace(/^0\.1\.(\d+)$/, (_, patch) => `0.1.${Number(patch) + 1}`) : requested;
if (!/^0\.1\.\d+$/.test(next)) throw new Error("Expected a 0.1.x application version.");
if (requested === "patch" && !/^0\.1\.\d+$/.test(current)) throw new Error(`Current application version '${current}' is not on the 0.1.x release line.`);

for (const file of execFileSync("git", ["ls-files", "crates/*/Cargo.toml", "src-tauri/Cargo.toml"]).toString().trim().split("\n").filter(Boolean)) {
  const text = readFileSync(file, "utf8");
  if (/^(name\s*=\s*"chiron[-_]horizon)/m.test(text)) writeFileSync(file, text.replace(/^version\s*=\s*"[^"]+"$/m, `version = "${next}"`));
}
for (const file of ["package.json", "src-tauri/tauri.conf.json"]) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.version = next;
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}
{
  const docs = JSON.parse(readFileSync("docs/package.json", "utf8"));
  docs.version = next;
  writeFileSync("docs/package.json", `${JSON.stringify(docs, null, 2)}\n`);
}
{
  const versions = JSON.parse(readFileSync("agents/versions.json", "utf8"));
  writeFileSync("agents/versions.json", `${JSON.stringify(Object.fromEntries(Object.keys(versions).sort().map((driver) => [driver, next])), null, 2)}\n`);
}
{
  const manifest = JSON.parse(readFileSync("plugins/jdbc/manifest.json", "utf8"));
  manifest.version = next;
  writeFileSync("plugins/jdbc/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
}
{
  const build = readFileSync("plugins/jdbc/build.gradle", "utf8");
  writeFileSync("plugins/jdbc/build.gradle", build.replace(/^version\s*=\s*'[^']+'$/m, `version = '${next}'`));
}
for (const workflow of [".github/workflows/verify.yml", ".github/workflows/release.yml"]) {
  writeFileSync(workflow, readFileSync(workflow, "utf8").replaceAll(current, next));
}
for (const file of [
  "crates/chiron-horizon-core/src/agent_service.rs",
  "crates/chiron-horizon-core/src/jdbc.rs",
  "docs/lib/agentRegistry.ts",
  "docs/content/docs/getting-started.mdx",
  "docs/content/docs/user-guide.mdx",
  "docs/content/docs/1panel.mdx",
  "docs/content/docs/cli.mdx",
  "docs/content/docs/mcp.mdx",
]) {
  writeFileSync(file, readFileSync(file, "utf8").replaceAll(current, next));
}
console.log(`Application version advanced from ${current} to ${next}.`);
