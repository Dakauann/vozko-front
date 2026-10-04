import { describe, expect, it } from "vitest";

import { STORY_SAFE_ZONE, clipText, safeZoneInsets } from "./preview-spec";

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
});

describe("safeZoneInsets", () => {
  it("turns Meta's story safe zone into CSS insets", () => {
    expect(safeZoneInsets(STORY_SAFE_ZONE)).toEqual({ top: "14%", bottom: "35%", left: "6%", right: "6%" });
  });
});
