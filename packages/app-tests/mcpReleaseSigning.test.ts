import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { copyFileSync, readdirSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { afterEach, test } from "vitest";
import { mcpIdentifier, mcpRequirement, signMcp, verifyMcp } from "../../.github/scripts/sign-mcp-macos.mjs";

test("Horizon release keeps standalone npm and Homebrew publication disabled", () => {
  const workflow = parse(readFileSync(".github/workflows/release.yml", "utf8"));
  assert.deepEqual(workflow.on.push.tags, ["v*"]);
  assert.equal(existsSync(".github/workflows/mcp-release.yml"), false);
  assert.doesNotMatch(JSON.stringify(workflow), /npm publish|publish-homebrew-formula/);
});

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture(config = {}) {
  const root = mkdtempSync(join(tmpdir(), "mcp-signing-test-"));
  roots.push(root);
  const binary = join(root, "chiron-horizon-mcp");
  writeFileSync(binary, "first build");
  const state = join(root, "state.json");
  const log = join(root, "commands.jsonl");
  const settings = join(root, "config.json");
  const original = ["/Users/runner/Library/Keychains/login.keychain-db", "/a keychain/custom.keychain-db"];
  writeFileSync(state, JSON.stringify(original));
  writeFileSync(settings, JSON.stringify(config));
  const source = `#!${process.execPath}
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const args = process.argv.slice(2);
const security = process.argv[1].endsWith('/security');
const config = JSON.parse(readFileSync(${JSON.stringify(settings)}, 'utf8'));
const state = ${JSON.stringify(state)};
const op = security ? args[0] : args.includes('--sign') ? 'sign' : args[0];
if (config.diagnostic && config.fail === op) console.error(config.diagnostic);
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ tool: security ? 'security' : 'codesign', args }) + '\\n');
if (config.pause === op) await new Promise(resolve => setTimeout(resolve, 10000));
const keychain = args.at(-1);
if (security && op === 'create-keychain') {
  writeFileSync(keychain, 'temporary keychain');
  writeFileSync(state, JSON.stringify([...JSON.parse(readFileSync(state)), keychain]));
}
if (config.fail === op || (config.fail === 'restore' && op === 'list-keychains' && args.includes('-s') && !args[4]?.includes('chiron-horizon-mcp-signing-'))) process.exit(19);
if (security) {
  if (op === 'list-keychains') {
    if (args.includes('-s')) writeFileSync(state, JSON.stringify(args.slice(4)));
    else console.log(JSON.parse(readFileSync(state)).map(keychain => JSON.stringify(keychain)).join('\\n'));
  }
  if (op === 'find-identity') console.log(config.identities ?? '  1) AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA "Developer ID Application: Chiron Horizon (ABCDE12345)"');
  if (op === 'delete-keychain') rmSync(keychain);
} else {
  const binary = args.at(-1);
  const marker = '\\nFAKE_SIGNATURE=';
  const text = readFileSync(binary, 'utf8');
  const payload = text.split(marker)[0];
  const hash = createHash('sha256').update(payload).digest('hex');
  if (op === 'sign') {
    const metadata = { hash, requirement: args[args.indexOf('--requirements') + 1].replace('=designated => ', ''), identifier: args[args.indexOf('--identifier') + 1], team: 'ABCDE12345' };
    writeFileSync(binary, payload + marker + JSON.stringify(metadata));
  } else {
    if (!text.includes(marker)) process.exit(20);
    const metadata = JSON.parse(text.split(marker)[1]);
    if (metadata.hash !== hash) process.exit(21);
    if (op === '--verify' && args[args.indexOf('-R') + 1] !== '=' + metadata.requirement) process.exit(22);
    if (op === '--display') {
      console.log('Identifier=' + (config.identifier ?? metadata.identifier));
      console.log('TeamIdentifier=' + (config.team ?? metadata.team));
      console.log(config.adhoc ? 'Signature=adhoc' : 'Signature size=1234');
      if (!config.noTimestamp) console.log('Timestamp=Oct 2, 2026 at 1:00:00 PM');
      console.log('designated => ' + (config.requirement ?? metadata.requirement.replaceAll(' exists', ' /* exists */')));
    }
  }
}
`;
  for (const tool of ["security", "codesign"]) writeFileSync(join(root, tool), source, { mode: 0o755 });
  const options = {
    platform: "darwin", security: join(root, "security"), codesign: join(root, "codesign"),
    env: { RUNNER_TEMP: root, APPLE_TEAM_ID: "ABCDE12345", APPLE_CERTIFICATE: Buffer.from("fixture certificate").toString("base64"),
      APPLE_CERTIFICATE_PASSWORD: "fixture password", APPLE_SIGNING_IDENTITY: "Developer ID Application: Chiron Horizon (ABCDE12345)" },
  };
  return {
    root, binary, options, original,
    configure: (value) => writeFileSync(settings, JSON.stringify(value)),
    commands: () => existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [],
    cleaned: () => {
      assert.deepEqual(JSON.parse(readFileSync(state, "utf8")), original);
      assert.ok(!readdirSync(root).some((name) => name.startsWith("chiron-horizon-mcp-signing-")));
    },
  };
}

test("imports only into an isolated keychain, signs and verifies in order, then restores all keychains", async () => {
  const scenario = fixture();
  await signMcp(scenario.binary, scenario.options);
  scenario.cleaned();
  const commands = scenario.commands();
  assert.deepEqual(commands.map(({ tool, args }) => `${tool}:${args[0]}`), [
    "security:list-keychains", "security:create-keychain", "security:set-keychain-settings", "security:unlock-keychain",
    "security:import", "security:set-key-partition-list", "security:list-keychains", "security:find-identity",
    "codesign:--force", "codesign:--verify", "codesign:--display", "security:list-keychains", "security:delete-keychain",
  ]);
  const imported = commands.find(({ args }) => args[0] === "import").args;
  assert.ok(!imported.includes("-A"));
  assert.equal(imported[imported.indexOf("-T") + 1], "/usr/bin/codesign");
  const signing = commands.find(({ args }) => args.includes("--sign")).args;
  assert.equal(signing[signing.indexOf("--sign") + 1], "A".repeat(40));
  assert.equal(signing[signing.indexOf("--identifier") + 1], mcpIdentifier);
  assert.ok(signing.includes("--timestamp"));
  assert.ok(!signing.includes("--timestamp=none"));
  const verify = commands.find(({ args }) => args[0] === "--verify").args;
  assert.ok(verify.includes("--strict") && verify.includes("--all-architectures"));
  assert.equal(verify[verify.indexOf("-R") + 1], `=${mcpRequirement("ABCDE12345")}`);
  assert.deepEqual(commands.at(-2).args.slice(4), scenario.original);
  assert.match(commands.at(-1).args[1], /chiron-horizon-mcp-signing-.*\/signing.keychain-db$/);
});

test("distinct builds and renewed certificates keep the same signer-constrained requirement", async () => {
  const scenario = fixture();
  await signMcp(scenario.binary, scenario.options);
  const first = readFileSync(scenario.binary, "utf8");
  writeFileSync(scenario.binary, "second build");
  scenario.configure({ identities: `  1) ${"B".repeat(40)} "Developer ID Application: Chiron Horizon (ABCDE12345)"` });
  await signMcp(scenario.binary, scenario.options);
  assert.notEqual(readFileSync(scenario.binary, "utf8"), first);
  const signatures = scenario.commands().filter(({ args }) => args.includes("--sign")).map(({ args }) => args);
  assert.notEqual(signatures[0][2], signatures[1][2]);
  assert.equal(signatures[0][signatures[0].indexOf("--requirements") + 1], signatures[1][signatures[1].indexOf("--requirements") + 1]);
  assert.match(mcpRequirement("ABCDE12345"), /anchor apple generic/);
  assert.match(mcpRequirement("ABCDE12345"), /certificate leaf\[subject.OU\] = "ABCDE12345"/);
  assert.match(mcpRequirement("ABCDE12345"), /field.1.2.840.113635.100.6.1.13/);
  assert.doesNotMatch(mcpRequirement("ABCDE12345"), /cdhash|certificate leaf = H/);
  scenario.cleaned();
});

test("rejects unsupported hosts, missing credentials and malformed teams before keychain access", async () => {
  const scenario = fixture();
  await assert.rejects(signMcp(scenario.binary, { ...scenario.options, platform: "linux" }), /requires macOS/);
  await assert.rejects(verifyMcp(scenario.binary, { ...scenario.options, platform: "win32" }), /requires macOS/);
  for (const name of ["APPLE_TEAM_ID", "APPLE_CERTIFICATE", "APPLE_CERTIFICATE_PASSWORD", "APPLE_SIGNING_IDENTITY"]) {
    await assert.rejects(signMcp(scenario.binary, { ...scenario.options, env: { ...scenario.options.env, [name]: "" } }), /required/);
  }
  await assert.rejects(signMcp(scenario.binary, { ...scenario.options, env: { ...scenario.options.env, APPLE_TEAM_ID: 'x" or true' } }), /APPLE_TEAM_ID/);
  await assert.rejects(signMcp(scenario.binary, { ...scenario.options, env: { ...scenario.options.env, APPLE_CERTIFICATE: "invalid!" } }), /base64/);
  assert.deepEqual(scenario.commands(), []);
});

test.each(["create-keychain", "set-keychain-settings", "unlock-keychain", "import", "set-key-partition-list", "find-identity", "sign", "--verify", "--display"])("propagates %s failure and cleans up", async (fail) => {
  const scenario = fixture({ fail });
  await assert.rejects(signMcp(scenario.binary, scenario.options), /failed/);
  scenario.cleaned();
  assert.equal(scenario.commands().at(-1).args[0], "delete-keychain");
});

test.each([
  { identities: '  1) AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA "Developer ID Application: Chiron Horizon (OTHER12345)"' },
  { identities: '  1) AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA "Apple Development: Chiron Horizon (ABCDE12345)"' },
  { identities: "0 valid identities found" },
  { team: "OTHER12345" }, { identifier: "id.chiron.horizon" }, { adhoc: true }, { noTimestamp: true },
  { requirement: 'identifier "id.chiron.horizon.mcp"' }, { requirement: 'cdhash H"abcd"' },
])("rejects invalid signer or signature metadata: %j", async (config) => {
  const scenario = fixture(config);
  await assert.rejects(signMcp(scenario.binary, scenario.options), /identity|identifier|requirement/);
  scenario.cleaned();
});

test.each(["restore", "delete-keychain"])("cleanup failure at %s fails the release and still removes temporary material", async (fail) => {
  const scenario = fixture({ fail });
  await assert.rejects(signMcp(scenario.binary, scenario.options), /cleanup failed/);
  assert.ok(!readdirSync(scenario.root).some((name) => name.startsWith("chiron-horizon-mcp-signing-")));
  assert.equal(scenario.commands().at(-1).args[0], "delete-keychain");
});

test("signature survives package staging and tar repacking, while tampering and unsigned reruns fail", async () => {
  const scenario = fixture();
  await assert.rejects(verifyMcp(scenario.binary, scenario.options), /failed/);
  await signMcp(scenario.binary, scenario.options);
  const staged = join(scenario.root, "package", "bin");
  const unpacked = join(scenario.root, "unpacked");
  mkdirSync(staged, { recursive: true });
  mkdirSync(unpacked);
  copyFileSync(scenario.binary, join(staged, "chiron-horizon-mcp"));
  assert.equal(spawnSync("tar", ["-czf", join(scenario.root, "package.tgz"), "-C", scenario.root, "package"]).status, 0);
  assert.equal(spawnSync("tar", ["-xzf", join(scenario.root, "package.tgz"), "-C", unpacked]).status, 0);
  const binary = join(unpacked, "package", "bin", "chiron-horizon-mcp");
  assert.deepEqual(readFileSync(binary), readFileSync(scenario.binary));
  await verifyMcp(binary, scenario.options);
  writeFileSync(binary, readFileSync(binary, "utf8").replace("first build", "tampered build"));
  await assert.rejects(verifyMcp(binary, scenario.options), /failed/);
  scenario.cleaned();
});

test("interruption waits for the signing command to stop and restores the keychain search list", async () => {
  const scenario = fixture({ pause: "import" });
  const controller = new AbortController();
  const result = assert.rejects(signMcp(scenario.binary, { ...scenario.options, signal: controller.signal }), /failed/);
  const deadline = Date.now() + 20000;
  while (!scenario.commands().some(({ args }) => args[0] === "import") && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(scenario.commands().some(({ args }) => args[0] === "import"));
  controller.abort();
  await result;
  scenario.cleaned();
  assert.ok(!scenario.commands().some(({ args }) => args.includes("--sign")));
});

test("tool diagnostics and credential arguments are not exposed in signing errors", async () => {
  const scenario = fixture({ fail: "import", diagnostic: "sensitive mocked certificate error" });
  await assert.rejects(signMcp(scenario.binary, scenario.options), (error: Error) => {
    assert.equal(error.message, "security import failed.");
    assert.ok(!error.message.includes(scenario.options.env.APPLE_CERTIFICATE_PASSWORD));
    return true;
  });
  scenario.cleaned();
});
