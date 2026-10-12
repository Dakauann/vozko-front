import { describe, expect, it } from "vitest";

import { applyFramedCrop, clampFramedBox, coverCrop, cropFrame } from "./crop";
import { emptyArtboard, newImageLayer, newPathLayer, newShapeLayer, type ImageSurface, type Layer, type Transform } from "./document";
import { fillFrame, fillTargetAt, fillTargetOf, isFrameSlot } from "./frame-fill";
import { replaceImageAsset } from "./image-edits";
import { clipRuns } from "./paint";

const BOARD = { width: 1000, height: 1000 };

function box(x: number, y: number, w: number, h: number, rotation = 0): Transform {
  return { x, y, w, h, rotation, opacity: 1 };
}

function surface(layers: Layer[], groups: ImageSurface["groups"] = undefined): ImageSurface {
  return { ...emptyArtboard(BOARD), layers, ...(groups ? { groups } : {}) };
}

function circle(id = "frame", transform = box(0.5, 0.5, 0.4, 0.4)): Layer {
  return { ...newShapeLayer("ellipse", transform), id };
}

describe("frame slots", () => {
  it("takes closed shapes and refuses lines, open paths, clipped shapes and scaffold bases", () => {
    const open = { ...newPathLayer("M0 0 L1 1", box(0.5, 0.5, 0.2, 0.2), true), id: "open" };
    const closed = { ...newPathLayer("M0 0 L1 0 L1 1 Z", box(0.5, 0.5, 0.2, 0.2)), id: "closed" };
    const line = { ...newShapeLayer("line"), id: "line" };
    const base = { ...newShapeLayer("rect"), id: "base", groupId: "g" };
    const doc = surface([circle(), open, closed, line, base], [{ id: "g", baseId: "base" }]);
    expect(doc.layers.map((layer) => isFrameSlot(doc, layer))).toEqual([true, false, true, false, false]);
  });
});

describe("filling a frame with a photo", () => {
  it("adds a clipped photo right above the frame with the frame box and a centered cover crop", () => {
    const doc = surface([circle(), { ...newShapeLayer("rect"), id: "over" }]);
    const outcome = fillFrame(doc, { frameId: "frame" }, "photo-1", { width: 2000, height: 1000 });
    if (!outcome.ok) throw new Error(outcome.reason);
    const ids = outcome.document.layers.map((layer) => layer.id);
    expect(ids).toEqual(["frame", outcome.photoId, "over"]);
    const photo = outcome.document.layers[1];
    expect(photo).toMatchObject({ type: "image", assetId: "photo-1", clip: true, transform: box(0.5, 0.5, 0.4, 0.4) });
    expect(photo.crop).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 });
    expect(clipRuns(outcome.document.layers)[0].map((layer) => layer.id)).toEqual(["frame", outcome.photoId]);
  });

  it("joins the frame's group and keeps its rotation", () => {
    const frame = { ...circle("frame", box(0.3, 0.3, 0.2, 0.1, 30)), groupId: "g" };
    const outcome = fillFrame(surface([frame], [{ id: "g" }]), { frameId: "frame" }, "photo-1", { width: 100, height: 100 });
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.document.layers[1]).toMatchObject({ groupId: "g", transform: box(0.3, 0.3, 0.2, 0.1, 30), crop: { x: 0, y: 0.25, w: 1, h: 0.5 } });
  });

  it("replaces the photo of a filled frame and recenters the crop for the new picture", () => {
    const photo: Layer = { ...newImageLayer("old", box(0.5, 0.5, 0.4, 0.4)), id: "photo", clip: true, crop: { x: 0, y: 0, w: 0.5, h: 1 } };
    const doc = surface([circle(), photo]);
    expect(fillTargetOf(doc, "frame")).toEqual({ frameId: "frame", photoId: "photo" });
    expect(fillTargetOf(doc, "photo")).toEqual({ frameId: "frame", photoId: "photo" });
    const outcome = fillFrame(doc, { frameId: "frame", photoId: "photo" }, "new", { width: 500, height: 500 });
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.document.layers).toHaveLength(2);
    expect(outcome.document.layers[1]).toMatchObject({ assetId: "new", transform: box(0.5, 0.5, 0.4, 0.4) });
    expect(outcome.document.layers[1].crop).toBeUndefined();
  });

  it("refuses locked frames and photos and things that are not frames", () => {
    const locked = surface([{ ...circle(), locked: true }]);
    expect(fillFrame(locked, { frameId: "frame" }, "a", BOARD)).toEqual({ ok: false, reason: "locked" });
    const text = surface([{ ...newShapeLayer("line"), id: "frame" }]);
    expect(fillFrame(text, { frameId: "frame" }, "a", BOARD)).toEqual({ ok: false, reason: "noFrame" });
  });
});

