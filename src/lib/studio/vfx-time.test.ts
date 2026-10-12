import { describe, expect, it } from "vitest";

import { blurredPlan } from "./blurred-plan";
import { emptyVideoDocument, newOverlayClip, newShapeLayer, type Clip, type VideoDocument } from "./document";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { newEffectClip, newVfx, type Vfx } from "./vfx";
import { steppedClipIds, steppedMs, trackTimes } from "./vfx-time";

function mover(vfx: Vfx[] = []): Clip {
  const transform = { x: 0.2, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 };
  const clip = { ...newOverlayClip({ ...newShapeLayer("rect", transform), id: "l-m" }, 0, 1000, transform), id: "m" };
  return { ...clip, keyframes: { x: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 1, easing: "linear" }] }, ...(vfx.length ? { vfx } : {}) };
}

function film(clips: Clip[], effects: Vfx[] = []): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.tracks = [{ id: "v1", kind: "visual", clips }, ...(effects.length ? [{ id: "fx", kind: "visual" as const, clips: [{ ...newEffectClip(effects, 0, 1000), id: "e" }] }] : [])];
  doc.durationMs = 1000;
  return doc;
}

const xOf = (doc: VideoDocument, ms: number) => visualPlan(doc, ms).find((item) => item.clipId === "m")!.transform.x;

describe("posterize time", () => {
  it("holds each step for a whole period from the clip start", () => {
    const clip = mover();
    const vfx = { ...newVfx("posterizeTime", "p", 0), params: { rate: 4 } };
    expect(steppedMs(clip, vfx, 0)).toBe(0);
    expect(steppedMs(clip, vfx, 249)).toBe(0);
    expect(steppedMs(clip, vfx, 250)).toBe(250);
    expect(steppedMs(clip, { ...vfx, offsetMs: 100 }, 200)).toBe(150);
  });

  it("steps the clip that carries it", () => {
    const doc = film([mover([{ ...newVfx("posterizeTime", "p", 0), params: { rate: 4 } }])]);
    expect(xOf(doc, 240)).toBeCloseTo(0, 6);
    expect(xOf(doc, 260)).toBeCloseTo(0.25, 6);
    expect(steppedClipIds(doc, 240).has("m")).toBe(true);
  });

  it("on an effect clip steps everything below it and nothing above it", () => {
    const doc = film([mover()], [{ ...newVfx("posterizeTime", "p", 0), params: { rate: 2 } }]);
    expect(trackTimes(doc, 700)).toEqual([500, 700]);
    expect(xOf(doc, 700)).toBeCloseTo(0.5, 6);
  });

  it("gives a stepped clip no motion blur trail", () => {
    const doc = { ...film([{ ...mover([{ ...newVfx("posterizeTime", "p", 0), params: { rate: 2 } }]), motionBlur: true }]) };
    expect(blurredPlan(doc, 600, 1).find((item) => item.clipId === "m")?.trail).toBeUndefined();
  });
});

describe("echo", () => {
  it("draws earlier copies under the clip, oldest first, fading by the decay", () => {
    const doc = film([mover([{ ...newVfx("echo", "e", 0), params: { count: 3, delay: 100, decay: 0.5, amount: 1 } }])]);
    const item = visualPlan(doc, 500).find((entry) => entry.clipId === "m")!;
    expect(item.echo?.map((copy) => Number(copy.transform.x.toFixed(3)))).toEqual([0.2, 0.3, 0.4]);
    expect(item.echo?.map((copy) => copy.opacity)).toEqual([0.125, 0.25, 0.5]);
  });

  it("skips copies from before the clip starts", () => {
    const doc = film([mover([{ ...newVfx("echo", "e", 0), params: { count: 5, delay: 100 } }])]);
    expect(visualPlan(doc, 150).find((entry) => entry.clipId === "m")!.echo?.length).toBe(1);
  });

  it("becomes scene nodes of their own, below the clip", () => {
    const doc = film([mover([{ ...newVfx("echo", "e", 0), params: { count: 2, delay: 100 } }])]);
    const ids = videoScene(doc, visualPlan(doc, 500)).nodes.map((node) => node.id);
    expect(ids).toEqual(["m~echo1", "m~echo2", "m"]);
  });
});
