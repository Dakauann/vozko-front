import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { addTransition, type TransitionInput } from "./transitions";

function clip(id: string, startMs: number, durationMs: number, extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("video", `asset-${id}`, startMs, durationMs), id, ...extra };
}

function film(input: Partial<TransitionInput> = {}): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [{ id: "v1", kind: "visual", clips: [clip("a", 0, 2000, { trimInMs: 1000 }), clip("b", 2000, 2000, { trimInMs: 500 })] }];
  d.durationMs = 4000;
  const result = addTransition(d, { fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 500, ...input });
  if (!result.ok) throw new Error(result.reason);
  return result.document;
}

const item = (d: VideoDocument, ms: number, id: string) => visualPlan(d, ms).find((i) => i.clipId === id)!;

describe("transitions in playback", () => {
  it("shows both clips inside the window, each holding its edge frame past the cut", () => {
    const d = film();
    const before = visualPlan(d, 1900);
    expect(before.map((i) => i.clipId)).toEqual(["a", "b"]);
    expect(item(d, 1900, "a")).toMatchObject({ active: true, opacity: 1, sourceMs: 2900 });
    expect(item(d, 1900, "b")).toMatchObject({ active: true, sourceMs: 500 });
    expect(item(d, 1900, "b").opacity).toBeCloseTo(0.3);
    expect(item(d, 2100, "a")).toMatchObject({ active: true, sourceMs: 2999 });
    expect(item(d, 2100, "b").opacity).toBeCloseTo(0.7);
    expect(item(d, 2300, "a")).toBeUndefined();
  });

  it("moves the clips for a push and puts the outgoing clip on top when it slides out", () => {
    const pushed = film({ kind: "push", direction: "left", easing: "linear" });
    expect(item(pushed, 2000, "a").transform.x).toBeCloseTo(0);
    expect(item(pushed, 2000, "b").transform.x).toBeCloseTo(1);
    const slid = film({ kind: "slide", direction: "right", moving: "out" });
    expect(visualPlan(slid, 2000).map((i) => i.clipId)).toEqual(["b", "a"]);
  });

  it("tints toward the dip color and masks the incoming clip for a wipe", () => {
    const dip = film({ kind: "dipToColor", color: "#ffffff" });
    expect(item(dip, 1900, "a").tint).toMatchObject({ color: "#ffffff" });
    expect(videoScene(dip, visualPlan(dip, 1900)).nodes.find((n) => n.id === "a")?.colorMatrix).toBeDefined();
    const wiped = film({ kind: "wipe" });
    const scene = videoScene(wiped, visualPlan(wiped, 2000));
    expect(scene.nodes.find((n) => n.id === "b")?.reveal?.polygon?.length).toBeGreaterThan(0);
    expect(scene.nodes.find((n) => n.id === "b")?.reveal).toMatchObject({ box: { x: scene.width / 2, y: scene.height / 2, width: scene.width, height: scene.height, rotation: 0 }, inverse: false });
    expect(scene.nodes.find((n) => n.id === "a")?.reveal).toBeUndefined();
  });
});
