import { describe, expect, it } from "vitest";

import { emptyArtboard, newImageLayer, newMediaClip, newShapeLayer, newTextLayer, type ImageSurface, type Layer, type Transform } from "./document";
import { clipImageSource, clipSlotAsset, imageSourcesOf, slotAsset, withSlotAsset } from "./image-sources";
import { DEFAULT_PATTERN } from "./pattern";

function box(x: number, y: number, w: number, h: number): Transform {
  return { x, y, w, h, rotation: 0, opacity: 1 };
}

function surface(layers: Layer[], groups?: ImageSurface["groups"]): ImageSurface {
  return { ...emptyArtboard({ width: 1000, height: 1000 }), layers, ...(groups ? { groups } : {}) };
}

const frame = (id: string, groupId?: string): Layer => ({ ...newShapeLayer("rect", box(0.5, 0.5, 0.4, 0.4)), id, ...(groupId ? { groupId } : {}) });
const photo = (id: string, assetId: string, groupId?: string): Layer => ({ ...newImageLayer(assetId, box(0.5, 0.5, 0.4, 0.4)), id, clip: true, ...(groupId ? { groupId } : {}) });
const patterned = (id: string, assetId: string): Layer => ({ ...newShapeLayer("rect"), id, pattern: { ...DEFAULT_PATTERN, source: "asset", presetId: "", assetId } });

describe("what an element shows as its image", () => {
  it("takes a plain image layer as its own image", () => {
    const doc = surface([{ ...newImageLayer("foto"), id: "i" }]);
    expect(imageSourcesOf(doc, ["i"])).toEqual([{ layerId: "i", slot: "asset", assetId: "foto", framed: false }]);
  });

  it("reads a frame holding a photo as the photo inside it", () => {
    const doc = surface([frame("f"), photo("p", "foto")]);
    expect(imageSourcesOf(doc, ["f"])).toEqual([{ layerId: "p", slot: "asset", assetId: "foto", framed: true }]);
    expect(imageSourcesOf(doc, ["p"])).toEqual([{ layerId: "p", slot: "asset", assetId: "foto", framed: true }]);
    expect(imageSourcesOf(doc, ["f", "p"])).toHaveLength(1);
  });

  it("sees no image in an empty frame or a plain shape", () => {
    expect(imageSourcesOf(surface([frame("f")]), ["f"])).toEqual([]);
    expect(imageSourcesOf(surface([{ ...newTextLayer("Oi"), id: "t" }]), ["t"])).toEqual([]);
  });

  it("reads a shape filled with an image pattern, in the old field or in a fill paint", () => {
    expect(imageSourcesOf(surface([patterned("s", "textura")]), ["s"])).toEqual([{ layerId: "s", slot: "pattern", assetId: "textura", framed: false }]);
    const painted: Layer = { ...newShapeLayer("rect"), id: "s", fills: [{ type: "solid", color: "#fff", opacity: 1 }, { type: "pattern", opacity: 1, pattern: { ...DEFAULT_PATTERN, source: "asset", presetId: "", assetId: "papel" } }] };
    expect(imageSourcesOf(surface([painted]), ["s"])).toEqual([{ layerId: "s", slot: 1, assetId: "papel", framed: false }]);
  });

  it("reads a mockup group by the photo on its screen", () => {
    const chrome: Layer = { ...newShapeLayer("rect"), id: "corpo", groupId: "m" };
    const doc = surface([chrome, frame("tela", "m"), photo("p", "print", "m")], [{ id: "m", baseId: "corpo" }]);
    expect(imageSourcesOf(doc, ["corpo", "tela", "p"])).toEqual([{ layerId: "p", slot: "asset", assetId: "print", framed: true }]);
    expect(imageSourcesOf(doc, ["tela"])).toEqual([{ layerId: "p", slot: "asset", assetId: "print", framed: true }]);
  });

  it("reads a grid cell by its photo and a whole grid by every photo", () => {
    const base: Layer = { ...newShapeLayer("rect"), id: "base", groupId: "grid" };
    const doc = surface([base, frame("c1", "grid"), photo("p1", "a", "grid"), frame("c2", "grid"), photo("p2", "b", "grid")], [{ id: "grid", baseId: "base", layout: { direction: "horizontal", width: "fixed", height: "fixed" } }]);
    expect(imageSourcesOf(doc, ["c2"]).map((s) => s.layerId)).toEqual(["p2"]);
    expect(imageSourcesOf(doc, ["base", "c1", "p1", "c2", "p2"]).map((s) => s.layerId)).toEqual(["p1", "p2"]);
  });

  it("keeps an image layer that is still loading as a source without media", () => {
    const loading: Layer = { ...newImageLayer("x"), id: "i", assetId: undefined };
    expect(imageSourcesOf(surface([loading]), ["i"])).toEqual([{ layerId: "i", slot: "asset", assetId: null, framed: false }]);
  });
});

