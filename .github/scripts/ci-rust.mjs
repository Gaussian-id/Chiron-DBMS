import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { rustGroups } from "./ci-config.mjs";

export function rustCommand(action, group, mode) {
  if (!["test", "doctest", "clippy", "tree"].includes(action) || !["full", "fast"].includes(mode)
    || (group !== "workspace" && !Object.hasOwn(rustGroups, group)) || (action === "clippy" && group !== "workspace")) {
    throw new Error(`Unknown Rust CI configuration: ${action}/${group}/${mode}`);
  }
  const capabilityFeatures = ["duckdb-sidecar", "dynamodb", "mq-admin", "sqlite-sqlcipher"];
  if (mode === "full") capabilityFeatures.push("system-fonts");
  const appFeatures = ["chiron-horizon", "chiron-horizon-core", "chiron-horizon-web"].flatMap((name) => capabilityFeatures.map((feature) => `${name}/${feature}`));
  const foundationFeatures = ["chiron-horizon-types/mq-admin", "chiron-horizon-types/openapi", "chiron-horizon-sql/duckdb-sidecar", "chiron-horizon-sql/openapi",
    "chiron-horizon-sql-data/openapi", "chiron-horizon-sql-schema/duckdb-sidecar",
    "chiron-horizon-platform/downloads", "chiron-horizon-platform/host-prompts", "chiron-horizon-platform/test-support", "chiron-horizon-plugin-runtime/default", "chiron-horizon-plugin-runtime/test-support"];
  const features = group === "foundation" ? foundationFeatures : group === "drivers" ? [
    ...["duckdb-sidecar", "dynamodb", "mq-admin", "sqlite-bundled", "sqlite-sqlcipher", "test-support"].map((feature) => `chiron-horizon-drivers/${feature}`),
    "chiron-horizon-driver-agent/test-support", "chiron-horizon-driver-mysql/test-support", "chiron-horizon-driver-redis/test-support",
    "chiron-horizon-driver-support/test-support",
    "chiron-horizon-sqlite-worker/runtime", "chiron-horizon-types/openapi", "chiron-horizon-sql-data/openapi",
  ] : appFeatures;
  const packages = group === "workspace" ? ["--workspace"] : rustGroups[group].flatMap((name) => ["--package", name]);
  const command = action === "test" ? ["nextest", "run", "--no-fail-fast"] : action === "doctest" ? ["test", "--doc"] : [action];
  return [...command, ...packages, "--locked", ...(action === "clippy" ? ["--all-targets"] : []),
    "--no-default-features", "--features", features.join(","), ...(action === "clippy" ? ["--", "-D", "warnings"] : [])];
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = rustCommand(...process.argv.slice(2, 5));
  console.log(`cargo ${args.join(" ")}`);
  const result = spawnSync("cargo", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
