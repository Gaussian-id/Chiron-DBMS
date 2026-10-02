import assert from "node:assert/strict";
import { test } from "vitest";
import { documentMarkdown, llmsIndex, markdownPath } from "./llms";

test("Markdown endpoints preserve locale and normalize documentation roots", () => {
  assert.equal(markdownPath("/cn/docs/"), "/cn/markdown/index.md");
  assert.equal(markdownPath("/en/docs/mcp"), "/en/markdown/mcp.md");
});

test("document text preserves exact source provenance and code blocks", async () => {
  const body = "## Example\n\n```sql\nSELECT 1;\n```";
  const output = await documentMarkdown({ url: "/en/docs/mcp", data: { title: "MCP integration", description: "Controlled access", getText: async () => body } });
  assert.ok(output.startsWith("# MCP integration\n"));
  assert.ok(output.includes("Source: https://github.com/Gaussian-id/Chiron-DBMS/en/docs/mcp\n"));
  assert.ok(output.includes("Language: en"));
  assert.ok(output.includes(body));
});

test("LLM index includes only English documentation without mutating page order", () => {
  const pages = [
    { url: "/en/docs/mcp", data: { title: "MCP", description: "Tools", getText: async () => "" } },
    { url: "/en/docs/mcp", data: { title: "MCP integration", description: "工具", getText: async () => "" } },
  ];
  const output = llmsIndex(pages);
  assert.ok(output.includes("https://github.com/Gaussian-id/Chiron-DBMS/en/markdown/mcp.md"));
  assert.ok(!output.includes("/cn/markdown/"));
  assert.ok(output.includes("Apache-2.0"));
  assert.equal(pages[0].url, "/en/docs/mcp");
});
