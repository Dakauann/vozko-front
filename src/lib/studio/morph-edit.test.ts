import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newPathLayer, newShapeLayer, newTextLayer, type Clip, type Layer, type VideoDocument } from "./document";
import { keyframeCount, morphFramesOf, removeKeyframe } from "./keyframes";
import { laneProperties, recordMoment, toggleAnimation } from "./keyframe-edit";
import { convertClipToPath, editClipPath, setFirstVertex, setPathKeys, togglePathKey } from "./morph-edit";
import { morphPath } from "./path-morph";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { splitClip, findClip } from "./timeline";
import { documentIssue } from "./validate";

const SQUARE = "M0 0 L1 0 L1 1 L0 1 Z";
const STAR = "M0.5 0 L0.62 0.35 L1 0.35 L0.69 0.57 L0.81 0.91 L0.5 0.7 L0.19 0.91 L0.31 0.57 L0 0.35 L0.38 0.35 Z";

function film(layer: Layer, extra: Partial<Clip> = {}): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.tracks = [{ id: "v", kind: "visual", clips: [{ ...newOverlayClip(layer, 0, 2000, { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }), id: "shape", ...extra }] }];
  doc.durationMs = 2000;
  return doc;
}

function clipOf(doc: VideoDocument): Clip {
  return findClip(doc, "shape")!.clip;
}

function done(edit: ReturnType<typeof togglePathKey>): VideoDocument {
  if (!edit.ok) throw new Error(edit.reason);
  return edit.document;
}

