import { describe, expect, it } from "vitest";

import { newMediaClip, type Clip } from "./document";
import { editTransform, laneProperties, recordMoment, toggleAnimation, toggleKeyAt } from "./keyframe-edit";
import { keyframeFault, keyframesInRange, keyframesIssue, mergeKeyframes, replaceLanes, type Keyframes } from "./keyframes";
import { curvePath, linkScale, movePathKey, scaleAxesMatch, setHandleAt, setSpatialAt, splitScale, straightenPath } from "./motion-edit";
import { positionAt, resolvedHandles } from "./position-path";

const SQUARE = 1;

function clip(keyframes?: Keyframes, overrides: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("image", "m-1", 0, 2000), id: "c", transform: { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 }, ...(keyframes ? { keyframes } : {}), ...overrides };
}

function patchedKeys(result: ReturnType<typeof splitScale>): Keyframes | undefined {
  if (!result.ok) throw new Error(result.reason);
  return result.patch.keyframes;
}

const line = (a: number, b: number) => [
  { atMs: 0, value: a, easing: "linear" as const },
  { atMs: 1000, value: b, easing: "linear" as const },
];

describe("scale axes", () => {
  it("splits a uniform scale into two equal axes and links them back", () => {
    const split = patchedKeys(splitScale(clip({ scale: line(1, 2) }), 0));
    expect(split?.scale).toBeUndefined();
    expect(split?.scaleX).toEqual(line(1, 2));
    expect(split?.scaleY).toEqual(line(1, 2));
    expect(scaleAxesMatch(clip(split))).toBe(true);
    const linked = patchedKeys(linkScale(clip({ ...split, scaleY: line(1, 3) }), "y"));
    expect(linked).toEqual({ scale: line(1, 3) });
  });

  it("starts both axes at the playhead when nothing scales yet", () => {
    const split = patchedKeys(splitScale(clip(), 400));
    expect(split?.scaleX).toEqual([{ atMs: 400, value: 1, easing: "linear" }]);
    expect(split?.scaleY).toEqual([{ atMs: 400, value: 1, easing: "linear" }]);
  });

  it("shows the lanes of the form the clip uses", () => {
    expect(laneProperties(clip())).toEqual(["x", "y", "scale", "rotation", "opacity", "blur"]);
    expect(laneProperties(clip({ scaleX: line(1, 2) }))).toEqual(["x", "y", "scaleX", "scaleY", "rotation", "opacity", "blur"]);
    expect(laneProperties(clip({ position: [{ atMs: 0, x: 0.1, y: 0.1, easing: "linear" }] }))).toEqual(["position", "scale", "rotation", "opacity", "blur"]);
  });

  it("writes axis keys when a side handle stretches an animated axis", () => {
    const stretched = clip({ scaleX: line(1, 2) });
    const edit = editTransform(stretched, { x: 0.5, y: 0.5, w: 0.6, h: 0.2, rotation: 0, opacity: 1 }, 0, SQUARE);
    expect(edit.patch.keyframes?.scaleX?.[0].value).toBeCloseTo(1.5, 9);
    expect(edit.patch.transform?.h).toBe(0.2);
    const tall = editTransform(stretched, { x: 0.5, y: 0.5, w: 0.4, h: 0.3, rotation: 0, opacity: 1 }, 0, SQUARE);
    expect(tall.patch.transform?.h).toBeCloseTo(0.3, 9);
    expect(tall.patch.keyframes).toBeUndefined();
  });

  it("records a moment on the axes instead of the uniform scale", () => {
    const keys = recordMoment(clip({ scaleY: line(1, 2) }), 500, SQUARE)?.keyframes;
    expect(keys?.scale).toBeUndefined();
    expect(keys?.scaleX?.map((k) => k.atMs)).toEqual([500]);
    expect(keys?.scaleY?.map((k) => k.atMs)).toEqual([0, 500, 1000]);
  });

  it("refuses a uniform scale beside an axis", () => {
    expect(keyframeFault({ scale: line(1, 2), scaleX: line(1, 2) }, clip().transform)).toEqual({ kind: "rival", property: "scale", rival: "scaleX" });
    expect(keyframesIssue({ position: [{ atMs: 0, x: 0.1, y: 0.1, easing: "linear" }], x: line(0.1, 0.2) }, clip().transform)).toBe("invalid");
  });

  it("counts each axis against its own side of the four frame limit", () => {
    expect(keyframeFault({ scaleY: line(1, 5) }, clip().transform)).toBeNull();
    expect(keyframeFault({ scaleX: line(1, 5) }, { ...clip().transform, w: 1 })).toMatchObject({ kind: "box", property: "scaleX", maxScale: 4 });
  });

  it("drops the rival form when another form arrives", () => {
    expect(replaceLanes({ scale: line(1, 2), opacity: line(0, 1) }, { scaleX: line(1, 3) })).toEqual({ opacity: line(0, 1), scaleX: line(1, 3) });
    expect(mergeKeyframes({ position: [{ atMs: 0, x: 0.1, y: 0.1, easing: "linear" }] }, { x: line(0.1, 0.9) })).toEqual({ x: line(0.1, 0.9) });
  });
});

