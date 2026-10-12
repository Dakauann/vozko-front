import { describe, expect, it } from "vitest";

import { lumaOfRgba } from "./luma";
import { PatternTracker, TRACKING } from "./pattern-tracker";
import { flatFrame, syntheticFrame, type DotPlacement, type SyntheticScene } from "./synthetic-frames";

const SCENE: SyntheticScene = { width: 160, height: 120, seed: 11 };
const SIDE = 24;

function start(scene: SyntheticScene, dot: DotPlacement): PatternTracker {
  const started = PatternTracker.start(syntheticFrame(scene, dot), { x: dot.x, y: dot.y, side: SIDE });
  if (typeof started === "string") throw new Error(started);
  return started;
}

function worstError(scene: SyntheticScene, path: readonly DotPlacement[]): number {
  const tracker = start(scene, path[0]);
  let worst = 0;
  for (const dot of path.slice(1)) {
    const step = tracker.step(syntheticFrame(scene, dot));
    expect(step.lost).toBe(false);
    worst = Math.max(worst, Math.hypot(step.x - dot.x, step.y - dot.y));
  }
  return worst;
}

describe("the pattern tracker", () => {
  it("follows a dot moving at a steady speed to within a tenth of a pixel", () => {
    const path = Array.from({ length: 40 }, (_, n) => ({ x: 30 + n * 2.5, y: 40 + n * 1.2 }));
    expect(worstError(SCENE, path)).toBeLessThan(0.1);
  });

  it("measures motion smaller than a pixel per frame", () => {
    const path = Array.from({ length: 30 }, (_, n) => ({ x: 70 + n * 0.3, y: 60 - n * 0.17 }));
    expect(worstError(SCENE, path)).toBeLessThan(0.1);
  });

  it("keeps up with a dot that swings and speeds up", () => {
    const path = Array.from({ length: 60 }, (_, n) => ({ x: 80 + 40 * Math.sin(n / 8), y: 60 + 25 * Math.cos(n / 11) }));
    expect(worstError(SCENE, path)).toBeLessThan(0.25);
  });

  it("goes the other way from the first frame after a rewind", () => {
    const path = Array.from({ length: 20 }, (_, n) => ({ x: 60 + n * 1.5, y: 50 + n }));
    const tracker = start(SCENE, path[10]);
    for (const dot of path.slice(11)) tracker.step(syntheticFrame(SCENE, dot));
    tracker.rewind();
    for (const dot of [...path.slice(0, 10)].reverse()) {
      const step = tracker.step(syntheticFrame(SCENE, dot));
      expect(Math.hypot(step.x - dot.x, step.y - dot.y)).toBeLessThan(0.1);
    }
  });

  it("refuses a point with nothing to hold on to", () => {
    expect(PatternTracker.start(flatFrame(120, 90, 80), { x: 60, y: 45, side: SIDE })).toBe("flat");
    expect(PatternTracker.start(syntheticFrame({ ...SCENE, flat: true }, { x: 20, y: 20 }), { x: 120, y: 90, side: SIDE })).toBe("flat");
  });

  it("refuses a point outside the frame", () => {
    expect(PatternTracker.start(syntheticFrame(SCENE, { x: 60, y: 60 }), { x: -3, y: 60, side: SIDE })).toBe("outside");
    expect(PatternTracker.start(syntheticFrame(SCENE, { x: 60, y: 60 }), { x: 60, y: 121, side: SIDE })).toBe("outside");
  });

  it("reports a loss with a low confidence when the dot is covered, and stays where it was", () => {
    const tracker = start(SCENE, { x: 60, y: 60 });
    const kept = tracker.step(syntheticFrame(SCENE, { x: 62, y: 61 }));
    const covered = tracker.step(syntheticFrame({ ...SCENE, covered: { left: 40, top: 40, width: 50, height: 50 } }, { x: 64, y: 62 }));
    expect(kept.lost).toBe(false);
    expect(covered.lost).toBe(true);
    expect(covered.confidence).toBeLessThan(TRACKING.lostBelow);
    expect(tracker.position).toEqual({ x: kept.x, y: kept.y });
  });

  it("reports a loss when the point leaves the frame", () => {
    const tracker = start(SCENE, { x: 20, y: 60 });
    let lost = false;
    for (let n = 1; n < 20 && !lost; n++) lost = tracker.step(syntheticFrame(SCENE, { x: 20 - n * 3, y: 60 })).lost;
    expect(lost).toBe(true);
  });

  it("scores a confident match near one", () => {
    const tracker = start(SCENE, { x: 60, y: 60 });
    expect(tracker.step(syntheticFrame(SCENE, { x: 61, y: 60.5 })).confidence).toBeGreaterThan(0.95);
  });
});

describe("luma from a picture", () => {
  it("weighs red, green and blue by the Rec. 709 luma", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    const luma = lumaOfRgba(rgba, 2, 2);
    expect(Array.from(luma.data)).toEqual([54, 182, 18, 255]);
    expect(luma.width).toBe(2);
  });
});
