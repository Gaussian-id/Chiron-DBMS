import { describe, expect, it, vi } from "vitest";
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/composables/useToast", () => ({ useToast: () => ({ toast }) }));
import { relationalComingSoon, relationalComingSoonPanel } from "../relationalComingSoon";

describe("relational tools Coming Soon gate", () => {
  it.each(["mysql", "postgres", "sqlite", "duckdb", "oracle", "sqlserver", "snowflake", "databricks", "spanner", "jdbc", "mariadb", "cockroachdb", "dm", "questdb", "kwdb"])("defers relational engine or profile %s", (type) => {
    expect(relationalComingSoon(type)).toBe(true);
  });
  it.each(["chirondb", "mongodb", "redis", "qdrant", "neo4j", "mqtt", "mq", "elasticsearch", "manticoresearch", undefined])("preserves native non-relational engine %s", (type) => {
    expect(relationalComingSoon(type)).toBe(false);
  });
  it("cannot be opened through a shortcut, restored state, or direct assignment", () => {
    const panel = relationalComingSoonPanel();
    expect(panel.value).toBe(false);
    panel.value = true;
    expect(panel.value).toBe(false);
    expect(toast).toHaveBeenCalledWith("Relational database tools · Coming Soon");
    panel.value = false;
    expect(panel.value).toBe(false);
  });
});
