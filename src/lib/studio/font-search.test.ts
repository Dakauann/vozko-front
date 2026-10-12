import { describe, expect, it } from "vitest";

import { searchFonts } from "./font-search";
import { fontsIn, type FontCategory } from "./fonts";

const NAMES: Record<FontCategory, string> = { sans: "Sem serifa", serif: "Serifada", display: "Destaque", handwriting: "Manuscrita", mono: "Monoespaçada" };
const label = (category: FontCategory) => NAMES[category];

describe("searching fonts", () => {
  it("lists every family in category order when nothing is typed", () => {
    expect(searchFonts("", null, label)).toEqual((["sans", "serif", "display", "handwriting", "mono"] as const).flatMap(fontsIn));
  });

  it("finds a family by its name, ignoring case and accents, with name starts first", () => {
    expect(searchFonts("PLAY", null, label)[0]).toBe("playfair-display");
    expect(searchFonts("garamond", null, label)).toEqual(["eb-garamond", "cormorant-garamond"]);
  });

  it("finds families by the localized category name", () => {
    expect(searchFonts("manuscrita", null, label)).toEqual(fontsIn("handwriting"));
    expect(searchFonts("monoespacada", null, label)).toEqual(fontsIn("mono"));
  });

  it("keeps the search inside the chosen category", () => {
    expect(searchFonts("", "mono", label)).toEqual(fontsIn("mono"));
    expect(searchFonts("dm", "serif", label)).toEqual(["dm-serif-display"]);
    expect(searchFonts("dm", "mono", label)).toEqual(["dm-mono"]);
  });

  it("returns nothing for a name no family has", () => {
    expect(searchFonts("comic", null, label)).toEqual([]);
  });
});
