import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { clipRepeatAt, clipRepeatClipIssue, clipRepeatIssue, defaultClipRepeat, repeatCopies, splitClipRepeat, type ClipRepeat } from "./clip-repeat";
import type { VideoDocument } from "./document";
import { placeBy, type Affine } from "./repeat";
import { parseDocument } from "./validate";

const BOX = { left: 0, top: 0, right: 100, bottom: 100 };

function center(place: Affine): { x: number; y: number } {
  return { x: place.a * 50 + place.c * 50 + place.e, y: place.b * 50 + place.d * 50 + place.f };
}

describe("clip repeater", () => {
  it("steps each linear copy by the offset, compounding rotation and scale", () => {
    const copies = repeatCopies({ mode: "linear", copies: 3, x: 100 }, BOX);
    expect(copies.map((copy) => center(copy.place).x)).toEqual([50, 150, 250]);
    const turned = repeatCopies({ mode: "linear", copies: 3, x: 100, rotation: 90 }, BOX);
    expect(center(turned[1].place).x).toBeCloseTo(150);
    expect(center(turned[2].place).x).toBeCloseTo(150);
    expect(center(turned[2].place).y).toBeCloseTo(150);
    const shrinking = repeatCopies({ mode: "linear", copies: 3, scale: 0.5 }, BOX);
    expect(placeBy(shrinking[2].place, { x: 50, y: 50, rotation: 0, flipX: false }).scale).toBeCloseTo(0.25);
  });

  it("slides every copy along the step with the shift, fractions included", () => {
    const copies = repeatCopies({ mode: "linear", copies: 2, x: 100, shift: 1.5 }, BOX);
    expect(copies.map((copy) => center(copy.place).x)).toEqual([200, 300]);
    const back = repeatCopies({ mode: "linear", copies: 1, x: 100, shift: -2 }, BOX);
    expect(center(back[0].place).x).toBeCloseTo(-150);
  });

  it("fades from the start opacity to the end opacity and dims a partial last copy", () => {
    const copies = repeatCopies({ mode: "linear", copies: 3, x: 10, startOpacity: 1, endOpacity: 0 }, BOX);
    expect(copies.map((copy) => copy.opacity)).toEqual([1, 0.5, 0]);
    const partial = repeatCopies({ mode: "linear", copies: 2.25, x: 10 }, BOX);
    expect(partial).toHaveLength(3);
    expect(partial[2].opacity).toBeCloseTo(0.25);
  });

  it("draws copies under the original when the order is below", () => {
    const copies = repeatCopies({ mode: "linear", copies: 3, x: 10, order: "below" }, BOX);
    expect(copies.map((copy) => copy.index)).toEqual([2, 1, 0]);
  });

  it("reuses the image editor modes for radial, grid and mirror copies", () => {
    const ring = repeatCopies(defaultClipRepeat("radial", BOX), BOX);
    expect(ring).toHaveLength(8);
    const grid = repeatCopies({ mode: "grid", rows: 2, columns: 2, gapX: 10, gapY: 10 }, BOX);
    expect(center(grid[3].place)).toEqual({ x: 160, y: 160 });
    expect(repeatCopies({ mode: "mirror", angle: 90 }, BOX)).toHaveLength(2);
  });

  it("validates the fields of each mode and the keys it takes", () => {
    expect(clipRepeatIssue(defaultClipRepeat("linear", BOX))).toBeNull();
    expect(clipRepeatIssue({ mode: "linear", copies: 0 })).toBe("out_of_range");
    expect(clipRepeatIssue({ mode: "linear", copies: 2.5 })).toBe("out_of_range");
    expect(clipRepeatIssue({ mode: "linear", copies: 900 })).toBeNull();
    expect(clipRepeatIssue({ mode: "linear", copies: 2, rows: 2 })).toBe("invalid");
    expect(clipRepeatIssue({ mode: "grid", rows: 2, columns: 2, x: 4 })).toBe("invalid");
    expect(clipRepeatIssue({ mode: "linear", copies: 2, scale: 0 })).toBe("out_of_range");
    expect(clipRepeatIssue({ mode: "linear", copies: 2, endOpacity: 2 })).toBe("out_of_range");
    expect(clipRepeatIssue({ mode: "spiral" } as unknown as ClipRepeat)).toBe("unknown");
    expect(clipRepeatIssue({ mode: "linear", copies: 2, order: "middle" } as unknown as ClipRepeat)).toBe("unknown");
    expect(clipRepeatIssue({ mode: "radial", count: 4, radius: 50, keyframes: { x: [{ atMs: 0, value: 4, easing: "linear" }] } })).toBe("invalid");
    expect(clipRepeatIssue({ mode: "radial", count: 4, radius: 50, keyframes: { radius: [{ atMs: 0, value: 40, easing: "linear" }] } })).toBeNull();
    expect(clipRepeatClipIssue({ type: "video", repeat: defaultClipRepeat("linear", BOX) })).toBe("invalid");
  });

  it("reads keyed values at a moment and carries them across a split", () => {
    const keyed: ClipRepeat = { mode: "linear", copies: 3, x: 10, keyframes: { shift: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 2, easing: "linear" }] } };
    const at = clipRepeatAt(keyed, 500);
    expect(at.shift).toBeCloseTo(1);
    expect(at.keyframes).toBeUndefined();
    expect(clipRepeatAt(splitClipRepeat(keyed, 500), 250).shift).toBeCloseTo(1.5);
  });

  it("accepts the shared fixture and refuses a repeat on an audio clip", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_clip_repeat.json"), "utf8")) as VideoDocument;
    expect(parseDocument("video", raw).ok).toBe(true);
    const broken = structuredClone(raw);
    broken.tracks[0].clips[0].repeat = { ...broken.tracks[0].clips[0].repeat!, rows: 3 };
    expect(parseDocument("video", broken).ok).toBe(false);
  });
});
