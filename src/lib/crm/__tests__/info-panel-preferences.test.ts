import { describe, expect, it } from "vitest";

import {
  DEFAULT_INFO_PANEL,
  infoPanelPreferencesKey,
  parseInfoPanelPreferences,
  readInfoPanelPreferences,
  writeInfoPanelPreferences,
} from "../info-panel-preferences";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
};

describe("info panel preferences per viewer", () => {
  it("keys the preference by the signed in viewer, and has no key without one", () => {
    expect(infoPanelPreferencesKey("user-1")).toBe("crm.infoPanel.user-1");
    expect(infoPanelPreferencesKey(null)).toBeNull();
  });

  it("reads back what was written", () => {
    const storage = memoryStorage();
    writeInfoPanelPreferences(storage, "k", { open: true, tab: "insights" });
    expect(readInfoPanelPreferences(storage, "k")).toEqual({ open: true, tab: "insights" });
  });

  it("starts closed on the contact tab when nothing was stored", () => {
    expect(readInfoPanelPreferences(memoryStorage(), "k")).toEqual(DEFAULT_INFO_PANEL);
    expect(DEFAULT_INFO_PANEL).toEqual({ open: false, tab: "contact" });
  });

  it("refuses broken or unknown stored values field by field", () => {
    expect(parseInfoPanelPreferences("not json")).toEqual(DEFAULT_INFO_PANEL);
    expect(parseInfoPanelPreferences(JSON.stringify({ open: "yes", tab: "secrets" }))).toEqual(DEFAULT_INFO_PANEL);
    expect(parseInfoPanelPreferences(JSON.stringify({ open: true, tab: "secrets" }))).toEqual({ open: true, tab: "contact" });
  });

  it("survives a browser that blocks storage, both reading and writing", () => {
    expect(readInfoPanelPreferences(throwing, "k")).toEqual(DEFAULT_INFO_PANEL);
    expect(() => writeInfoPanelPreferences(throwing, "k", { open: true, tab: "contact" })).not.toThrow();
    expect(readInfoPanelPreferences(null, "k")).toEqual(DEFAULT_INFO_PANEL);
  });
});
