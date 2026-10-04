import { describe, expect, it } from "vitest";

import { NEUTRAL_ROLE_THEME, PLATE_TILE_CLASS, ROLE_THEMES, roleTheme } from "./role-theme";

const BACKEND_PRESET_KEYS = ["operator", "supervisor", "manager", "sales", "analyst", "marketing", "automation", "finance"];

describe("roleTheme", () => {
  it("gives every backend preset its own plate and glyph", () => {
    for (const key of BACKEND_PRESET_KEYS) {
      const theme = roleTheme(key);
      expect(theme).not.toBe(NEUTRAL_ROLE_THEME);
      expect(theme.plate).not.toBe("plate-neutral");
      expect(PLATE_TILE_CLASS[theme.plate]).toBeTruthy();
    }
  });

  it("never reuses a glyph across presets", () => {
    const icons = Object.values(ROLE_THEMES).map((theme) => theme.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("falls back to the neutral plate for roles without a known preset", () => {
    expect(roleTheme(undefined)).toBe(NEUTRAL_ROLE_THEME);
    expect(roleTheme("")).toBe(NEUTRAL_ROLE_THEME);
    expect(roleTheme("astronaut")).toBe(NEUTRAL_ROLE_THEME);
    expect(roleTheme("toString")).toBe(NEUTRAL_ROLE_THEME);
    expect(NEUTRAL_ROLE_THEME.plate).toBe("plate-neutral");
  });
});