describe("path keys on overlays", () => {
  it("turns a rectangle into a path and keys its outline", () => {
    const keyed = done(togglePathKey(film(newShapeLayer("rect")), "shape", 0));
    const clip = clipOf(keyed);
    expect(clip.layer?.shape).toBe("path");
    expect(morphFramesOf(clip.keyframes)).toEqual([{ atMs: 0, path: clip.layer!.path, easing: "linear" }]);
    expect(documentIssue("video", keyed)).toBeNull();
  });

  it("converts a shape to a path without keys", () => {
    const converted = clipOf(done(convertClipToPath(film(newShapeLayer("ellipse")), "shape")));
    expect(converted.layer?.shape).toBe("path");
    expect(converted.keyframes).toBeUndefined();
  });

  it("refuses text, lines and media", () => {
    expect(togglePathKey(film(newTextLayer("Oi")), "shape", 0)).toEqual({ ok: false, reason: "notShape" });
    expect(togglePathKey(film(newShapeLayer("line")), "shape", 0)).toEqual({ ok: false, reason: "notShape" });
    const doc = emptyVideoDocument("square");
    doc.tracks = [{ id: "v", kind: "visual", clips: [{ ...newMediaClip("image", "m", 0, 1000), id: "shape" }] }];
    doc.durationMs = 1000;
    expect(togglePathKey(doc, "shape", 0)).toEqual({ ok: false, reason: "notShape" });
  });

  it("writes a key where the path is edited once it animates, and refuses an edit away from the clip", () => {
    const base = done(setPathKeys(film(newPathLayer(SQUARE)), "shape", [
      { atMs: 0, path: SQUARE, easing: "linear" },
      { atMs: 1000, path: STAR, easing: "linear" },
    ]));
    const edited = done(editClipPath(base, "shape", "M0 0 L1 1 L0 1 Z", 500));
    expect(morphFramesOf(clipOf(edited).keyframes).map((key) => key.atMs)).toEqual([0, 500, 1000]);
    expect(editClipPath(base, "shape", SQUARE, null)).toEqual({ ok: false, reason: "animated" });
    expect(editClipPath(base, "shape", "nonsense", 500)).toEqual({ ok: false, reason: "badPath" });
    const still = done(editClipPath(film(newPathLayer(SQUARE)), "shape", STAR, null));
    expect(clipOf(still).layer?.path).toBe(STAR);
  });

  it("refuses keys outside the clip and paths that do not parse", () => {
    const doc = film(newPathLayer(SQUARE));
    expect(setPathKeys(doc, "shape", [{ atMs: 2500, path: STAR, easing: "linear" }])).toEqual({ ok: false, reason: "outside" });
    expect(setPathKeys(doc, "shape", [{ atMs: 0, path: "Q", easing: "linear" }])).toEqual({ ok: false, reason: "badPath" });
  });

  it("sets and clears the first vertex of a key", () => {
    const keyed = done(togglePathKey(film(newPathLayer(SQUARE)), "shape", 0));
    const pinned = done(setFirstVertex(keyed, "shape", 0, { x: 1, y: 1 }));
    expect(morphFramesOf(clipOf(pinned).keyframes)[0].firstVertex).toEqual({ x: 1, y: 1 });
    const cleared = done(setFirstVertex(pinned, "shape", 0, null));
    expect(morphFramesOf(clipOf(cleared).keyframes)[0].firstVertex).toBeUndefined();
    expect(setFirstVertex(keyed, "shape", 700, { x: 0, y: 0 })).toEqual({ ok: false, reason: "noKey" });
  });

  it("leaves the last shape as the still path when the last key goes", () => {
    const keyed = done(setPathKeys(film(newPathLayer(SQUARE)), "shape", [{ atMs: 300, path: STAR, easing: "linear" }]));
    const cleared = clipOf(done(togglePathKey(keyed, "shape", 300)));
    expect(cleared.keyframes).toBeUndefined();
    expect(cleared.layer?.path).toBe(STAR);
  });

  it("shows the path lane on path shapes, records it in a moment and stops it into a still path", () => {
    const doc = done(setPathKeys(film(newPathLayer(SQUARE)), "shape", [
      { atMs: 0, path: SQUARE, easing: "linear" },
      { atMs: 1000, path: STAR, easing: "linear" },
    ]));
    const clip = clipOf(doc);
    expect(laneProperties(clip)).toContain("path");
    expect(laneProperties(clipOf(film(newShapeLayer("rect"))))).not.toContain("path");
    const moment = recordMoment(clip, 500, 1);
    expect(morphFramesOf(moment.keyframes).find((key) => key.atMs === 500)?.path).toBe(morphPath(SQUARE, STAR, 0.5));
    const stopped = toggleAnimation(clip, "path", 500, 1);
    expect(stopped.keyframes).toBeUndefined();
    expect(stopped.layer?.path).toBe(morphPath(SQUARE, STAR, 0.5));
  });

  it("draws the morphed path on every frame and marks the scene node as live", () => {
    const doc = done(setPathKeys(film(newPathLayer(SQUARE)), "shape", [
      { atMs: 0, path: SQUARE, easing: "easeIn" },
      { atMs: 1000, path: STAR, easing: "linear" },
    ]));
    const item = visualPlan(doc, 500).find((entry) => entry.clipId === "shape")!;
    expect(item.layer?.path).toBe(morphPath(SQUARE, STAR, 0.125));
    expect(item.live).toBe(true);
    const scene = videoScene(doc, visualPlan(doc, 500));
    expect(scene.nodes[0].live).toBe(true);
    expect(scene.nodes[0].source.kind === "raster" && scene.nodes[0].source.layer.path).toBe(morphPath(SQUARE, STAR, 0.125));
    expect(videoScene(film(newPathLayer(SQUARE)), visualPlan(film(newPathLayer(SQUARE)), 500)).nodes[0].live).toBeUndefined();
  });

  it("carries the keys into the right piece of a split", () => {
    const doc = done(setPathKeys(film(newPathLayer(SQUARE)), "shape", [
      { atMs: 0, path: SQUARE, easing: "linear" },
      { atMs: 1000, path: STAR, easing: "linear" },
    ]));
    const split = splitClip(doc, "shape", 400);
    const right = findClip(split.document, split.clipId!)!.clip;
    expect(morphFramesOf(right.keyframes).map((key) => key.atMs)).toEqual([-400, 600]);
    expect(documentIssue("video", split.document)).toBeNull();
  });

  it("validates path keys like the backend does", () => {
    const doc = film(newPathLayer(SQUARE), { keyframes: { path: [{ atMs: 0, path: SQUARE, easing: "linear" }] } });
    expect(documentIssue("video", doc)).toBeNull();
    expect(documentIssue("video", film(newShapeLayer("rect"), { keyframes: { path: [{ atMs: 0, path: SQUARE, easing: "linear" }] } }))?.code).toBe("invalid");
    expect(documentIssue("video", film(newPathLayer(SQUARE), { keyframes: { path: [{ atMs: 0, path: "L1 1", easing: "linear" }] } }))?.code).toBe("invalid");
    expect(documentIssue("video", film(newPathLayer(SQUARE), { keyframes: { path: [{ atMs: 0, path: SQUARE, easing: "linear", firstVertex: { x: 1001, y: 0 } }] } }))?.code).toBe("out_of_range");
    expect(keyframeCount(removeKeyframe(clipOf(doc).keyframes, "path", 0))).toBe(0);
  });

  it("accepts the same morph document the backend contract test reads", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_morph.json"), "utf8"));
    expect(documentIssue("video", raw)).toBeNull();
  });
});
