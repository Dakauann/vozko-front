import { describe, expect, it } from "vitest";

import { canStart } from "./limits";
import { isSoundEffectLength, SOUND_EFFECT_MS } from "./sound-effects";

describe("sound effect length", () => {
  it("matches the bounds the server enforces", () => {
    expect(SOUND_EFFECT_MS.min).toBe(500);
    expect(SOUND_EFFECT_MS.max).toBe(22_000);
    expect(isSoundEffectLength(SOUND_EFFECT_MS.initial)).toBe(true);
  });

  it("accepts whole milliseconds inside the bounds only", () => {
    expect(isSoundEffectLength(500)).toBe(true);
    expect(isSoundEffectLength(22_000)).toBe(true);
    expect(isSoundEffectLength(499)).toBe(false);
    expect(isSoundEffectLength(22_001)).toBe(false);
    expect(isSoundEffectLength(1_200.5)).toBe(false);
    expect(isSoundEffectLength(Number.NaN)).toBe(false);
  });

  it("shares the AI generation lane", () => {
    expect(canStart("sfx", ["music", "voice"])).toBe(true);
    expect(canStart("sfx", ["music", "voice", "image"])).toBe(false);
    expect(canStart("sfx", ["captions", "denoise"])).toBe(true);
  });
});
