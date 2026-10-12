import { describe, expect, it } from "vitest";

import type { SceneNode } from "../scene/scene";
import { gestureSplit } from "./gesture-split";

function node(id: string, extra: Partial<SceneNode> = {}): SceneNode {
  return { id, source: { kind: "image", assetId: id }, box: { x: 0, y: 0, width: 10, height: 10, rotation: 0 }, fit: "fill", opacity: 1, visible: true, ...extra };
}

describe("gesture split", () => {
  const still = [node("a"), node("b"), node("c"), node("d"), node("e")];

  it("caches nothing when nothing changed and nothing else is moving, so a still frame is drawn live", () => {
    expect(gestureSplit(still, still, false)).toBeNull();
  });

  it("caches the whole board when it is still but another board is changing", () => {
    expect(gestureSplit(still, still, true)).toEqual({ below: 5, above: 5 });
  });

  it("keeps only the moving layer live, with what is under and over it cached", () => {
    const moving = still.map((n) => (n.id === "c" ? node("c", { box: { ...n.box, x: 4 } }) : n));
    expect(gestureSplit(moving, still, false)).toEqual({ below: 2, above: 3 });
  });

  it("keeps the span between several moving layers live", () => {
    const moving = still.map((n) => (n.id === "b" || n.id === "d" ? node(n.id, { opacity: 0.5 }) : n));
    expect(gestureSplit(moving, still, false)).toEqual({ below: 1, above: 4 });
  });

  it("caches nothing on a frame where layers were added, removed or reordered", () => {
    expect(gestureSplit([...still.slice(0, 2), node("new"), ...still.slice(2)], still, false)).toBeNull();
    expect(gestureSplit(still.slice(1), still, true)).toBeNull();
    expect(gestureSplit([still[1], still[0], ...still.slice(2)], still, true)).toBeNull();
  });

  it("never splits a clip run, so a clipped photo stays with its frame", () => {
    const run = [node("a"), node("frame"), node("photo", { clipOf: "frame" }), node("ink", { clipOf: "frame" }), node("e")];
    const photoMoved = run.map((n) => (n.id === "photo" ? { ...n, opacity: 0.4 } : n));
    expect(gestureSplit(photoMoved, run, false)).toEqual({ below: 1, above: 4 });
    const frameMoved = run.map((n) => (n.id === "frame" ? { ...n, opacity: 0.4 } : n));
    expect(gestureSplit(frameMoved, run, false)).toEqual({ below: 1, above: 4 });
  });

  it("draws everything over the moving layer live when one of those layers blends with what is under it", () => {
    const blended = [node("a"), node("b"), node("c"), node("d", { blend: "multiply" }), node("e")];
    const moving = blended.map((n) => (n.id === "b" ? { ...n, opacity: 0.3 } : n));
    expect(gestureSplit(moving, blended, false)).toEqual({ below: 1, above: 5 });
  });

  it("caches nothing when the moving layer is the whole story: bottom layer moving and a blend above", () => {
    const blended = [node("a"), node("b", { blend: "screen" })];
    const moving = blended.map((n) => (n.id === "a" ? { ...n, opacity: 0.3 } : n));
    expect(gestureSplit(moving, blended, false)).toBeNull();
  });

  it("refuses boards with adjustment layers, whose looks depend on everything under them", () => {
    const adjusted = [node("a"), node("b"), { ...node("fx"), source: { kind: "effect" as const } }];
    const moving = adjusted.map((n) => (n.id === "a" ? { ...n, opacity: 0.3 } : n));
    expect(gestureSplit(moving, adjusted, false)).toBeNull();
    expect(gestureSplit(adjusted, adjusted, true)).toBeNull();
  });
});
