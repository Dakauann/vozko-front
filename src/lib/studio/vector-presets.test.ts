import { describe, expect, it } from "vitest";

import { emptyArtboard } from "./document";
import { surfaceIssue } from "./validate";
import { isVectorPreset, VECTOR_PRESET_IDS, VECTOR_PRESETS, vectorPresetLayer } from "./vector-presets";
import { isValidPath } from "./vector-path";

const canvas = { width: 1080, height: 1350 };

describe("vector presets", () => {
  it("are all valid shapes the backend accepts", () => {
    const doc = { ...emptyArtboard(canvas), layers: VECTOR_PRESET_IDS.map((id) => vectorPresetLayer(id, canvas)) };
    expect(surfaceIssue(doc)).toBeNull();
    for (const id of VECTOR_PRESET_IDS) {
      const preset = VECTOR_PRESETS[id];
      if (preset.kind === "path") expect(isValidPath(preset.data), id).toBe(true);
    }
  });

  it("keep their proportions in canvas pixels", () => {
    const ribbon = vectorPresetLayer("ribbon", canvas, 0.5);
    const ratio = (ribbon.transform.w * canvas.width) / (ribbon.transform.h * canvas.height);
    expect(ratio).toBeCloseTo(VECTOR_PRESETS.ribbon.ratio);
    const heart = vectorPresetLayer("heart", canvas, 0.5);
    expect(heart.transform.w * canvas.width).toBeCloseTo(heart.transform.h * canvas.height);
  });

  it("draw open outlines as strokes and closed outlines as fills", () => {
    const squiggle = vectorPresetLayer("squiggle", canvas);
    expect(squiggle.fill).toBeUndefined();
    expect(squiggle.strokeWidth).toBeGreaterThan(0);
    const blob = vectorPresetLayer("blob", canvas);
    expect(blob.fill).toBeDefined();
    expect(blob.strokeWidth).toBeUndefined();
  });

  it("build stars for bursts and seals", () => {
    expect(vectorPresetLayer("burst", canvas)).toMatchObject({ shape: "star", points: 16 });
    expect(vectorPresetLayer("seal", canvas)).toMatchObject({ shape: "star", points: 24 });
  });

  it("know their own names", () => {
    expect(isVectorPreset("arch")).toBe(true);
    expect(isVectorPreset("toString")).toBe(false);
  });
});
