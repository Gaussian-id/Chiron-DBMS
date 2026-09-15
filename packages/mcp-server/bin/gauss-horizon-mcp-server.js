#!/usr/bin/env node

import "./legacy-environment.js";

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const platformPackages = {
  "darwin-arm64": ["@gauss-horizon/mcp-darwin-arm64", "gauss-horizon-mcp"],
  "darwin-x64": ["@gauss-horizon/mcp-darwin-x64", "gauss-horizon-mcp"],
  "linux-arm64": ["@gauss-horizon/mcp-linux-arm64-gnu", "gauss-horizon-mcp"],
  "linux-x64": ["@gauss-horizon/mcp-linux-x64-gnu", "gauss-horizon-mcp"],
  "win32-arm64": ["@gauss-horizon/mcp-win32-arm64", "gauss-horizon-mcp.exe"],
  "win32-x64": ["@gauss-horizon/mcp-win32-x64", "gauss-horizon-mcp.exe"],
};

function resolveBinary() {
  if (process.env.GAUSS_HORIZON_MCP_BINARY) {
    return process.env.GAUSS_HORIZON_MCP_BINARY;
  }
  const platform = `${process.platform}-${process.arch}`;
  const target = platformPackages[platform];
  if (!target) {
    throw new Error(`Gauss Horizon MCP does not provide a Rust binary for ${platform}.`);
  }
  const [packageName, binaryName] = target;
  let manifest;
  try {
    manifest = require.resolve(`${packageName}/package.json`);
  } catch {
    throw new Error(
      `The optional package ${packageName} was not installed. Reinstall @gauss-horizon/mcp-server without --no-optional.`,
    );
  }
  const binary = join(dirname(manifest), "bin", binaryName);
  if (!existsSync(binary)) {
    throw new Error(`The Gauss Horizon MCP binary is missing from ${packageName}.`);
  }
  return binary;
}

try {
  if (process.argv[2] === "--verify-platform") {
    const platform = `${process.platform}-${process.arch}`;
    if (!platformPackages[platform]) {
      throw new Error(`Gauss Horizon MCP does not provide a Rust binary for ${platform}.`);
    }
    process.exit(0);
  }
  const binary = resolveBinary();
  const child = spawn(binary, process.argv.slice(2), {
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("error", (error) => {
    console.error(`Failed to start Gauss Horizon MCP: ${error.message}`);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
