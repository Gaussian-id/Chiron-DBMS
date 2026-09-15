import { describe, expect, it } from "vitest";
import { classifySqlRisk } from "@/lib/sql/sqlRisk";

describe("DynamoDB statement risk", () => {
  it("treats generated scan statements as reads", () => {
    expect(classifySqlRisk('Gauss Horizon DYNAMODB SCAN\ntable: "orders"\nlimit: 1000', { dialect: "dynamodb" }).risk).toBe("read");
    expect(classifySqlRisk('Gauss Horizon DYNAMODB QUERY / SCAN\ntable: "orders"\nfilter:\n{"status":"SHIPPED"}', { dialect: "dynamodb" }).risk).toBe("read");
  });

  it("treats generated item changes as writes", () => {
    for (const operation of ["INSERT ITEM", "PUT ITEM", "DELETE ITEM"]) {
      expect(classifySqlRisk(`Gauss Horizon DYNAMODB ${operation}\ntable: "orders"`, { dialect: "dynamodb" }).risk).toBe("write");
    }
  });

  it("keeps unknown DynamoDB operations unsafe", () => {
    expect(classifySqlRisk('Gauss Horizon DYNAMODB UNKNOWN\ntable: "orders"', { dialect: "dynamodb" }).risk).toBe("unknown");
  });
});
