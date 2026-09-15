import { describe, expect, it } from "vitest";

import { buildTableSelectTemplate } from "@/lib/table/tableSqlTemplates";

describe("buildTableSelectTemplate", () => {
  it("can omit identifier quotes for a new-query table reference", () => {
    expect(
      buildTableSelectTemplate({
        databaseType: "postgres",
        schema: "public",
        tableName: "gauss_horizon_smoke",
        quoteIdentifiers: false,
      }),
    ).toBe("SELECT *\nFROM public.gauss_horizon_smoke;");
  });
});
