import { describe, expect, it } from "vitest";

import { emptyArtboard, newImageLayer, type ImageSurface, type Layer } from "../document";
import { stillLooks } from "../still-vfx";
import { newVfx } from "../vfx";
import { imageScene } from "./image-scene";

const none = { hidden: new Set<string>(), overrides: new Map() };
const box = { x: 0.25, y: 0.5, w: 0.4, h: 0.5, rotation: 12, opacity: 1 };

function art(layers: Layer[], vfx?: ImageSurface["canvas"]["vfx"]): ImageSurface {
  const board = emptyArtboard({ width: 1000, height: 800 }, "#ffffff");
  return { ...board, canvas: { ...board.canvas, ...(vfx ? { vfx } : {}) }, layers };
}

describe("still effects in the image scene", () => {
  it("draws a picture's effects on the GPU over the exact picture box, not the padded raster", () => {
    const vfx = [newVfx("grain", "g", 3), { ...newVfx("vignette", "v", 0), hidden: true }, newVfx("lightLeak", "l", 8)];
    const photo: Layer = { ...newImageLayer("photo", box), id: "p", vfx, strokeWidth: 6, stroke: "#000000" };
    const node = imageScene(art([photo]), none).nodes[0];
    expect(node.vfx).toEqual(stillLooks(vfx));
    expect(node.vfxFrame).toEqual({ x: 250, y: 400, width: 400, height: 400, rotation: 12 });
    expect(node.box.width).toBeGreaterThan(400);
    expect(node.source.kind === "raster" && node.source.layer.vfx).toBeUndefined();
  });

  it("keeps the raster when only the effects change", () => {
    const photo: Layer = { ...newImageLayer("photo", box), id: "p" };
    const plain = imageScene(art([photo]), none).nodes[0];
    const tuned = imageScene(art([{ ...photo, vfx: [newVfx("grain", "g", 3)] }]), none).nodes[0];
    expect(tuned.source).toEqual(plain.source);
    expect(plain.vfx).toBeUndefined();
  });

  it("adds an artboard effect as one adjustment over everything below", () => {
    const photo: Layer = { ...newImageLayer("photo", box), id: "p" };
    const vfx = [newVfx("vignette", "v", 0)];
    const scene = imageScene(art([photo], vfx), none);
    expect(scene.nodes.map((node) => node.source.kind)).toEqual(["raster", "effect"]);
    const adjust = scene.nodes[1];
    expect(adjust).toMatchObject({ box: { x: 500, y: 400, width: 1000, height: 800, rotation: 0 }, opacity: 1, visible: true, vfx: stillLooks(vfx) });
    expect(imageScene(art([photo], [{ ...vfx[0], hidden: true }]), none).nodes).toHaveLength(1);
  });
});
