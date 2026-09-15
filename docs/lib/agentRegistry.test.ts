import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import driverVersions from "../../agents/versions.json";
import { buildAgentDownloadCatalog, buildDriverEntries, buildNativeAgentEntries, downloadLinksFor, formatSize } from "./agentRegistry";
import { fetchAgentDownloadCatalog } from "./agentRegistrySource";

afterEach(() => {
  vi.restoreAllMocks();
});

test("offline download catalog includes the JDBC plugin ZIP", () => {
  const catalog = buildAgentDownloadCatalog([]);

  assert.deepEqual(catalog.jdbcPlugin, {
    label: "Gauss Horizon JDBC Plugin",
    filename: "gauss-horizon-jdbc-plugin-0.1.0.zip",
    url: "https://github.com/Gaussian-id/Gauss-Horizon/releases/download/v0.1.0/gauss-horizon-jdbc-plugin-0.1.0.zip",
  });
});

test("distribution is unavailable without probing or returning upstream links", async () => {
  const fetch=vi.spyOn(globalThis,"fetch");
  assert.deepEqual(downloadLinksFor("https://example.com/package.zip"),[]);
  assert.equal(await fetchAgentDownloadCatalog(),null);
  assert.equal(fetch.mock.calls.length,0);
});

test("unknown fallback asset sizes render as unavailable", () => {
  assert.equal(formatSize(0), "—");
});

test("Java agent tar.zst packages are preferred over raw JARs", () => {
  const accessVersion = driverVersions.access;
  const entries = buildDriverEntries([
    {
      name: `gauss-horizon-agent-access-${accessVersion}.jar`,
      browser_download_url: `https://example.com/gauss-horizon-agent-access-${accessVersion}.jar`,
      size: 1024,
    },
    {
      name: `gauss-horizon-agent-access-${accessVersion}.tar.zst`,
      browser_download_url: `https://example.com/gauss-horizon-agent-access-${accessVersion}.tar.zst`,
      size: 2048,
    },
  ]);

  assert.equal(entries[0]?.key, "access");
  assert.equal(entries[0]?.jar.url, `https://example.com/gauss-horizon-agent-access-${accessVersion}.tar.zst`);
});

test("KingBase native tar.zst packages are preferred over raw release executables", () => {
  const entries = buildNativeAgentEntries([
    {
      name: "gauss-horizon-agent-kingbase-windows-x64.exe",
      browser_download_url: "https://example.com/gauss-horizon-agent-kingbase-windows-x64.exe",
      size: 1024,
    },
    {
      name: "gauss-horizon-agent-kingbase-0.1.34-windows-x64.exe",
      browser_download_url: "https://example.com/gauss-horizon-agent-kingbase-0.1.34-windows-x64.exe",
      size: 2048,
    },
    {
      name: "gauss-horizon-agent-kingbase-0.1.34-windows-x64.tar.zst",
      browser_download_url: "https://example.com/gauss-horizon-agent-kingbase-0.1.34-windows-x64.tar.zst",
      size: 4096,
    },
    {
      name: "gauss-horizon-agent-kingbase-0.1.34-linux-x64.tar.zst",
      browser_download_url: "https://example.com/gauss-horizon-agent-kingbase-0.1.34-linux-x64.tar.zst",
      size: 3072,
    },
  ]);

  assert.deepEqual(
    entries.map(({ key, version, platformKey, filename }) => ({ key, version, platformKey, filename })),
    [
      {
        key: "kingbase",
        version: "0.1.34",
        platformKey: "linux-x64",
        filename: "gauss-horizon-agent-kingbase-0.1.34-linux-x64.tar.zst",
      },
      {
        key: "kingbase",
        version: "0.1.34",
        platformKey: "windows-x64",
        filename: "gauss-horizon-agent-kingbase-0.1.34-windows-x64.tar.zst",
      },
    ],
  );
});

test("DuckDB native tar.zst packages appear in the native catalog", () => {
  const entries = buildNativeAgentEntries([
    {
      name: "gauss-horizon-agent-duckdb-0.1.0-macos-aarch64.tar.zst",
      browser_download_url: "https://example.com/gauss-horizon-agent-duckdb-0.1.0-macos-aarch64.tar.zst",
      size: 4096,
    },
  ]);

  assert.deepEqual(
    entries.map(({ key, platformKey, filename }) => ({ key, platformKey, filename })),
    [
      {
        key: "duckdb",
        platformKey: "macos-aarch64",
        filename: "gauss-horizon-agent-duckdb-0.1.0-macos-aarch64.tar.zst",
      },
    ],
  );
});

test("RabbitMQ native tar.zst packages appear in the native catalog", () => {
  const entries = buildNativeAgentEntries([
    {
      name: "gauss-horizon-agent-rabbitmq-0.1.1-windows-x64.tar.zst",
      browser_download_url: "https://example.com/gauss-horizon-agent-rabbitmq-0.1.1-windows-x64.tar.zst",
      size: 4096,
    },
  ]);

  assert.deepEqual(
    entries.map(({ key, platformKey, filename }) => ({ key, platformKey, filename })),
    [
      {
        key: "rabbitmq",
        platformKey: "windows-x64",
        filename: "gauss-horizon-agent-rabbitmq-0.1.1-windows-x64.tar.zst",
      },
    ],
  );
  assert.equal(entries[0]?.label, "RabbitMQ");
});

test("all current native-only agent packages appear in the native catalog", () => {
  const nativeKeys = ["cassandra", "duckdb", "hive", "iotdb", "kingbase", "neo4j", "oracle", "rabbitmq", "rocketmq", "tdengine", "vastbase", "xugu", "zookeeper"];
  const entries = buildNativeAgentEntries(
    nativeKeys.map((key) => ({
      name: `gauss-horizon-agent-${key}-${driverVersions[key as keyof typeof driverVersions]}-macos-aarch64.tar.zst`,
      browser_download_url: `https://example.com/gauss-horizon-agent-${key}-macos-aarch64.tar.zst`,
      size: 4096,
    })),
  );

  assert.deepEqual(entries.map(({ key }) => key).sort(), nativeKeys);
  assert.equal(entries.find(({ key }) => key === "cassandra")?.label, "Apache Cassandra");
  assert.equal(entries.find(({ key }) => key === "hive")?.label, "Apache Hive");
  assert.equal(entries.find(({ key }) => key === "rocketmq")?.label, "Apache RocketMQ");
  assert.equal(entries.find(({ key }) => key === "zookeeper")?.label, "Apache ZooKeeper");
});
