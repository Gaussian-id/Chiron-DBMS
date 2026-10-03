import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { goSumErrors } from "./dependency-checksums.mjs";

test("accepts the pinned Go dependency hashes without treating them as branding", () => {
  assert.deepEqual(goSumErrors(readFileSync("agents/drivers/cassandra-go/go.sum", "utf8")), []);
});

test("rejects modified, truncated, and noncanonical hashes with their line numbers", () => {
  const digest = Buffer.alloc(32, 1).toString("base64");
  const line = (hash) => `example.org/module v1.2.3 h1:${hash}`;
  assert.deepEqual(goSumErrors(line(digest)), []);
  for (const invalid of [
    digest.slice(0, 12) + "ChironHorizon" + digest.slice(15),
    digest.slice(0, 12) + "Chiron Horizon" + digest.slice(15),
    digest.slice(1),
    digest.slice(0, -2) + "F=",
  ]) {
    assert.deepEqual(goSumErrors(`${line(digest)}\r\n${line(invalid)}\r\n`), ["2: invalid dependency checksum"]);
  }
  assert.deepEqual(goSumErrors("missing checksum"), ["1: invalid dependency checksum"]);
});
