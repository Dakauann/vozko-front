import { describe, expect, it } from "vitest";

import { newIconLayer, newImageLayer, newShapeLayer, newTextLayer, type Layer } from "./document";
import { newEffect } from "./layer-paint";
import { addedEffect, addedFill, addedStroke, effectsPatch, fillsPatch, listedEffects, listedFills, listedStrokes, moved, removed, replaced, strokesPatch } from "./paint-edits";
import { DEFAULT_PATTERN } from "./pattern";
import { layerIssue } from "./validate";

function applied(layer: Layer, patch: Partial<Layer>): Layer {
  return { ...layer, ...patch };
}

describe("paint list edits", () => {
  it("turns the single fill, gradient and pattern into a list and back to the single fields", () => {
    const shape = { ...newShapeLayer("rect"), fill: "#ff0000", pattern: DEFAULT_PATTERN };
    const listed = applied(shape, fillsPatch(listedFills(shape)));
    expect(listed.fill).toBeUndefined();
    expect(listed.pattern).toBeUndefined();
    expect(listed.fills?.map((p) => p.type)).toEqual(["solid", "pattern"]);
    expect(layerIssue(listed)).toBeNull();
    expect(fillsPatch([])).toMatchObject({ fills: undefined });
  });

  it("adds a fill on top and keeps the layer valid", () => {
    const text = applied(newTextLayer("Oi"), addedFill(newTextLayer("Oi")));
    expect(text.fills).toHaveLength(2);
    expect(text.fills?.[1]).toMatchObject({ type: "solid", opacity: 1 });
    expect(layerIssue(text)).toBeNull();
  });

  it("turns the single outline into a stroke that looks the same", () => {
    const text = { ...newTextLayer("Oi"), stroke: "#000000", strokeWidth: 8, dash: true };
    expect(listedStrokes(text)).toEqual([{ type: "solid", color: "#000000", opacity: 1, width: 4, align: "outside", dashArray: [6, 4] }]);
    const photo = { ...newImageLayer("m"), stroke: "#ffffff", strokeWidth: 6, dashArray: [2, 2] };
    expect(listedStrokes(photo)).toEqual([{ type: "solid", color: "#ffffff", opacity: 1, width: 3, align: "outside" }]);
    const listed = applied(photo, strokesPatch(listedStrokes(photo)));
    expect(listed.strokeWidth).toBeUndefined();
    expect(listed.dashArray).toBeUndefined();
    expect(layerIssue(listed)).toBeNull();
  });

  it("adds strokes aligned the way each kind of layer reads best", () => {
    expect(applied(newShapeLayer("rect"), addedStroke(newShapeLayer("rect"))).strokes?.[0]).toMatchObject({ align: "inside", width: 4 });
    expect(applied(newTextLayer("Oi"), addedStroke(newTextLayer("Oi"))).strokes?.[0]).toMatchObject({ align: "outside" });
    const icon = applied(newIconLayer("star"), addedStroke(newIconLayer("star")));
    expect(icon.strokes?.[0]).toMatchObject({ align: "outside", type: "solid" });
    expect(layerIssue(icon)).toBeNull();
  });

  it("turns the single shadow into a drop shadow effect with its own id", () => {
    const shape = { ...newShapeLayer("rect"), shadow: { color: "#00000066", blur: 12, x: 0, y: 6 } };
    const [effect] = listedEffects(shape);
    expect(effect).toMatchObject({ type: "drop-shadow", color: "#00000066", opacity: 1, blur: 12, y: 6, showBehind: true });
    expect(effect.id).not.toBe("shadow");
    const added = applied(shape, addedEffect(shape, "inner-glow"));
    expect(added.shadow).toBeUndefined();
    expect(added.effects?.map((e) => e.type)).toEqual(["drop-shadow", "inner-glow"]);
    expect(new Set(added.effects?.map((e) => e.id)).size).toBe(2);
    expect(layerIssue(added)).toBeNull();
    expect(effectsPatch([])).toEqual({ effects: undefined, shadow: undefined });
  });

  it("replaces, removes and moves list items without touching the rest", () => {
    const list = [newEffect("drop-shadow", "a"), newEffect("outer-glow", "b"), newEffect("inner-glow", "c")];
    expect(replaced(list, 1, newEffect("inner-shadow", "x")).map((e) => e.id)).toEqual(["a", "x", "c"]);
    expect(removed(list, 0).map((e) => e.id)).toEqual(["b", "c"]);
    expect(moved(list, 0, 1).map((e) => e.id)).toEqual(["b", "a", "c"]);
    expect(moved(list, 0, -1)).toBe(list);
    expect(moved(list, 2, 1)).toBe(list);
  });
});
