import { describe, expect, it } from "vitest";

import { chordKeys, isValidChord, matchesChord, platformOf, type Platform } from "./chord";
import type { KeyStroke } from "./stroke";

function stroke(key: string, extra: Partial<KeyStroke> = {}): KeyStroke {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra };
}

describe("matching a stroke against a chord", () => {
  it.each<[string, KeyStroke, string, Platform, boolean]>([
    ["a plain letter", stroke("j"), "j", "other", true],
    ["a letter with caps lock on", stroke("J"), "j", "other", true],
    ["a letter typed with Shift is a different chord", stroke("J", { shiftKey: true }), "j", "other", false],
    ["a letter held with Ctrl is not the bare letter", stroke("j", { ctrlKey: true }), "j", "other", false],
    ["Ctrl+K outside a Mac", stroke("k", { ctrlKey: true }), "Mod+K", "other", true],
    ["Cmd+K on a Mac", stroke("k", { metaKey: true }), "Mod+K", "mac", true],
    ["Ctrl+K on a Mac belongs to the system, not to Mod", stroke("k", { ctrlKey: true }), "Mod+K", "mac", false],
    ["the Windows key is not Mod outside a Mac", stroke("k", { metaKey: true }), "Mod+K", "other", false],
    ["Mod+Shift+X with both modifiers", stroke("X", { ctrlKey: true, shiftKey: true }), "Mod+Shift+X", "other", true],
    ["Mod+Shift+X without Shift", stroke("x", { ctrlKey: true }), "Mod+Shift+X", "other", false],
    ["Alt changes the chord", stroke("k", { ctrlKey: true, altKey: true }), "Mod+K", "other", false],
    ["a question mark, whatever Shift the layout needs", stroke("?", { shiftKey: true }), "?", "other", true],
    ["a slash", stroke("/"), "/", "other", true],
    ["a named key", stroke("ArrowDown"), "ArrowDown", "other", true],
    ["a named key with Shift is another chord", stroke("Enter", { shiftKey: true }), "Enter", "other", false],
    ["Ctrl+B on a Cyrillic layout reads the physical key", stroke("и", { ctrlKey: true, code: "KeyB" }), "Mod+B", "other", true],
    ["a Latin layout trusts the character, not the position", stroke("h", { code: "KeyJ" }), "j", "other", false],
  ])("%s", (_name, input, chord, platform, expected) => {
    expect(matchesChord(input, chord, platform)).toBe(expected);
  });
});

describe("reading the platform", () => {
  it("knows a Mac from its platform strings", () => {
    expect(platformOf({ platform: "MacIntel" })).toBe("mac");
    expect(platformOf({ userAgentData: { platform: "macOS" } })).toBe("mac");
    expect(platformOf({ platform: "iPad" })).toBe("mac");
  });

  it("treats everything else, and an unknown navigator, as Ctrl based", () => {
    expect(platformOf({ platform: "Win32" })).toBe("other");
    expect(platformOf({ platform: "Linux x86_64" })).toBe("other");
    expect(platformOf(undefined)).toBe("other");
  });
});

describe("showing a chord", () => {
  it("writes Mod as the platform's own key", () => {
    expect(chordKeys("Mod+K", "mac")).toEqual(["⌘", "K"]);
    expect(chordKeys("Mod+K", "other")).toEqual(["Ctrl", "K"]);
    expect(chordKeys("Mod+Shift+X", "mac")).toEqual(["⌘", "⇧", "X"]);
    expect(chordKeys("Mod+Shift+X", "other")).toEqual(["Ctrl", "Shift", "X"]);
  });

  it("draws arrows and keeps symbols as they are", () => {
    expect(chordKeys("ArrowDown", "other")).toEqual(["↓"]);
    expect(chordKeys("ArrowUp", "other")).toEqual(["↑"]);
    expect(chordKeys("?", "other")).toEqual(["?"]);
    expect(chordKeys("Enter", "other")).toEqual(["Enter"]);
  });
});

describe("validating a chord", () => {
  it("accepts modifiers before one key", () => {
    expect(isValidChord("Mod+Shift+X")).toBe(true);
    expect(isValidChord("j")).toBe(true);
    expect(isValidChord("ArrowDown")).toBe(true);
  });

  it("refuses empty keys, unknown modifiers and modifiers alone", () => {
    expect(isValidChord("")).toBe(false);
    expect(isValidChord("Hyper+K")).toBe(false);
    expect(isValidChord("Mod+")).toBe(false);
    expect(isValidChord("Mod+Shift")).toBe(false);
  });
});
