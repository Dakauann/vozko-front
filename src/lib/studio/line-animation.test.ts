import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newOverlayClip, newShapeLayer, newTextLayer, type Clip, type VideoDocument } from "./document";
import {
  LINE_DEFAULTS,
  lineAt,
  lineColorOf,
  lineIssue,
  lineOptionsPatch,
  lineReach,
  lineStaticPatch,
  lineStaticValue,
  lineStep,
  lineValue,
  strokelessLayer,
  takesLineAnimation,
  toggleLineGroup,
  splitLine,
  travelled,
} from "./line-animation";
import type { Keyframe } from "./keyframes";
import { findClip, splitClip } from "./timeline";
import { documentIssue } from "./validate";

function lineClip(extra: Partial<Clip> = {}): Clip {
  return { ...newOverlayClip(newShapeLayer("line"), 0, 2000), id: "c-line", ...extra };
}

const key = (atMs: number, value: number, easing: Keyframe["easing"] = "linear"): Keyframe => ({ atMs, value, easing });

describe("travelled phase", () => {
  it("is speed times time without keys", () => {
    expect(travelled([], 2, 1500)).toBeCloseTo(3);
    expect(travelled([], 2, -10)).toBe(0);
  });

  it("integrates keyed speed so a change of speed accelerates instead of jumping", () => {
    const frames = [key(0, 0), key(1000, 2)];
    expect(travelled(frames, 0, 1000)).toBeCloseTo(1, 6);
    expect(travelled(frames, 0, 2000)).toBeCloseTo(3, 6);
    expect(travelled(frames, 0, 500)).toBeCloseTo(0.25, 6);
    const before = travelled(frames, 0, 999);
    const after = travelled(frames, 0, 1001);
    expect(after - before).toBeCloseTo(0.004, 3);
  });

  it("holds the first value before the first key and the last after the last", () => {
    const frames = [key(500, 1), key(1500, 1)];
    expect(travelled(frames, 0, 500)).toBeCloseTo(0.5, 6);
    expect(travelled(frames, 0, 2500)).toBeCloseTo(2.5, 6);
  });

  it("follows the easing of each segment, holding a step for hold", () => {
    const held = [key(0, 1, "hold"), key(1000, 3)];
    expect(travelled(held, 0, 1000)).toBeCloseTo(1, 6);
    const eased = [key(0, 0, "easeIn"), key(1000, 4)];
    expect(travelled(eased, 0, 1000)).toBeCloseTo(1, 4);
  });

  it("is deterministic", () => {
    const frames = [key(0, 0, "spring"), key(800, 3, "cubic-bezier(0.2,0.8,0.2,1)"), key(1600, -1)];
    expect(travelled(frames, 0, 1234)).toBe(travelled(frames, 0, 1234));
  });
});

describe("which layers take line animation", () => {
  it("takes stroked shapes and lines, and refuses text, shadows, effects and stroke lists", () => {
    expect(takesLineAnimation(newShapeLayer("line"))).toBe(true);
    expect(takesLineAnimation({ ...newShapeLayer("ellipse"), stroke: "#ff0000", strokeWidth: 6 })).toBe(true);
    expect(takesLineAnimation(newShapeLayer("ellipse"))).toBe(false);
    expect(takesLineAnimation(newTextLayer("Oi"))).toBe(false);
    expect(takesLineAnimation({ ...newShapeLayer("line"), shadow: { color: "#000000", blur: 4, x: 0, y: 2 } })).toBe(false);
    expect(takesLineAnimation({ ...newShapeLayer("line"), effects: [{ id: "e", type: "outer-glow", color: "#ffffff", opacity: 1, x: 0, y: 0, blur: 8, spread: 0 }] })).toBe(false);
    expect(takesLineAnimation({ ...newShapeLayer("rect"), strokes: [{ type: "solid", color: "#000000", opacity: 1, width: 4, align: "center" }] })).toBe(false);
  });

  it("draws a line in its stroke, or its fill when it has no stroke", () => {
    expect(lineColorOf({ ...newShapeLayer("line"), stroke: undefined, fill: "#00ff00" })).toBe("#00ff00");
    expect(lineColorOf({ ...newShapeLayer("rect"), stroke: "#123456", strokeWidth: 2 })).toBe("#123456");
  });

  it("keeps the fill and drops the stroke from the still raster", () => {
    const layer = { ...newShapeLayer("rect"), stroke: "#123456", strokeWidth: 4, arrowEnd: true, dashArray: [2, 1] };
    const still = strokelessLayer(layer);
    expect(still.fill).toBe(layer.fill);
    expect(still.stroke).toBeUndefined();
    expect(still.strokeWidth).toBeUndefined();
    expect(still.arrowEnd).toBeUndefined();
    expect(still.dashArray).toBeUndefined();
  });
});

