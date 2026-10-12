import { describe, expect, it } from "vitest";

import { activeGroup, isInspectorGroup, matchesSearch, MAX_REMEMBERED_SECTIONS, parseOpenSections, presentGroups, rememberSection, searchText } from "./inspector-layout";

describe("inspector groups", () => {
  it("lists the groups that have sections in catalog order without repeats", () => {
    expect(presentGroups(["speed", "basic", "effects", "basic"])).toEqual(["basic", "effects", "speed"]);
    expect(presentGroups([])).toEqual([]);
  });

  it("keeps the preferred group when the selection has it and falls back to the first one otherwise", () => {
    expect(activeGroup(["basic", "effects"], "effects")).toBe("effects");
    expect(activeGroup(["basic", "speed"], "effects")).toBe("basic");
    expect(activeGroup(["basic"], null)).toBe("basic");
    expect(activeGroup([], "basic")).toBeNull();
  });

  it("recognizes only catalog ids", () => {
    expect(isInspectorGroup("cutout")).toBe(true);
    expect(isInspectorGroup("color")).toBe(true);
    expect(isInspectorGroup("audio")).toBe(false);
    expect(isInspectorGroup(3)).toBe(false);
  });
});

describe("remembered sections", () => {
  it("reads only boolean entries and ignores anything malformed", () => {
    expect(parseOpenSections('{"timing":false,"frame":true,"bad":"yes"}')).toEqual({ timing: false, frame: true });
    expect(parseOpenSections("not json")).toEqual({});
    expect(parseOpenSections("[true]")).toEqual({});
    expect(parseOpenSections(null)).toEqual({});
  });

  it("records the newest choice last and forgets the oldest past the cap", () => {
    let open: Record<string, boolean> = {};
    for (let index = 0; index <= MAX_REMEMBERED_SECTIONS; index += 1) open = rememberSection(open, `section-${index}`, false);
    expect(Object.keys(open)).toHaveLength(MAX_REMEMBERED_SECTIONS);
    expect(open["section-0"]).toBeUndefined();
    const moved = rememberSection(open, "section-1", true);
    expect(Object.keys(moved).at(-1)).toBe("section-1");
    expect(moved["section-1"]).toBe(true);
  });
});

describe("property search", () => {
  it("ignores case, accents and surrounding space", () => {
    expect(searchText("  Rotação ")).toBe("rotacao");
    expect(matchesSearch("rotacao", ["Posição X", "Rotação"])).toBe(true);
    expect(matchesSearch("ÓPACI", ["Opacidade"])).toBe(true);
  });

  it("matches nothing for a query that no label contains and everything for an empty one", () => {
    expect(matchesSearch("volume", ["Posição X", "Rotação"])).toBe(false);
    expect(matchesSearch("   ", ["Rotação"])).toBe(true);
  });
});
