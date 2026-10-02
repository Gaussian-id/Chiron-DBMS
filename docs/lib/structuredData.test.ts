import assert from "node:assert/strict";
import { test } from "vitest";

import { buildDocStructuredData, buildSiteStructuredData, buildSoftwareApplicationStructuredData, serializeStructuredData } from "./structuredData";
import { SITE_URL } from "./metadata";

test("site structured data does not advertise a nonexistent search route", () => {
  const [website, organization] = buildSiteStructuredData();

  assert.equal(website["@type"], "WebSite");
  assert.equal("potentialAction" in website, false);
  assert.equal(organization["@id"], `${SITE_URL}/#organization`);
});

test("software structured data stays localized and versioned", () => {
  const english = buildSoftwareApplicationStructuredData("en", "0.1.3");

  assert.equal(english.applicationCategory, "DeveloperApplication");
  assert.equal(english.softwareVersion, "0.1.3");
  assert.equal(english.inLanguage, "en");
  assert.match(english.description, /Chiron Horizon desktop database workbench/);
  assert.equal(english.license, "https://github.com/Gaussian-id/Chiron-DBMS/blob/main/LICENSE");
});

test("documentation breadcrumbs use localized titles and real documentation roots", () => {
  const [breadcrumb, article] = buildDocStructuredData("en", "Getting started", "Connect a database", "/en/docs/getting-started");
  assert.equal(breadcrumb.itemListElement?.[0].name, "Home");
  assert.equal(breadcrumb.itemListElement?.[1].item, "https://github.com/Gaussian-id/Chiron-DBMS/en/docs/what-is-chiron-horizon");
  assert.equal(breadcrumb.itemListElement?.[2].name, "Getting started");
  assert.equal(article.mainEntityOfPage, "https://github.com/Gaussian-id/Chiron-DBMS/en/docs/getting-started");
  assert.equal(buildDocStructuredData("en", "Docs", "Documentation", "/en/docs/what-is-chiron-horizon")[0].itemListElement?.length, 2);
});

test("JSON-LD cannot break out of its script element", () => {
  const value = { headline: '</script><script>alert("injected")</script>' };
  const serialized = serializeStructuredData(value);
  assert.equal(serialized.includes("<"), false);
  assert.deepEqual(JSON.parse(serialized), value);
});