describe("what a clip shows as its image", () => {
  it("takes an image clip, an image overlay and an overlay shape filled with a picture", () => {
    expect(clipImageSource(newMediaClip("image", "foto", 0, 1000))).toEqual({ slot: "clip", assetId: "foto" });
    const overlay = (layer: Layer) => ({ ...newMediaClip("image", "x", 0, 1000), type: "overlay" as const, assetId: undefined, layer });
    expect(clipImageSource(overlay({ ...newImageLayer("logo"), id: "l" }))).toEqual({ slot: "asset", assetId: "logo" });
    expect(clipImageSource(overlay(patterned("s", "textura")))).toEqual({ slot: "pattern", assetId: "textura" });
    expect(clipImageSource(overlay({ ...newTextLayer("Oi"), id: "t" }))).toBeNull();
    expect(clipImageSource(newMediaClip("audio", "som", 0, 1000))).toBeNull();
  });

  it("reads the picture a clip job slot shows now", () => {
    const overlay = (layer: Layer) => ({ ...newMediaClip("image", "x", 0, 1000), type: "overlay" as const, assetId: undefined, layer });
    expect(clipSlotAsset(newMediaClip("image", "foto", 0, 1000), undefined)).toBe("foto");
    expect(clipSlotAsset(newMediaClip("audio", "som", 0, 1000), undefined)).toBe("som");
    expect(clipSlotAsset(overlay({ ...newImageLayer("logo"), id: "l" }), "asset")).toBe("logo");
    expect(clipSlotAsset(overlay(patterned("s", "textura")), "pattern")).toBe("textura");
    expect(clipSlotAsset(newMediaClip("image", "foto", 0, 1000), "asset")).toBeNull();
  });
});

describe("writing a new picture into the place it came from", () => {
  it("swaps only the picture and keeps the crop, the frame and the rest of the fill", () => {
    const framed: Layer = { ...photo("p", "foto"), crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.5 } };
    expect(withSlotAsset(framed, "asset", "novo")).toEqual({ assetId: "novo" });
    const shape = patterned("s", "textura");
    expect(withSlotAsset(shape, "pattern", "nova")).toEqual({ pattern: { ...shape.pattern, assetId: "nova" } });
    const painted: Layer = { ...newShapeLayer("rect"), id: "s", fills: [{ type: "solid", color: "#fff", opacity: 1 }, { type: "pattern", opacity: 0.5, pattern: { ...DEFAULT_PATTERN, source: "asset", presetId: "", assetId: "papel" } }] };
    const patch = withSlotAsset(painted, 1, "novo");
    expect(patch.fills?.[0]).toBe(painted.fills![0]);
    expect(patch.fills?.[1]).toEqual({ ...painted.fills![1], pattern: { ...painted.fills![1].pattern, assetId: "novo" } });
  });

  it("reads the picture currently in a place", () => {
    expect(slotAsset(photo("p", "foto"), "asset")).toBe("foto");
    expect(slotAsset(patterned("s", "textura"), "pattern")).toBe("textura");
    expect(slotAsset(newShapeLayer("rect"), 0)).toBeNull();
  });
});