describe("finding the frame under a dropped photo", () => {
  it("picks the topmost frame or framed photo under the point and nothing over plain layers", () => {
    const photo: Layer = { ...newImageLayer("p", box(0.25, 0.5, 0.3, 0.3)), id: "photo", clip: true };
    const doc = surface([circle("left", box(0.25, 0.5, 0.3, 0.3)), photo, circle("right", box(0.75, 0.5, 0.3, 0.3)), { ...newShapeLayer("line", box(0.75, 0.2, 0.3, 0.05)), id: "line" }]);
    expect(fillTargetAt(doc, { x: 250, y: 500 })).toEqual({ frameId: "left", photoId: "photo" });
    expect(fillTargetAt(doc, { x: 750, y: 500 })).toEqual({ frameId: "right" });
    expect(fillTargetAt(doc, { x: 750, y: 200 })).toBeNull();
    expect(fillTargetAt(doc, { x: 50, y: 50 })).toBeNull();
  });

  it("looks through the invisible base of an auto layout grid", () => {
    const base = { ...newShapeLayer("rect", box(0.5, 0.5, 1, 1)), id: "base", groupId: "grid" };
    const cell = { ...newShapeLayer("rect", box(0.5, 0.5, 0.4, 0.4)), id: "cell", groupId: "grid" };
    const doc = surface([cell, base], [{ id: "grid", baseId: "base", layout: { direction: "horizontal", width: "fixed", height: "fixed" } }]);
    expect(fillTargetAt(doc, { x: 500, y: 500 })).toEqual({ frameId: "cell" });
  });
});

describe("crop inside a frame", () => {
  it("covers the box with the middle of the picture", () => {
    const crop = coverCrop({ width: 300, height: 100 }, { w: 0.2, h: 0.2 }, BOARD)!;
    expect([crop.x, crop.y, crop.w, crop.h].map((value) => Number(value.toFixed(6)))).toEqual([0.333333, 0, 0.333333, 1]);
    expect(coverCrop({ width: 100, height: 100 }, { w: 0.2, h: 0.2 }, BOARD)).toBeUndefined();
  });

  it("keeps the frame ratio while panning and zooming and never moves the photo box", () => {
    const photo: Layer = { ...newImageLayer("p", box(0.5, 0.5, 0.4, 0.2)), clip: true, crop: { x: 0, y: 0.25, w: 1, h: 0.5 } };
    const frame = cropFrame(photo, BOARD);
    const clamped = clampFramedBox({ left: -50, top: 10, width: 300, height: 999 }, frame, 2);
    expect(clamped).toEqual({ left: 0, top: 10, width: 300, height: 150 });
    const result = applyFramedCrop(photo, frame, { left: 100, top: 100, width: 200, height: 100 }, BOARD);
    expect(result.crop).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.25 });
    expect(Object.keys(result)).toEqual(["crop"]);
  });

  it("replacing a clipped photo keeps its box and covers it", () => {
    const photo: Layer = { ...newImageLayer("p", box(0.5, 0.5, 0.4, 0.2)), clip: true };
    expect(replaceImageAsset(photo, "q", { width: 100, height: 100 }, BOARD)).toEqual({ assetId: "q", crop: { x: 0, y: 0.25, w: 1, h: 0.5 } });
  });
});
