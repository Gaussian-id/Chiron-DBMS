import assert from "node:assert/strict";
import { test } from "vitest";
import { buildMetadata, DEFAULT_OG_IMAGE } from "./metadata";

test("metadata normalizes canonicals and uses matching BCP 47 alternates", () => {
  const metadata = buildMetadata({ title: "文档", description: "说明", path: "/en/docs/?ref=test#intro", lang: "en", markdownPath: "/en/markdown/index.md" });
  assert.equal(metadata.alternates?.canonical, "https://github.com/Gaussian-id/Chiron-DBMS/en/docs");
  assert.deepEqual(metadata.alternates?.languages, { en: "https://github.com/Gaussian-id/Chiron-DBMS/en/docs", "x-default": "https://github.com/Gaussian-id/Chiron-DBMS/en/docs" });
  assert.deepEqual(metadata.alternates?.types, { "text/markdown": "https://github.com/Gaussian-id/Chiron-DBMS/en/markdown/index.md" });
  assert.equal(metadata.openGraph?.url, metadata.alternates?.canonical);
});

test("locale replacement respects complete route segments", () => {
  const metadata = buildMetadata({ title: "English", description: "Description", path: "/english", lang: "en" });
  assert.equal(metadata.alternates?.languages?.["en"], "https://github.com/Gaussian-id/Chiron-DBMS/english");
});

test("default social cards use the Horizon logo", () => {
  const metadata = buildMetadata({ title: "Chiron Horizon", description: "Database client", path: "/en", lang: "en" });
  assert.deepEqual(metadata.openGraph?.images, [{ url: DEFAULT_OG_IMAGE, width: 1792, height: 896 }]);
  assert.deepEqual(metadata.twitter?.images, [DEFAULT_OG_IMAGE]);
});
