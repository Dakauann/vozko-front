import { describe, expect, it } from "vitest";

import { emptyArtboard, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, newShapeLayer, newTextLayer, type ImageSurface, type Layer } from "../document";
import { artboardScenes, imageScene } from "./image-scene";

const box = { x: 0.5, y: 0.5, w: 0.5, h: 0.25, rotation: 15, opacity: 0.8 };

function art(layers: Layer[]): ImageSurface {
  return { ...emptyArtboard({ width: 1000, height: 800 }, "#ffffff"), layers };
}

const none = { hidden: new Set<string>(), overrides: new Map() };

describe("artboard scenes", () => {
  it("draws every artboard at its place on the board, each with its own background and layers", () => {
    const feed = { ...emptyArtboard({ width: 1080, height: 1080 }, "#ffffff"), id: "feed", layers: [{ ...newShapeLayer("rect"), id: "r" }] };
    const story = { ...emptyArtboard({ width: 1080, height: 1920 }, "#000000"), id: "story", x: 1180, y: 0, layers: [] };
    const scenes = artboardScenes({ schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [feed, story] }, none);
    expect(scenes.map((s) => [s.key, s.origin, s.width, s.height, s.background])).toEqual([
      ["feed", { x: 0, y: 0 }, 1080, 1080, "#ffffff"],
      ["story", { x: 1180, y: 0 }, 1080, 1920, "#000000"],
    ]);
    expect(scenes[0].nodes.map((n) => n.id)).toEqual(["r"]);
  });
});

describe("image scene", () => {
  it("rasterizes each layer once and leaves position, rotation and opacity to the GPU", () => {
    const layer = { ...newTextLayer("Oferta"), id: "t", transform: box };
    const scene = imageScene(art([layer]), none);
    expect(scene).toMatchObject({ width: 1000, height: 800, background: "#ffffff", artboard: true });
    const node = scene.nodes[0];
    expect(node).toMatchObject({ id: "t", fit: "fill", opacity: 0.8, visible: true, box: { x: 500, y: 400, rotation: 15 } });
    expect(node.source.kind).toBe("raster");
    const moved = imageScene(art([{ ...layer, transform: { ...box, x: 0.2, rotation: 40, opacity: 0.3 } }]), none).nodes[0];
    expect(moved.source).toEqual(node.source);
  });

  it("applies image filters and blend modes on the GPU instead of baking them", () => {
    const layer: Layer = { id: "p", type: "image", assetId: "photo", transform: box, filters: { brightness: 0.1, contrast: 0, saturation: 0, blur: 6 }, blendMode: "multiply" };
    const node = imageScene(art([layer]), none).nodes[0];
    expect(node.blend).toBe("multiply");
    expect(node.blurPx).toBe(6);
    expect(node.colorMatrix).toHaveLength(20);
    const plain = imageScene(art([{ ...layer, filters: undefined, blendMode: undefined }]), none).nodes[0];
    expect(plain.source).toEqual(node.source);
  });

  it("leaves filters off text and shapes, as the editor draws them", () => {
    const text = { ...newTextLayer("Oi"), id: "t", transform: box, filters: { brightness: 0.3, contrast: 0, saturation: 0, blur: 4 } };
    const node = imageScene(art([text]), none).nodes[0];
    expect(node.colorMatrix).toBeUndefined();
    expect(node.blurPx).toBeUndefined();
  });

  it("clips a run of layers to the layer under them and hides the whole run with its base", () => {
    const base = { ...newShapeLayer("ellipse"), id: "mask", transform: box };
    const photo = { ...newShapeLayer("rect"), id: "inside", transform: box, clip: true };
    expect(imageScene(art([base, photo]), none).nodes.map((n) => [n.id, n.clipOf ?? null])).toEqual([
      ["mask", null],
      ["inside", "mask"],
    ]);
    expect(imageScene(art([{ ...base, hidden: true }, photo]), none).nodes).toEqual([]);
  });

  it("leaves out layers being edited elsewhere and stretches a layer while it is transformed live", () => {
    const layer = { ...newTextLayer("Oi"), id: "t", transform: box };
    expect(imageScene(art([layer]), { hidden: new Set(["t"]), overrides: new Map() }).nodes).toEqual([]);
    const still = imageScene(art([layer]), none).nodes[0];
    const live = imageScene(art([layer]), { hidden: new Set<string>(), overrides: new Map([["t", { ...box, w: 1, x: 0.6 }]]) }).nodes[0];
    expect(live.source).toEqual(still.source);
    expect(live.box.width).toBeCloseTo(still.box.width * 2, 5);
    expect(live.box.x).toBe(600);
  });
});
