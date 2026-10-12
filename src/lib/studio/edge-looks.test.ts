import { describe, expect, it } from "vitest";

import type { ClipTransition } from "./edge-transitions";
import { edgeLook, transitionLook } from "./transition-effects";
import type { Transition } from "./transitions";

function cut(kind: Transition["kind"], extra: Partial<Transition> = {}): Transition {
  return { id: "t", fromClipId: "a", toClipId: "b", kind, durationMs: 500, alignment: "center", easing: "linear", ...extra };
}

function edge(kind: ClipTransition["kind"], extra: Partial<ClipTransition> = {}): ClipTransition {
  return { kind, durationMs: 500, easing: "linear", ...extra };
}

describe("the new wipes on a cut", () => {
  it("reveal the incoming clip through a threshold field and leave the outgoing clip still", () => {
    expect(transitionLook(cut("gradientWipe"), "to", 0.5, true).reveal).toEqual({ kind: "field", field: { pattern: "gradient", map: "linear", angle: 0, originX: 0.5, originY: 0.5, reverse: false }, progress: 0.5, softness: 0.2 });
    expect(transitionLook(cut("gradientWipe", { mapAssetId: "m-1", reverse: true }), "to", 0.25, true).reveal).toMatchObject({ field: { pattern: "image", assetId: "m-1", reverse: true }, progress: 0.25 });
    expect(transitionLook(cut("venetianBlinds", { size: 0.2 }), "to", 0.3, true).reveal).toMatchObject({ field: { pattern: "blinds", angle: 0, size: 0.2 }, softness: 0 });
    expect(transitionLook(cut("blockDissolve"), "to", 0.3, true).reveal).toMatchObject({ field: { pattern: "blocks", size: 0.08 } });
    expect(transitionLook(cut("radialWipe", { angle: 90 }), "to", 0.3, true).reveal).toMatchObject({ field: { pattern: "fan", angle: 90, originX: 0.5, originY: 0.5 } });
    expect(transitionLook(cut("radialWipe"), "from", 0.3, true).reveal).toBeUndefined();
  });
});

describe("entrance and exit looks", () => {
  it("reveal an entering clip the way a cut reveals the incoming one", () => {
    expect(edgeLook(edge("wipe", { angle: 90 }), "in", 0.4).reveal).toEqual({ kind: "halfPlane", angle: 90, progress: 0.4 });
    expect(edgeLook(edge("blockDissolve"), "in", 0.4).reveal).toMatchObject({ kind: "field", progress: 0.4 });
  });

  it("hide a leaving clip where the cut would have shown the next one", () => {
    expect(edgeLook(edge("wipe"), "out", 0.4).reveal).toEqual({ kind: "halfPlane", angle: 0, progress: 0.4, inverse: true });
    expect(edgeLook(edge("radialWipe"), "out", 0.4).reveal).toMatchObject({ kind: "field", inverse: true });
    expect(edgeLook(edge("iris", { reverse: true }), "out", 0.4).reveal).toEqual({ kind: "shape", shape: "circle", originX: 0.5, originY: 0.5, size: 0.6 });
    expect(edgeLook(edge("iris", { reverse: true }), "in", 0.4).reveal).toEqual({ kind: "shape", shape: "circle", originX: 0.5, originY: 0.5, size: 0.6, inverse: true });
  });

  it("move the clip in and out for push and slide, whichever side it is", () => {
    expect(edgeLook(edge("slide", { direction: "left" }), "in", 0.5)).toMatchObject({ dx: 0.5, dy: 0 });
    expect(edgeLook(edge("slide", { direction: "left" }), "out", 0.5)).toMatchObject({ dx: -0.5, dy: 0 });
    expect(edgeLook(edge("push", { direction: "up" }), "in", 1)).toMatchObject({ dx: 0, dy: 0 });
  });

  it("stretch the clip's own half of a sequential transition over the whole edge", () => {
    expect(edgeLook(edge("dipToColor", { color: "#ffffff" }), "in", 0)).toMatchObject({ opacity: 1, tint: { color: "#ffffff", amount: 1 } });
    expect(edgeLook(edge("dipToColor"), "in", 1).tint?.amount).toBeCloseTo(0);
    expect(edgeLook(edge("dipToColor"), "out", 0).tint?.amount).toBeCloseTo(0);
    expect(edgeLook(edge("zoom"), "in", 0).scale).toBeCloseTo(1.5);
    expect(edgeLook(edge("zoom"), "in", 1).scale).toBeCloseTo(1);
    expect(edgeLook(edge("zoom"), "out", 0.999).opacity).toBe(1);
  });

  it("fade the blur dissolve against what is below", () => {
    expect(edgeLook(edge("blurDissolve"), "out", 0.25).opacity).toBeCloseTo(0.75);
    expect(edgeLook(edge("blurDissolve"), "in", 0.25).opacity).toBeCloseTo(0.25);
  });
});