describe("curved paths", () => {
  const straight: Keyframes = { x: line(0.2, 0.8), y: [{ atMs: 0, value: 0.8, easing: "linear" }, { atMs: 500, value: 0.2, easing: "linear" }, { atMs: 1000, value: 0.8, easing: "linear" }] };

  it("joins x and y into one curved path and separates it back", () => {
    const curved = patchedKeys(curvePath(clip(straight), "auto"));
    expect(curved?.x).toBeUndefined();
    expect(curved?.position?.map((k) => [k.atMs, k.x, k.y])).toEqual([
      [0, 0.2, 0.8],
      [500, 0.5, 0.2],
      [1000, 0.8, 0.8],
    ]);
    const separated = patchedKeys(straightenPath(clip(curved), SQUARE));
    expect(separated?.position).toBeUndefined();
    expect(separated?.x?.length).toBeGreaterThan(3);
  });

  it("keys the path from the transform fields and the moment button", () => {
    const curved = clip(patchedKeys(curvePath(clip(straight), "auto")));
    const edit = editTransform(curved, { x: 0.6, y: 0.4, w: 0.4, h: 0.2, rotation: 0, opacity: 1 }, 250, SQUARE);
    expect(edit.patch.keyframes?.position?.map((k) => k.atMs)).toEqual([0, 250, 500, 1000]);
    expect(edit.patch.keyframes?.x).toBeUndefined();
    const moment = recordMoment(curved, 750, SQUARE)?.keyframes;
    expect(moment?.position?.find((k) => k.atMs === 750)).toMatchObject(positionAt(curved.keyframes!.position!, 750, SQUARE));
    expect(moment?.x).toBeUndefined();
  });

  it("toggles the path lane like any other lane", () => {
    const curved = clip(patchedKeys(curvePath(clip(straight), "auto")));
    const stopped = toggleAnimation(curved, "position", 500, SQUARE);
    expect(stopped.keyframes?.position).toBeUndefined();
    expect(stopped.transform).toMatchObject({ x: 0.5, y: 0.2 });
    expect(toggleKeyAt(curved, "position", 500, SQUARE).keyframes?.position?.map((k) => k.atMs)).toEqual([0, 1000]);
  });

  it("turns a key smooth with the handles it already showed, then breaks them on demand", () => {
    const curved = clip(patchedKeys(curvePath(clip(straight), "auto")));
    const before = resolvedHandles(curved.keyframes!.position!, SQUARE)[1];
    const smooth = patchedKeys(setSpatialAt(curved, 500, "smooth", SQUARE));
    expect(smooth?.position?.[1]).toMatchObject({ spatial: "smooth", in: before.in, out: before.out });
    const dragged = patchedKeys(setHandleAt(clip(smooth), 500, "out", { x: 0.5, y: 0.1 }, false, SQUARE));
    const key = dragged!.position![1];
    expect(key.out).toEqual({ x: 0, y: -0.1 });
    expect(key.in!.x).toBeCloseTo(0, 9);
    expect(key.in!.y).toBeGreaterThan(0);
    const broken = patchedKeys(setHandleAt(clip(dragged), 500, "in", { x: 0.25, y: 0.2 }, true, SQUARE));
    expect(broken!.position![1]).toMatchObject({ spatial: "free", in: { x: -0.25, y: 0 }, out: { x: 0, y: -0.1 } });
    const linear = patchedKeys(setSpatialAt(clip(broken), 500, "linear", SQUARE));
    expect(linear!.position![1]).toEqual({ atMs: 500, x: 0.5, y: 0.2, easing: "linear", spatial: "linear" });
  });

  it("moves a key and keeps its handles", () => {
    const smooth = clip({ position: [{ atMs: 0, x: 0.2, y: 0.5, easing: "linear" }, { atMs: 500, x: 0.5, y: 0.5, easing: "linear", spatial: "smooth", in: { x: -0.1, y: 0 }, out: { x: 0.1, y: 0 } }, { atMs: 1000, x: 0.8, y: 0.5, easing: "linear" }] });
    const moved = patchedKeys(movePathKey(smooth, 500, { x: 0.5, y: 0.3 }));
    expect(moved!.position![1]).toMatchObject({ x: 0.5, y: 0.3, in: { x: -0.1, y: 0 } });
  });

  it("keeps the shape of a split path by keeping two keys past each edge", () => {
    const keys: Keyframes = { position: [0, 300, 600, 900, 1200, 1500].map((atMs, i) => ({ atMs, x: 0.1 + i * 0.15, y: i % 2 === 0 ? 0.2 : 0.8, easing: "linear" as const })) };
    const kept = keyframesInRange(keys, 650, 850);
    expect(kept?.position?.map((k) => k.atMs)).toEqual([300, 600, 900, 1200]);
    for (const ms of [650, 700, 800, 850]) expect(positionAt(kept!.position!, ms, SQUARE)).toEqual(positionAt(keys.position!, ms, SQUARE));
  });
});
