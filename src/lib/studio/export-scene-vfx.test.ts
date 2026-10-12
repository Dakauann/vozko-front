import { describe, expect, it } from "vitest";

import { emptyArtboard, fullFrame, newImageLayer, newShapeLayer, type ImageSurface, type Layer } from "./document";
import { exportScene } from "./export-scene";
import { newVfx } from "./vfx";

function surface(layers: Layer[], vfx?: ImageSurface["canvas"]["vfx"]): ImageSurface {
  const board = emptyArtboard({ width: 400, height: 300 }, "#203040");
  return { ...board, canvas: { ...board.canvas, ...(vfx ? { vfx } : {}) }, layers };
}

const box: Layer = { ...newShapeLayer("rect", { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }), id: "box", fill: "#ff0000" };

describe("vector exports with still effects", () => {
  it("flattens the whole artboard into one patch with the artboard effects when they adjust everything below", () => {
    const vfx = [newVfx("vignette", "v", 0)];
    const scene = exportScene(surface([box], vfx), { transparent: false });
    expect(scene.background).toBeNull();
    expect(scene.items).toEqual([{ kind: "raster", id: "r0", layerIds: ["box"], bounds: { x: 0, y: 0, width: 400, height: 300 }, blend: "normal", backdrop: { background: "#203040" }, vfx }]);
  });

  it("keeps vectors when every artboard effect is hidden", () => {
    const scene = exportScene(surface([box], [{ ...newVfx("vignette", "v", 0), hidden: true }]), { transparent: false });
    expect(scene.items.map((item) => item.kind)).toEqual(["vector"]);
  });

  it("draws a picture with effects as a raster patch", () => {
    const photo: Layer = { ...newImageLayer("photo", fullFrame()), id: "photo", vfx: [newVfx("grain", "g", 1)] };
    const scene = exportScene(surface([box, photo]), { transparent: true });
    expect(scene.items.map((item) => item.kind)).toEqual(["vector", "raster"]);
    expect(scene.items[1]).toMatchObject({ layerIds: ["photo"] });
    expect("vfx" in scene.items[1]).toBe(false);
  });
});