describe("resolving the line at a moment", () => {
  it("returns nothing without line animation", () => {
    expect(lineAt(lineClip(), 100)).toBeUndefined();
  });

  it("reads static values and lets keys win", () => {
    const clip = lineClip({
      line: { trim: { start: 0, end: 0.5, offset: 0 } },
      keyframes: { trimEnd: [key(0, 0), key(1000, 1)] },
    });
    expect(lineAt(clip, 0)?.trim).toEqual({ start: 0, end: 0, offset: 0, sequential: false });
    expect(lineAt(clip, 500)?.trim?.end).toBeCloseTo(0.5);
    expect(lineValue(clip, "trimStart", 500)).toBe(0);
  });

  it("travels the wave by its speed and offsets it by the phase", () => {
    const clip = lineClip({ line: { wave: { mode: "bend", amount: 10, wavelength: 100, speed: 2, phase: 90 } } });
    expect(lineAt(clip, 0)?.wave?.turns).toBeCloseTo(-0.25);
    expect(lineAt(clip, 1000)?.wave?.turns).toBeCloseTo(1.75);
  });

  it("moves wiggle time by the rate in wiggles per second", () => {
    const clip = lineClip({ line: { wiggle: { size: 5, detail: 2, rate: 3, seed: 7 } } });
    expect(lineAt(clip, 2000)?.wiggle).toEqual({ size: 5, detail: 2, time: 6, seed: 7 });
  });
});

describe("line validation", () => {
  it("accepts a full line on a stroked overlay", () => {
    const clip = lineClip({ line: { ...LINE_DEFAULTS, trim: { ...LINE_DEFAULTS.trim, sequential: true } } });
    expect(lineIssue(clip)).toBeNull();
  });

  it("refuses an empty line, a layer that cannot take it and media clips", () => {
    expect(lineIssue(lineClip({ line: {} }))).toBe("required");
    expect(lineIssue({ ...lineClip(), layer: newTextLayer("x"), line: { trim: LINE_DEFAULTS.trim } })).toBe("invalid");
    expect(lineIssue({ ...lineClip(), type: "image", layer: undefined, line: { trim: LINE_DEFAULTS.trim } })).toBe("invalid");
  });

  it("refuses values out of range, unknown wave modes and a broken seed", () => {
    expect(lineIssue(lineClip({ line: { trim: { start: -0.1, end: 1, offset: 0 } } }))).toBe("out_of_range");
    expect(lineIssue(lineClip({ line: { wave: { ...LINE_DEFAULTS.wave, wavelength: 2 } } }))).toBe("out_of_range");
    expect(lineIssue(lineClip({ line: { wave: { ...LINE_DEFAULTS.wave, mode: "zigzag" as never } } }))).toBe("unknown");
    expect(lineIssue(lineClip({ line: { wiggle: { ...LINE_DEFAULTS.wiggle, seed: 1.5 } } }))).toBe("invalid");
    expect(lineIssue(lineClip({ line: { taper: { ...LINE_DEFAULTS.taper, startEase: 2 } } }))).toBe("out_of_range");
  });

  it("refuses a carried travel outside one wave cycle or below zero for the wiggle", () => {
    expect(lineIssue(lineClip({ line: { wave: { ...LINE_DEFAULTS.wave, travel: 0.4 }, wiggle: { ...LINE_DEFAULTS.wiggle, travel: 12.5 } } }))).toBeNull();
    expect(lineIssue(lineClip({ line: { wave: { ...LINE_DEFAULTS.wave, travel: 1 } } }))).toBe("out_of_range");
    expect(lineIssue(lineClip({ line: { wave: { ...LINE_DEFAULTS.wave, travel: -0.1 } } }))).toBe("out_of_range");
    expect(lineIssue(lineClip({ line: { wiggle: { ...LINE_DEFAULTS.wiggle, travel: -1 } } }))).toBe("out_of_range");
    expect(lineIssue(lineClip({ line: { wiggle: { ...LINE_DEFAULTS.wiggle, travel: Number.NaN } } }))).toBe("out_of_range");
  });

  it("refuses keys of a group that is off", () => {
    expect(lineIssue(lineClip({ keyframes: { trimEnd: [key(0, 0)] } }))).toBe("invalid");
    expect(lineIssue(lineClip({ line: { wave: LINE_DEFAULTS.wave }, keyframes: { trimEnd: [key(0, 0)] } }))).toBe("invalid");
  });
});

