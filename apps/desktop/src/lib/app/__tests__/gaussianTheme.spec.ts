import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_THEME_PALETTES, normalizeAppThemeMode, normalizeAppThemePalette, wcagContrastRatio } from "../appTheme";
import { DEFAULT_UI_FONT_FAMILY, DEFAULT_DATA_GRID_FONT_FAMILY } from "../appFonts";
import { resolveDataGridPaintTheme } from "@/lib/dataGrid/dataGridPaintTheme";

describe("Gaussian workbench theme", () => {
  it("uses semantic surfaces for dark canvas rows and gutters", () => {
    const variables: Record<string, string> = {
      "--data-grid-semantic-surfaces": "1",
      "--muted": "#101a30",
      "--accent": "#122244",
      "--data-grid-row-muted-bg": "var(--muted)",
      "--data-grid-row-number-default-bg": "var(--muted)",
      "--data-grid-cell-active-bg": "var(--accent)",
      "--data-grid-row-number-active-bg": "var(--accent)",
    };
    const theme = resolveDataGridPaintTheme({ isDark: true, getVar: (name) => variables[name] ?? "" });
    expect(theme.rowMuted).toBe("rgb(16, 26, 48)");
    expect(theme.rowNumberDefault).toBe("rgb(16, 26, 48)");
    expect(theme.cellActive).toBe("rgb(18, 34, 68)");
    expect(theme.rowNumberActive).toBe("rgb(18, 34, 68)");
  });
  it("defaults new installations to Gaussian/light and preserves saved preferences", () => {
    expect(normalizeAppThemePalette(null)).toBe("gaussian");
    expect(normalizeAppThemeMode(null)).toBe("light");
    for (const palette of APP_THEME_PALETTES) expect(normalizeAppThemePalette(palette.value)).toBe(palette.value);
    expect(normalizeAppThemeMode("system")).toBe("system");
    expect(normalizeAppThemeMode("dark")).toBe("dark");
    expect(DEFAULT_UI_FONT_FAMILY).toMatch(/^"Poppins"/);
    expect(DEFAULT_DATA_GRID_FONT_FAMILY).not.toContain("Poppins");
  });
  it("keeps text readable on both primary colors and interaction surfaces", () => {
    for (const [background, foreground] of [
      ["#1456c7", "#ffffff"],
      ["#2e7bff", "#070b16"],
      ["#eef3ff", "#0b1220"],
      ["#122244", "#e6ecf7"],
      ["#fafbff", "#5b6472"],
      ["#070b16", "#93a1bc"],
      ["#f9e9eb", "#c72b36"],
      ["#e8f7f0", "#047857"],
    ]) {
      expect(wcagContrastRatio(background!, foreground!)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("provides DOM and canvas colors without overwriting corner preferences", () => {
    const css = readFileSync(new URL("../../../styles/gaussian.css", import.meta.url), "utf8");
    expect(css).toContain("html.theme-gaussian.dark");
    expect(css).toContain("--gauss-horizon-primary-rgb: 46, 123, 255");
    expect(css).toContain("--gauss-horizon-content: #070b16");
    expect(css).toContain("html.theme-gaussian[data-corner-style='large']");
    expect(css).not.toContain("data-corner-style='none'");
  });
});
