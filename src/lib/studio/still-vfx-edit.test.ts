import { describe, expect, it } from "vitest";

import { emptyArtboard, fullFrame, newImageLayer, newShapeLayer, type ImageSurface, type Layer } from "./document";
import { addingVfx, editSurfaceVfx, movingVfx, patchingVfx, removingVfx, targetVfx } from "./still-vfx-edit";
import { newVfx } from "./vfx";

const photo: Layer = { ...newImageLayer("media-photo", fullFrame()), id: "photo" };
const box: Layer = { ...newShapeLayer("rect", fullFrame()), id: "box" };

function surface(layers: Layer[] = [photo, box]): ImageSurface {
  return { ...emptyArtboard({ width: 400, height: 400 }, "#ffffff"), layers };
}

describe("still effect edits", () => {
  it("adds, tunes, reorders and removes effects on an image layer", () => {
    let doc = surface();
    const target = { kind: "layer", layerId: "photo" } as const;
    for (const vfx of [newVfx("grain", "g", 3), newVfx("vignette", "v", 0)]) {
      const step = editSurfaceVfx(doc, target, addingVfx(vfx));
      if (!step.ok) throw new Error(step.reason);
      doc = step.surface;
    }
    expect(targetVfx(doc, target)?.map((vfx) => vfx.id)).toEqual(["g", "v"]);
    const tuned = editSurfaceVfx(doc, target, patchingVfx("g", { params: { amount: 0.8 }, seed: 9, hidden: true }));
    if (!tuned.ok) throw new Error(tuned.reason);
    expect(targetVfx(tuned.surface, target)?.[0]).toMatchObject({ seed: 9, hidden: true, params: { amount: 0.8 } });
    const moved = editSurfaceVfx(tuned.surface, target, movingVfx("v", 0));
    if (!moved.ok) throw new Error(moved.reason);
    expect(targetVfx(moved.surface, target)?.map((vfx) => vfx.id)).toEqual(["v", "g"]);
    const removed = editSurfaceVfx(moved.surface, target, removingVfx("v"));
    if (!removed.ok) throw new Error(removed.reason);
    const cleared = editSurfaceVfx(removed.surface, target, removingVfx("g"));
    if (!cleared.ok) throw new Error(cleared.reason);
    expect(cleared.surface.layers[0].vfx).toBeUndefined();
    expect("vfx" in cleared.surface.layers[0]).toBe(false);
  });

  it("puts artboard effects on the canvas, over everything below", () => {
    const step = editSurfaceVfx(surface(), { kind: "canvas" }, addingVfx(newVfx("lightLeak", "l", 5)));
    if (!step.ok) throw new Error(step.reason);
    expect(step.surface.canvas.vfx?.map((vfx) => vfx.kind)).toEqual(["lightLeak"]);
    const gone = editSurfaceVfx(step.surface, { kind: "canvas" }, removingVfx("l"));
    if (!gone.ok) throw new Error(gone.reason);
    expect("vfx" in gone.surface.canvas).toBe(false);
  });

  it("refuses what a still picture cannot hold and leaves the surface alone", () => {
    const start = surface([photo, box, { ...photo, id: "held", locked: true }]);
    const layer = { kind: "layer", layerId: "photo" } as const;
    expect(editSurfaceVfx(start, layer, addingVfx(newVfx("particles", "p", 1)))).toEqual({ ok: false, reason: "invalid" });
    expect(editSurfaceVfx(start, layer, patchingVfx("nope", { seed: 2 }))).toEqual({ ok: false, reason: "vfxMissing" });
    expect(editSurfaceVfx(start, { kind: "layer", layerId: "box" }, addingVfx(newVfx("grain", "g", 1)))).toEqual({ ok: false, reason: "notImage" });
    expect(editSurfaceVfx(start, { kind: "layer", layerId: "ghost" }, addingVfx(newVfx("grain", "g", 1)))).toEqual({ ok: false, reason: "missing" });
    expect(editSurfaceVfx(start, { kind: "layer", layerId: "held" }, addingVfx(newVfx("grain", "g", 1)))).toEqual({ ok: false, reason: "locked" });
    const added = editSurfaceVfx(start, layer, addingVfx(newVfx("grain", "g", 1)));
    if (!added.ok) throw new Error(added.reason);
    expect(editSurfaceVfx(added.surface, layer, patchingVfx("g", { params: { rate: 4 } }))).toEqual({ ok: false, reason: "invalid" });
    expect(editSurfaceVfx(added.surface, layer, patchingVfx("g", { params: { amount: 4 } }))).toEqual({ ok: false, reason: "invalid" });
    expect(editSurfaceVfx(added.surface, layer, addingVfx(newVfx("vignette", "g", 1)))).toEqual({ ok: false, reason: "invalid" });
  });
});