describe("line reach", () => {
  it("pads the raster for the widest wave, wiggle and stroke the clip can reach", () => {
    const still = lineReach(lineClip({ line: { trim: LINE_DEFAULTS.trim } }));
    const waved = lineReach(lineClip({ line: { wave: { ...LINE_DEFAULTS.wave, amount: 10 } }, keyframes: { waveAmount: [key(0, 10, "backOut"), key(500, 40)] } }));
    expect(waved).toBeGreaterThanOrEqual(still + 40);
    const wiggled = lineReach(lineClip({ line: { wiggle: { ...LINE_DEFAULTS.wiggle, size: 20 } } }));
    expect(wiggled).toBeGreaterThan(still + 20);
  });
});

describe("line sampling step", () => {
  it("samples densely enough for the shortest wave and finest wiggle the clip reaches, within 0.5 to 2 px", () => {
    expect(lineStep(lineClip({ line: { trim: LINE_DEFAULTS.trim } }))).toBe(2);
    expect(lineStep(lineClip({ line: { wave: { ...LINE_DEFAULTS.wave, wavelength: 12 } } }))).toBeCloseTo(1.5);
    expect(lineStep(lineClip({ line: { wave: LINE_DEFAULTS.wave }, keyframes: { waveLength: [key(0, 200), key(500, 8)] } }))).toBe(1);
    expect(lineStep(lineClip({ line: { wiggle: { ...LINE_DEFAULTS.wiggle, detail: 10 } } }))).toBe(0.625);
  });
});

describe("line edits", () => {
  it("turns a group on with defaults and off together with its keys", () => {
    const clip = lineClip();
    const on = toggleLineGroup(clip, "wave", true);
    expect(on.line?.wave).toEqual(LINE_DEFAULTS.wave);
    const keyed = { ...clip, ...on, keyframes: { waveAmount: [key(0, 4)], x: [key(0, 0.5)] } };
    const off = toggleLineGroup(keyed, "wave", false);
    expect(off.line).toBeUndefined();
    expect(off.keyframes).toEqual({ x: [key(0, 0.5)] });
  });

  it("changes the wave mode, the seed and the sequential trim only on groups that are on", () => {
    const clip = lineClip({ line: { trim: { ...LINE_DEFAULTS.trim, sequential: true }, wave: LINE_DEFAULTS.wave } });
    const patch = lineOptionsPatch(clip, { mode: "width", sequential: false, seed: 9 });
    expect(patch.line?.wave?.mode).toBe("width");
    expect(patch.line?.trim).toEqual(LINE_DEFAULTS.trim);
    expect(patch.line?.wiggle).toBeUndefined();
  });

  it("writes a still value into its group and reads it back, with defaults for a group that is off", () => {
    const clip = lineClip({ line: { trim: LINE_DEFAULTS.trim } });
    expect(lineStaticPatch(clip, "trimEnd", 0.4)).toEqual({ line: { trim: { ...LINE_DEFAULTS.trim, end: 0.4 } } });
    expect(lineStaticValue(clip, "trimEnd")).toBe(1);
    expect(lineStaticValue(lineClip(), "waveLength")).toBe(LINE_DEFAULTS.wave.wavelength);
  });
});

