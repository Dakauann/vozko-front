import { describe, expect, it } from "vitest";

import { emptyArtboard, newShapeLayer, type Layer, type Transform } from "./document";
import { layerStackAt, pickFromStack, pressMovesSelection } from "./picking";

function at(x: number, y: number, w: number, h: number, rotation = 0): Transform {
  return { x, y, w, h, rotation, opacity: 1 };
}

describe("pickFromStack", () => {
  const stack = ["top", "middle", "bottom"];

  it("picks the topmost element under the pointer whatever is selected", () => {
    expect(pickFromStack(stack, [], false)).toBe("top");
    expect(pickFromStack(stack, ["bottom"], false)).toBe("top");
    expect(pickFromStack([], ["bottom"], false)).toBeNull();
  });

  it("selects through to the element below the deepest selected one", () => {
    expect(pickFromStack(stack, ["top"], true)).toBe("middle");
    expect(pickFromStack(stack, ["middle"], true)).toBe("bottom");
    expect(pickFromStack(stack, ["top", "middle"], true)).toBe("bottom");
  });

  it("wraps back to the top after the bottom and starts at the top when nothing under the pointer is selected", () => {
    expect(pickFromStack(stack, ["bottom"], true)).toBe("top");
    expect(pickFromStack(stack, ["elsewhere"], true)).toBe("top");
    expect(pickFromStack([], [], true)).toBeNull();
  });
});

describe("pressMovesSelection", () => {
  it("moves the selection only when it is the topmost element under the pointer", () => {
    expect(pressMovesSelection(["top", "bg"], ["top"])).toBe(true);
    expect(pressMovesSelection(["top", "bg"], ["bg"])).toBe(false);
    expect(pressMovesSelection([], ["bg"])).toBe(false);
  });
});

describe("layerStackAt", () => {
  const canvas = { width: 1000, height: 500 };
  const layer = (id: string, transform: Transform, extra: Partial<Layer> = {}): Layer => ({ ...newShapeLayer("rect", transform), id, ...extra });
  const surface = (layers: Layer[]) => ({ ...emptyArtboard(canvas), layers });

  it("lists the pickable layers under a point from the top of the stack down", () => {
    const doc = surface([layer("bg", at(0.5, 0.5, 1, 1)), layer("card", at(0.5, 0.5, 0.4, 0.4)), layer("far", at(0.1, 0.1, 0.1, 0.1))]);
    expect(layerStackAt(doc, { x: 500, y: 250 })).toEqual(["card", "bg"]);
    expect(layerStackAt(doc, { x: 50, y: 50 })).toEqual(["far", "bg"]);
  });

  it("skips hidden and locked layers", () => {
    const doc = surface([layer("bg", at(0.5, 0.5, 1, 1)), layer("ghost", at(0.5, 0.5, 0.4, 0.4), { hidden: true }), layer("pinned", at(0.5, 0.5, 0.4, 0.4), { locked: true })]);
    expect(layerStackAt(doc, { x: 500, y: 250 })).toEqual(["bg"]);
  });

  it("follows the rotation of each layer", () => {
    const doc = surface([layer("bar", at(0.5, 0.5, 0.4, 0.04, 90))]);
    expect(layerStackAt(doc, { x: 500, y: 150 })).toEqual(["bar"]);
    expect(layerStackAt(doc, { x: 650, y: 250 })).toEqual([]);
  });
});
