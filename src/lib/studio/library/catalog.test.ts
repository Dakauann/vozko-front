import { describe, expect, it } from "vitest";

import { closestIds, idWords, itemLabelKey, labelText, libraryLocale, matchRank, parseRecent, RECENT_LIMIT, searchEntries, searchTerms, withRecent, type LibraryEntry } from "./catalog";
import { OWN_SOURCE, type LibraryItem } from "./model";

function item(id: string, extra: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id,
    category: "shapes",
    editors: ["image", "video"],
    ratio: 1,
    label: { key: `items.${id}` },
    preview: { kind: "svg", markup: "<svg/>" },
    source: OWN_SOURCE,
    template: { kind: "layers", build: () => ({ layers: [] }) },
    ...extra,
  };
}

function entry(id: string, name: string, extra: Partial<LibraryItem> = {}): LibraryEntry {
  return { item: item(id, extra), name };
}

describe("library search", () => {
  const entries = [entry("shape-star", "Estrela"), entry("shape-heart", "Coração"), entry("icon-star", "Estrela"), entry("shape-double-arrow", "Seta dupla"), entry("shape-arrow", "Seta")];

  it("folds accents and case and needs every word", () => {
    expect(searchEntries(entries, "CORACAO", "pt").map((e) => e.item.id)).toEqual(["shape-heart"]);
    expect(searchEntries(entries, "seta dupla", "pt").map((e) => e.item.id)).toEqual(["shape-double-arrow"]);
    expect(searchEntries(entries, "   ", "pt")).toEqual([]);
  });

  it("ranks the exact name first, then a name prefix, then other words", () => {
    expect(searchEntries(entries, "seta", "pt").map((e) => e.item.id)).toEqual(["shape-arrow", "shape-double-arrow"]);
    expect(matchRank("estrela", "Estrela", ["Estrela", "star"])).toBe(0);
    expect(matchRank("estr", "Estrela", ["Estrela", "star"])).toBe(1);
    expect(matchRank("star", "Estrela", ["Estrela", "star"])).toBe(2);
    expect(matchRank("lua", "Estrela", ["Estrela", "star"])).toBeNull();
  });

  it("matches English words from the id and the English tags too", () => {
    expect(searchEntries(entries, "heart", "pt").map((e) => e.item.id)).toEqual(["shape-heart"]);
    const tagged = entry("emoji-fire", "Fogo", { tags: { pt: ["chama"], en: ["flame", "hot"] } });
    expect(searchEntries([tagged], "chama", "pt")).toHaveLength(1);
    expect(searchEntries([tagged], "flame", "pt")).toHaveLength(1);
    expect(searchTerms(tagged.item, tagged.name, "en")).toEqual(["Fogo", "flame", "hot", "emoji", "fire"]);
  });

  it("reads inline names in the English locale when the label carries its own text", () => {
    const own = item("emoji-sun", { label: { text: { pt: "Sol", en: "Sun", es: "Sol", de: "Sonne" } } });
    expect(searchEntries([{ item: own, name: "Sol" }], "sun", "pt")).toHaveLength(1);
    expect(labelText(own.label, () => "never", "de")).toBe("Sonne");
    expect(labelText({ key: "a.b" }, (key) => `t:${key}`, "pt")).toBe("t:a.b");
  });
});

describe("library ids and locales", () => {
  it("splits ids into words", () => {
    expect(idWords("shape-doubleArrow")).toEqual(["shape", "double", "arrow"]);
    expect(idWords("icon-thumbs-up")).toEqual(["icon", "thumbs", "up"]);
  });

  it("derives the message key of an item name from its id", () => {
    expect(itemLabelKey("table-striped")).toBe("studio.library.items.tableStriped");
    expect(itemLabelKey("component-kpi-card-light")).toBe("studio.library.items.componentKpiCardLight");
  });

  it("maps any app locale onto a library locale", () => {
    expect(libraryLocale("pt-BR")).toBe("pt");
    expect(libraryLocale("en_US")).toBe("en");
    expect(libraryLocale("DE")).toBe("de");
    expect(libraryLocale("fr")).toBe("pt");
  });

  it("suggests the nearest ids, contained ones first", () => {
    const ids = ["shape-heart", "shape-star", "icon-heart", "control-null"];
    expect(closestIds("shape-hart", ids, 2)).toEqual(["shape-heart", "shape-star"]);
    expect(closestIds("heart", ids, 2)).toEqual(["shape-heart", "icon-heart"]);
  });
});

describe("recent items", () => {
  it("keeps the newest first without repeats, up to the limit", () => {
    let ids: string[] = [];
    for (let i = 0; i < RECENT_LIMIT + 3; i++) ids = withRecent(ids, `shape-${i}`);
    expect(ids).toHaveLength(RECENT_LIMIT);
    expect(ids[0]).toBe(`shape-${RECENT_LIMIT + 2}`);
    expect(withRecent(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("reads stored lists defensively", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("{")).toEqual([]);
    expect(parseRecent(JSON.stringify({ ids: [] }))).toEqual([]);
    expect(parseRecent(JSON.stringify(["shape-star", 3, "Bad Id", "shape-star", "icon-sun"]))).toEqual(["shape-star", "icon-sun"]);
  });
});
