import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, newMediaClip, newOverlayClip, newTextLayer, type Layer, type VideoDocument } from "./document";
import { documentIssue } from "./validate";
import { changedGrade, COLOR_LOOKS, gradeFault, gradeImageData, gradeIssue, gradePixel, gradeSummary, gradeUniforms, isNeutralGrade, lookGrade, mergeGrade } from "./color-grade";

const luma = ([r, g, b]: readonly number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe("color grade", () => {
  it("leaves a pixel alone when every control is at zero", () => {
    expect(gradePixel([0.2, 0.5, 0.9], {})).toEqual([0.2, 0.5, 0.9]);
    expect(isNeutralGrade({ exposure: 0, saturation: 0 })).toBe(true);
    expect(isNeutralGrade({ exposure: 0.5 })).toBe(false);
  });

  it("measures exposure in stops of linear light", () => {
    const [r] = gradePixel([0.5, 0.5, 0.5], { exposure: 1 });
    const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    expect(linear(r)).toBeCloseTo(2 * linear(0.5), 4);
  });

  it("removes color at saturation -100 and warms with temperature without changing brightness much", () => {
    const [r, g, b] = gradePixel([0.8, 0.4, 0.2], { saturation: -100 });
    expect(r).toBeCloseTo(g, 6);
    expect(g).toBeCloseTo(b, 6);
    const warm = gradePixel([0.5, 0.5, 0.5], { temperature: 60 });
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(luma(warm)).toBeCloseTo(0.5, 1);
    const green = gradePixel([0.5, 0.5, 0.5], { tint: -60 });
    expect(green[1]).toBeGreaterThan(green[0]);
  });

  it("spreads tones with contrast and lifts dark tones more than light ones with shadows", () => {
    const dark = gradePixel([0.3, 0.3, 0.3], { contrast: 50 })[0];
    const light = gradePixel([0.7, 0.7, 0.7], { contrast: 50 })[0];
    expect(dark).toBeLessThan(0.3);
    expect(light).toBeGreaterThan(0.7);
    const liftDark = gradePixel([0.25, 0.25, 0.25], { shadows: 80 })[0] - 0.25;
    const liftLight = gradePixel([0.85, 0.85, 0.85], { shadows: 80 })[0] - 0.85;
    expect(liftDark).toBeGreaterThan(liftLight);
    expect(gradePixel([0, 0, 0], { blacks: 100 })[0]).toBeGreaterThan(0);
    expect(gradePixel([1, 1, 1], { whites: -100 })[0]).toBeLessThan(1);
  });

  it("boosts muted colors more than saturated ones with vibrance", () => {
    const spread = (rgb: readonly number[]) => Math.max(...rgb) - Math.min(...rgb);
    const muted = [0.5, 0.45, 0.4];
    const vivid = [0.9, 0.2, 0.1];
    const mutedGain = spread(gradePixel(muted, { vibrance: 60 })) / spread(muted);
    const vividGain = spread(gradePixel(vivid, { vibrance: 60 })) / spread(vivid);
    expect(mutedGain).toBeGreaterThan(vividGain);
  });

  it("expands a look at an intensity and merges edits field by field", () => {
    const full = lookGrade("warm", 1);
    const half = lookGrade("warm", 0.5);
    expect(COLOR_LOOKS.warm.temperature).toBeGreaterThan(0);
    expect(half.temperature).toBeCloseTo((full.temperature ?? 0) / 2, 6);
    expect(mergeGrade({ exposure: 1, saturation: 20 }, { saturation: 0, contrast: 10 })).toEqual({ exposure: 1, contrast: 10 });
  });

  it("checks every control against its range", () => {
    expect(gradeIssue({ exposure: 1.5, contrast: -20 })).toBeNull();
    expect(gradeIssue({ exposure: 6 })).toBe("out_of_range");
    expect(gradeIssue({ saturation: 140 })).toBe("out_of_range");
    expect(gradeIssue({ tint: Number.NaN })).toBe("out_of_range");
  });
});

describe("color in documents", () => {
  function film(): VideoDocument {
    const d = emptyVideoDocument("square");
    d.tracks = [
      { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 1000), id: "c" }] },
      { id: "t", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 1000), id: "o" }] },
      { id: "a", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 1000), id: "s" }] },
    ];
    d.durationMs = 1000;
    return d;
  }

  it("grades video and image clips and image layers only", () => {
    const d = film();
    d.tracks[0].clips[0].color = { exposure: 0.5, saturation: 20 };
    expect(documentIssue("video", d)).toBeNull();
    for (const change of [(x: VideoDocument) => (x.tracks[1].clips[0].color = { exposure: 1 }), (x: VideoDocument) => (x.tracks[2].clips[0].color = { exposure: 1 })]) {
      const bad = film();
      change(bad);
      expect(documentIssue("video", bad)).toEqual({ field: "document.tracks", code: "invalid" });
    }
    const range = film();
    range.tracks[0].clips[0].color = { exposure: 9 };
    expect(documentIssue("video", range)).toEqual({ field: "document.tracks", code: "out_of_range" });
  });

  it("grades image layers in image documents and refuses a graded text", () => {
    const picture: Layer = { id: "p", type: "image", assetId: "img", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }, color: { temperature: 30 } };
    const board = { ...emptyArtboard({ width: 1080, height: 1080 }), layers: [picture] };
    expect(documentIssue("image", { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [board] })).toBeNull();
    const text = { ...newTextLayer("Oi"), color: { temperature: 30 } };
    expect(documentIssue("image", { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [{ ...board, layers: [text] }] })).toEqual({ field: "document.layers", code: "invalid" });
  });
});

