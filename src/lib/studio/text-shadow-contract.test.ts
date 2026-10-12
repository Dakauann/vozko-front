import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_SHADOW, HEAVY_TEXT_SHADOW, isHeavyTextShadow, TEXT_SHADOW, textShadowFor } from "./layer-effects";

describe("the shadow values shared with the server", () => {
  const fixture = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_text_shadow.json"), "utf8"));

  it("uses the same default shadow, text shadow guide and heavy shadow limits", () => {
    expect(DEFAULT_SHADOW).toEqual(fixture.defaultShadow);
    expect(TEXT_SHADOW).toEqual(fixture.textShadow);
    expect(HEAVY_TEXT_SHADOW).toEqual(fixture.heavyTextShadow);
  });

  it("scales the suggested text shadow with the letter", () => {
    expect(textShadowFor(100)).toEqual({ color: TEXT_SHADOW.color, blur: 20, x: 0, y: 6 });
    expect(textShadowFor(10).y).toBe(1);
  });

  it("calls a shadow heavy only when it is nearly opaque and too blurred or too far", () => {
    expect(isHeavyTextShadow(textShadowFor(100), 100)).toBe(false);
    expect(isHeavyTextShadow({ color: "#000000", blur: 40, x: 0, y: 4 }, 100)).toBe(true);
    expect(isHeavyTextShadow({ color: "#000000", blur: 4, x: 0, y: 14 }, 100)).toBe(true);
    expect(isHeavyTextShadow({ color: "#00000080", blur: 40, x: 0, y: 14 }, 100)).toBe(false);
    expect(isHeavyTextShadow({ color: "#000000", blur: 20, x: 0, y: 6 }, 100)).toBe(false);
  });
});
