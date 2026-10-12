import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, type Clip, type VideoDocument } from "./document";
import type { ClipTransition } from "./edge-transitions";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";

const BOX = { x: 0.3, y: 0.4, w: 0.2, h: 0.1, rotation: 30, opacity: 1 };

function logo(extra: Partial<Clip> = {}): Clip {
  return { ...newOverlayClip({ ...newShapeLayer("rect"), id: "l" }, 1000, 2000, BOX), id: "logo", ...extra };
}

function film(clip: Clip): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [{ id: "v", kind: "visual", clips: [{ ...newMediaClip("image", "m-1", 0, 4000), id: "photo" }] }, { id: "o", kind: "visual", clips: [clip] }];
  d.durationMs = 4000;
  return d;
}

const wipe: ClipTransition = { kind: "wipe", durationMs: 500, easing: "linear", angle: 0 };

describe("entrance and exit transitions in playback", () => {
  it("reveal the clip inside its own box, turned with it", () => {
    const d = film(logo({ transitionIn: wipe }));
    const node = videoScene(d, visualPlan(d, 1250)).nodes.find((n) => n.id === "logo")!;
    expect(node.reveal?.box).toEqual(node.box);
    expect(node.reveal?.box.rotation).toBe(30);
    expect(node.reveal?.inverse).toBe(false);
    expect(node.reveal?.polygon?.length).toBeGreaterThan(0);
    expect(Math.max(...node.reveal!.polygon!.filter((_, i) => i % 2 === 0))).toBeCloseTo(node.box.width / 2);
  });

  it("hide the leaving clip through the inverse reveal and stop once the window ends", () => {
    const d = film(logo({ transitionOut: { kind: "radialWipe", durationMs: 400, easing: "linear", softness: 0.1 } }));
    const leaving = videoScene(d, visualPlan(d, 2800)).nodes.find((n) => n.id === "logo")!;
    expect(leaving.reveal).toMatchObject({ inverse: true, field: { field: { pattern: "fan" }, progress: 0.5, softness: 0.1 } });
    expect(videoScene(d, visualPlan(d, 2000)).nodes.find((n) => n.id === "logo")!.reveal).toBeUndefined();
  });

  it("zoom a clip in around a point of its own box", () => {
    const d = film(logo({ transitionIn: { kind: "zoom", durationMs: 400, easing: "linear", originX: 0.5, originY: 0.5, amount: 0.5 } }));
    const entering = visualPlan(d, 1000).find((i) => i.clipId === "logo")!;
    expect(entering.transform.x).toBeCloseTo(BOX.x);
    expect(entering.transform.y).toBeCloseTo(BOX.y);
    expect(entering.transform.w).toBeCloseTo(BOX.w * 1.5);
  });

  it("slide a clip in from outside the frame", () => {
    const d = film(logo({ transitionIn: { kind: "push", durationMs: 500, easing: "linear", direction: "left" } }));
    expect(visualPlan(d, 1000).find((i) => i.clipId === "logo")!.transform.x).toBeCloseTo(BOX.x + 1);
    expect(visualPlan(d, 1500).find((i) => i.clipId === "logo")!.transform.x).toBeCloseTo(BOX.x);
  });
});
