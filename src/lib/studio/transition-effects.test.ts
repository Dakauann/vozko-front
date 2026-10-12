import { describe, expect, it } from "vitest";

import { revealPolygon, transitionLook } from "./transition-effects";
import type { Transition } from "./transitions";

function transition(kind: Transition["kind"], extra: Partial<Transition> = {}): Transition {
  return { id: "t", fromClipId: "a", toClipId: "b", kind, durationMs: 500, alignment: "center", easing: "linear", ...extra };
}

describe("transition looks", () => {
  it("dissolves the incoming clip over the outgoing one", () => {
    expect(transitionLook(transition("dissolve"), "to", 0.25, true)).toMatchObject({ opacity: 0.25 });
    expect(transitionLook(transition("dissolve"), "from", 0.25, true)).toMatchObject({ opacity: 1 });
    expect(transitionLook(transition("dissolve"), "from", 0.25, false)).toMatchObject({ opacity: 0.75 });
  });

  it("pushes both clips the same way and slides one over the other", () => {
    expect(transitionLook(transition("push", { direction: "left" }), "from", 0.5, true)).toMatchObject({ dx: -0.5, dy: 0 });
    expect(transitionLook(transition("push", { direction: "left" }), "to", 0.5, true)).toMatchObject({ dx: 0.5, dy: 0 });
    expect(transitionLook(transition("push", { direction: "up" }), "to", 0.25, true)).toMatchObject({ dx: 0, dy: 0.75 });
    expect(transitionLook(transition("slide", { direction: "right", moving: "in" }), "from", 0.5, true)).toMatchObject({ dx: 0, above: false });
    expect(transitionLook(transition("slide", { direction: "right", moving: "out" }), "from", 0.5, true)).toMatchObject({ dx: 0.5, above: true });
  });

  it("dips through a color, showing one clip on each side of the middle", () => {
    expect(transitionLook(transition("dipToColor", { color: "#ffffff" }), "from", 0.25, true)).toMatchObject({ opacity: 1, tint: { color: "#ffffff", amount: 0.5 } });
    expect(transitionLook(transition("dipToColor"), "to", 0.25, true)).toMatchObject({ opacity: 0 });
    expect(transitionLook(transition("dipToColor"), "to", 0.75, true)).toMatchObject({ opacity: 1, tint: { color: "#000000", amount: 0.5 } });
  });

  it("reveals the incoming clip through a wipe, iris, clock and split, and hides the outgoing one through a closing iris", () => {
    expect(transitionLook(transition("wipe", { angle: 90 }), "to", 0.4, true).reveal).toEqual({ kind: "halfPlane", angle: 90, progress: 0.4 });
    expect(transitionLook(transition("iris"), "to", 0.4, true).reveal).toEqual({ kind: "shape", shape: "circle", originX: 0.5, originY: 0.5, size: 0.4 });
    const closing = transitionLook(transition("iris", { reverse: true }), "from", 0.4, true);
    expect(closing).toMatchObject({ above: true, reveal: { size: 0.6 } });
    expect(transitionLook(transition("clockWipe"), "to", 0.25, true).reveal).toMatchObject({ kind: "sector", sweep: 90 });
    expect(transitionLook(transition("split"), "to", 0.5, true).reveal).toEqual({ kind: "band", orientation: "vertical", size: 0.5 });
  });

  it("zooms and whips through the cut with blur, one clip per half", () => {
    const zoomOut = transitionLook(transition("zoom", { amount: 0.5 }), "from", 0.25, true);
    expect(zoomOut.scale).toBeCloseTo(1.25);
    expect(zoomOut.blurPx).toBeGreaterThan(0);
    expect(transitionLook(transition("zoom"), "from", 0.75, true).opacity).toBe(0);
    const whipIn = transitionLook(transition("whip", { direction: "left" }), "to", 0.75, true);
    expect(whipIn.dx).toBeCloseTo(0.5);
    expect(whipIn.blurPx).toBeGreaterThan(0);
  });

  it("shapes the progress with the easing", () => {
    expect(transitionLook(transition("dissolve", { easing: "easeIn" }), "to", 0.5, true).opacity).toBeCloseTo(0.125);
  });
});

describe("reveal polygons", () => {
  it("covers nothing at the start and the whole frame at the end", () => {
    const area = (points: number[]) => {
      let sum = 0;
      for (let i = 0; i < points.length; i += 2) {
        const j = (i + 2) % points.length;
        sum += points[i] * points[j + 1] - points[j] * points[i + 1];
      }
      return Math.abs(sum) / 2;
    };
    expect(area(revealPolygon({ kind: "band", orientation: "vertical", size: 0.5 }, 100, 50))).toBeCloseTo(2500);
    expect(area(revealPolygon({ kind: "halfPlane", angle: 0, progress: 0.25 }, 100, 50))).toBeGreaterThan(0);
    const full = revealPolygon({ kind: "shape", shape: "box", originX: 0.5, originY: 0.5, size: 1 }, 100, 50);
    expect(area(full)).toBeGreaterThanOrEqual(5000);
    expect(area(revealPolygon({ kind: "shape", shape: "circle", originX: 0.5, originY: 0.5, size: 0 }, 100, 50))).toBe(0);
  });

  it("places a half plane edge across the frame as the wipe advances", () => {
    const points = revealPolygon({ kind: "halfPlane", angle: 0, progress: 0.25 }, 100, 50);
    const xs = points.filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs)).toBeCloseTo(25);
  });
});
