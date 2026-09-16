#!/usr/bin/env node

import "./legacy-environment.js";

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const platformPackages = {
  "darwin-arm64": ["@chiron-horizon/plugin-cli-darwin-arm64", "chiron-horizon-plugin"],
  "darwin-x64": ["@chiron-horizon/plugin-cli-darwin-x64", "chiron-horizon-plugin"],
  "linux-arm64": ["@chiron-horizon/plugin-cli-linux-arm64-gnu", "chiron-horizon-plugin"],
  "linux-x64": ["@chiron-horizon/plugin-cli-linux-x64-gnu", "chiron-horizon-plugin"],
  "win32-arm64": ["@chiron-horizon/plugin-cli-win32-arm64", "chiron-horizon-plugin.exe"],
  "win32-x64": ["@chiron-horizon/plugin-cli-win32-x64", "chiron-horizon-plugin.exe"],
};

function platformTarget() {
  const platform = `${process.platform}-${process.arch}`;
  const target = platformPackages[platform];
  if (!target) {
    throw new Error(`Chiron Horizon Plugin CLI does not provide a binary for ${platform}.`);
  }
  return target;
}

function resolveBinary() {
  if (process.env.CHIRON_HORIZON_PLUGIN_CLI_BINARY) {
    if (!existsSync(process.env.CHIRON_HORIZON_PLUGIN_CLI_BINARY)) {
      throw new Error(`CHIRON_HORIZON_PLUGIN_CLI_BINARY does not exist: ${process.env.CHIRON_HORIZON_PLUGIN_CLI_BINARY}`);
    }
    return process.env.CHIRON_HORIZON_PLUGIN_CLI_BINARY;
  }

  const [packageName, binaryName] = platformTarget();
  let manifest;
  try {
    manifest = require.resolve(`${packageName}/package.json`);
  } catch {
    throw new Error(
      `The optional package ${packageName} was not installed. Reinstall @chiron-horizon/plugin-cli without --no-optional.`,
    );
  }

  const binary = join(dirname(manifest), "bin", binaryName);
  if (!existsSync(binary)) {
    throw new Error(`The Chiron Horizon Plugin CLI binary is missing from ${packageName}.`);
  }
  return binary;
}

function bundledSdkRoot() {
  const sdkRoot = join(packageRoot, "sdk-root");
  const rustManifest = join(sdkRoot, "plugins", "sdk", "rust", "chiron-horizon-plugin-sdk", "Cargo.toml");
  const goManifest = join(sdkRoot, "plugins", "sdk", "go", "chiron-horizon-plugin-sdk", "go.mod");
  return existsSync(rustManifest) && existsSync(goManifest) ? sdkRoot : undefined;
}

try {
  if (process.argv[2] === "--verify-platform") {
    platformTarget();
    process.exit(0);
  }

  const binary = resolveBinary();
  const env = { ...process.env };
  delete env.CHIRON_HORIZON_PLUGIN_CLI_BINARY;
  if (process.argv[2] === "dev") {
    if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("chiron-horizon-plugin dev requires Node.js 22+.");
    env.CHIRON_HORIZON_PLUGIN_NODE = env.CHIRON_HORIZON_PLUGIN_NODE || process.execPath;
    env.CHIRON_HORIZON_PLUGIN_DEV_RUNTIME = env.CHIRON_HORIZON_PLUGIN_DEV_RUNTIME || join(packageRoot, "dev-runtime", "runtime.mjs");
  }
  if (!env.CHIRON_HORIZON_PLUGIN_SDK_ROOT) {
    const sdkRoot = bundledSdkRoot();
    if (sdkRoot) env.CHIRON_HORIZON_PLUGIN_SDK_ROOT = sdkRoot;
  }

  const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit", env });
  if (result.error) {
    throw result.error;
  }
  if (result.signal) {
    process.kill(process.pid, result.signal);
  }
  process.exit(result.status ?? 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
