import { expect, it } from "vitest";
import { chironResponseText } from "../chironResponseText";

it("presents concise narrative as plain text with paragraph and list line breaks", () => {
  expect(chironResponseText("## Next step\n\nChoose **one** collection.\n\n- `point_id` is required\n- Supply a vector\n\n[Details](https://example.com)")).toBe("Next step\n\nChoose one collection.\n\npoint_id is required\nSupply a vector\n\nDetails");
});
it("keeps literal identifiers and code contents unchanged", () => {
  expect(chironResponseText("Use gaussdb_paper.\n\n```text\na_b < 10\n```")).toBe("Use gaussdb_paper.\n\na_b < 10");
  expect(chironResponseText()).toBe("");
});
it("converts legacy Markdown tables without rendering HTML", () => {
  expect(chironResponseText("| Name | Dim |\n| --- | --- |\n| demo | 3 |")).toBe("Name · Dim\ndemo · 3");
  expect(chironResponseText('<script>alert("no")</script>')).toContain("<script>");
});
