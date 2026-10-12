import { describe, expect, it } from "vitest";

import { sceneLens, tiltMatrix } from "../clip-tilt";
import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "../document";
import { unitPieces } from "../glyph-layout";
import { visualPlan } from "../playback";
import { textUnitFrames, type LaidLine } from "../text-animation";
import { newRangeSelector, newTextUnitAnimator } from "../text-animator";
import { animatorFrameAt, type AnimatorProperties } from "../text-selectors";
import { videoScene } from "./video-scene";

function film(clip: Clip, perspective?: number): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  if (perspective !== undefined) doc.canvas.perspective = perspective;
  doc.tracks = [{ id: "t-1", kind: "visual", clips: [clip] }];
  doc.durationMs = 2000;
  return doc;
}

const picture = (patch: Partial<Clip>): Clip => ({ ...newMediaClip("image", "m-1", 0, 2000), id: "c-1", transform: { x: 0.4, y: 0.5, w: 0.3, h: 0.3, rotation: 10, opacity: 1 }, ...patch });

describe("a clip turned in depth in the scene", () => {
  it("carries the matrix of its drawn box through the project lens", () => {
    const doc = film(picture({ rotationY: 45, anchor: { x: 0, y: 0.5 } }), 60);
    const item = visualPlan(doc, 500)[0];
    const node = videoScene(doc, [item]).nodes[0];
    const t = item.transform;
    const box = { x: t.x * 1920, y: t.y * 1080, width: t.w * 1920, height: t.h * 1080, rotation: t.rotation };
    expect(item.tilt).toEqual({ x: 0, y: 45, anchor: { x: 0, y: 0.5 } });
    const want = tiltMatrix(sceneLens({ perspective: 60 }, { width: 1920, height: 1080 }), box, item.tilt!);
    expect([node.tilt?.width, node.tilt?.height]).toEqual([1920, 1080]);
    node.tilt!.matrix.forEach((value, i) => expect(value).toBeCloseTo(want[i], 6));
  });

  it("follows the keys over time", () => {
    const doc = film(picture({ keyframes: { rotationX: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 90, easing: "linear" }] } }));
    expect(visualPlan(doc, 0)[0].tilt).toBeUndefined();
    expect(visualPlan(doc, 500)[0].tilt).toMatchObject({ x: 45, y: 0 });
  });

  it("leaves a level clip without a matrix", () => {
    const doc = film(picture({}));
    expect(videoScene(doc, visualPlan(doc, 500)).nodes[0].tilt).toBeUndefined();
  });
});

describe("letters turned in depth", () => {
  const lines: LaidLine[] = [{ top: 0, height: 40, chars: ["A", "B", " ", "C", "D"].map((char, i) => ({ char, left: i * 20, right: i * 20 + 20 })) }];
  const animator = (unit: "char" | "word", properties: AnimatorProperties) => animatorFrameAt(newTextUnitAnimator(unit, properties, newRangeSelector(1)), 0);
  const frames = (...animators: ReturnType<typeof animator>[]) => textUnitFrames({ animators, localMs: 0, durationMs: 1000 }, lines, 100, 40);

  it("turns each letter around its own middle", () => {
    const even: LaidLine[] = [{ top: 0, height: 40, chars: ["A", "B", "C", "D"].map((char, i) => ({ char, left: i * 20, right: i * 20 + 20 })) }];
    const pieces = unitPieces(textUnitFrames({ animators: [animator("char", { rotationY: 60 })], localMs: 0, durationMs: 1000 }, even, 80, 40), 80, 40);
    expect(pieces.every((piece) => piece.rotationY === 60 && piece.depth === undefined)).toBe(true);
  });

  it("swings the letters of a word around the middle of the word", () => {
    const looks = frames(animator("word", { rotationY: 90 }), animator("char", { x: 0 })).map((frame) => frame.look);
    expect(looks.every((look) => look.rotationY === 90)).toBe(true);
    expect(looks[0].depth).toBeLessThan(0);
    expect(looks[1].depth).toBeGreaterThan(0);
  });

  it("gives a text node the lens when an animator turns letters in depth", () => {
    const text = newOverlayClip({ ...newTextLayer("Oi"), id: "l-text" }, 0, 2000, { x: 0.5, y: 0.5, w: 0.5, h: 0.2, rotation: 0, opacity: 1 });
    const turned = film({ ...text, id: "c-text", textAnimators: [newTextUnitAnimator("char", { rotationX: 90 }, newRangeSelector(1))] }, 0);
    const flat = film({ ...text, id: "c-text", textAnimators: [newTextUnitAnimator("char", { opacity: 0 }, newRangeSelector(1))] });
    expect(videoScene(turned, visualPlan(turned, 500)).nodes[0].lens).toEqual(sceneLens({ perspective: 0 }, { width: 1920, height: 1080 }));
    expect(videoScene(flat, visualPlan(flat, 500)).nodes[0].lens).toBeUndefined();
  });
});