describe("splitting a line clip", () => {
  function film(clip: Clip): VideoDocument {
    const doc = emptyVideoDocument("landscape");
    doc.tracks = [{ id: "v1", kind: "visual", clips: [clip] }];
    doc.durationMs = clip.durationMs;
    return doc;
  }

  function cycleGap(a: number, b: number): number {
    const gap = (((a - b) % 1) + 1) % 1;
    return Math.min(gap, 1 - gap);
  }

  it("carries the travelled wave and wiggle into the right piece so nothing jumps at the cut", () => {
    const clip = lineClip({
      line: { wave: { mode: "bend", amount: 30, wavelength: 200, speed: 1.3, phase: 45 }, wiggle: { size: 8, detail: 2, rate: 2.5, seed: 4 } },
      keyframes: { waveSpeed: [key(0, 0.5, "easeIn"), key(1600, 3)], wiggleRate: [key(400, 1), key(1800, 6, "easeOut")] },
    });
    const split = splitClip(film(clip), "c-line", 1300);
    const left = findClip(split.document, "c-line")!.clip;
    const right = findClip(split.document, split.clipId!)!.clip;
    const before = lineAt(left, 1300)!;
    const after = lineAt(right, 0)!;
    expect(cycleGap(after.wave!.turns, before.wave!.turns)).toBeLessThan(1e-9);
    expect(after.wiggle!.time).toBeCloseTo(before.wiggle!.time, 9);
    expect(lineAt(right, 400)!.wiggle!.time).toBeCloseTo(lineAt(clip, 1700)!.wiggle!.time, 6);
    expect(cycleGap(lineAt(right, 250)!.wave!.turns, lineAt(clip, 1550)!.wave!.turns)).toBeLessThan(1e-6);
    expect(documentIssue("video", split.document)).toBeNull();
  });

  it("keeps carrying across a second split and leaves the left piece and other groups alone", () => {
    const clip = lineClip({ line: { trim: LINE_DEFAULTS.trim, wave: { ...LINE_DEFAULTS.wave, speed: -1.7 }, wiggle: { ...LINE_DEFAULTS.wiggle, rate: 3 } } });
    const first = splitClip(film(clip), "c-line", 700);
    const second = splitClip(first.document, first.clipId!, 1500);
    const last = findClip(second.document, second.clipId!)!.clip;
    expect(findClip(second.document, "c-line")!.clip.line).toEqual(clip.line);
    expect(last.line?.trim).toEqual(LINE_DEFAULTS.trim);
    expect(last.line?.wiggle?.travel).toBeCloseTo(4.5, 9);
    expect(cycleGap(lineAt(last, 0)!.wave!.turns, lineAt(clip, 1500)!.wave!.turns)).toBeLessThan(1e-9);
    expect(last.line?.wave?.travel).toBeGreaterThanOrEqual(0);
    expect(last.line?.wave?.travel).toBeLessThan(1);
  });

  it("returns no line for a clip without one and leaves groups without travel untouched", () => {
    expect(splitLine(lineClip(), 500)).toBeUndefined();
    const taper = lineClip({ line: { taper: LINE_DEFAULTS.taper } });
    expect(splitLine(taper, 500)).toEqual(taper.line);
  });
});