describe("grading pixels in bulk", () => {
  it("matches the per pixel grade within one step of 8 bit color and keeps alpha", () => {
    const grade = { exposure: 0.7, contrast: 30, shadows: 40, highlights: -30, blacks: 20, whites: -10, temperature: 25, tint: -15, saturation: -20, vibrance: 40 };
    const data = new Uint8ClampedArray(4 * 64);
    for (let i = 0; i < 64; i++) data.set([(i * 37) % 256, (i * 91) % 256, (i * 53) % 256, 255 - i], i * 4);
    const original = data.slice();
    gradeImageData(data, gradeUniforms(grade));
    let worst = 0;
    for (let i = 0; i < 64; i++) {
      const expected = gradePixel([original[i * 4] / 255, original[i * 4 + 1] / 255, original[i * 4 + 2] / 255], grade);
      for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(data[i * 4 + c] - expected[c] * 255));
      expect(data[i * 4 + 3]).toBe(original[i * 4 + 3]);
    }
    expect(worst).toBeLessThanOrEqual(1.5);
  });
});

describe("changing a grade", () => {
  it("starts from a look, merges values on top, resets, and names a field out of range", () => {
    expect(changedGrade({ exposure: 1 }, { look: "mono", intensity: 0.5, values: { contrast: 30 } })).toEqual({ saturation: -50, contrast: 30 });
    expect(changedGrade({ exposure: 1 }, { values: { saturation: 10 } })).toEqual({ exposure: 1, saturation: 10 });
    expect(changedGrade({ exposure: 1 }, { reset: true })).toBeUndefined();
    expect(gradeFault({ exposure: 1, tint: 300 })).toBe("tint");
    expect(gradeFault({ exposure: 1 })).toBeNull();
  });
});

describe("gradeSummary", () => {
  it("names the warmth, the exposure and how many other controls moved", () => {
    expect(gradeSummary({ temperature: 35, exposure: 0.4, tint: 5, vibrance: 10 })).toEqual({ warmth: "warm", exposure: 0.4, others: 2 });
    expect(gradeSummary({ temperature: -20 })).toEqual({ warmth: "cool", exposure: null, others: 0 });
    expect(gradeSummary({ contrast: 10 })).toEqual({ warmth: null, exposure: null, others: 1 });
  });

  it("has nothing to say about a neutral grade", () => {
    expect(gradeSummary(undefined)).toBeNull();
    expect(gradeSummary({ exposure: 0 })).toBeNull();
  });
});
