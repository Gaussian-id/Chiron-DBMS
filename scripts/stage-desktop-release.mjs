import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
const input = options.get("--input");
const output = options.get("--output");
if (!input || !output) throw new Error("Usage: stage-desktop-release.mjs --input <bundle-directory> --output <asset-path>");
const extension = extname(output).toLowerCase();
const visit = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? visit(path) : [path];
});
const candidates = visit(resolve(input)).filter((path) => extname(path).toLowerCase() === extension && statSync(path).isFile());
if (candidates.length !== 1) throw new Error(`Expected one ${extension} bundle in ${input}, found ${candidates.length}: ${candidates.join(", ")}`);
const assetName = basename(output);
if (/(?:chiron_horizon|chiron)/i.test(assetName)) throw new Error(`Legacy product name in release asset: ${assetName}`);
mkdirSync(resolve(output, ".."), { recursive: true });
cpSync(candidates[0], output);
if (!existsSync(output)) throw new Error(`Failed to stage ${output}`);
console.log(`Staged ${assetName}`);
