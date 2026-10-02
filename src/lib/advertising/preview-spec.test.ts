import { describe, expect, it } from "vitest";

import { STORY_SAFE_ZONE, TEXT_LIMITS, clipText, safeZoneInsets, textLimitSet } from "./preview-spec";

describe("clipText", () => {
  it("keeps text within the limit untouched", () => {
    expect(clipText("  Promoção de inverno  ", 125)).toEqual({ text: "Promoção de inverno", clipped: false });
    expect(clipText(undefined, 10)).toEqual({ text: "", clipped: false });
  });

  it("cuts at the last whole word and drops trailing punctuation", () => {
    expect(clipText("Fale com a gente hoje, pelo WhatsApp", 24)).toEqual({ text: "Fale com a gente hoje", clipped: true });
  });

  it("cuts mid word when the last space is too early", () => {
    expect(clipText("Supercalifragilisticexpialidocious", 10)).toEqual({ text: "Supercalif", clipped: true });
  });

  it("matches Meta's feed truncation of primary text", () => {
    const long = "a ".repeat(100);
    const clipped = clipText(long, TEXT_LIMITS.feed.primaryText);
    expect(clipped.clipped).toBe(true);
    expect(clipped.text.length).toBeLessThanOrEqual(125);
  });
});

describe("textLimitSet", () => {
  it("picks carousel limits only in the feed", () => {
    expect(textLimitSet("feed", "CAROUSEL")).toBe("carousel");
    expect(textLimitSet("feed", "IMAGE")).toBe("feed");
    expect(textLimitSet("story", "CAROUSEL")).toBe("story");
  });
});

describe("safeZoneInsets", () => {
  it("turns Meta's story safe zone into CSS insets", () => {
    expect(safeZoneInsets(STORY_SAFE_ZONE)).toEqual({ top: "14%", bottom: "35%", left: "6%", right: "6%" });
  });
});
