import { describe, expect, it } from "vitest";

import { emptyArtboard, newShapeLayer, type Layer } from "./document";
import { pathBounds, pathToSubpaths, type Subpath } from "./path-nodes";
import { surfaceIssue } from "./validate";
import { canvasToUnit, convertToPath, layerSubpaths, pathLayerFromCanvas, refitPathLayer, unitToCanvas } from "./vector-layer";
import { worldToScreen } from "./viewport";
import { isValidPath } from "./vector-path";

const canvas = { width: 1000, height: 500 };

function close(a: number, b: number, digits = 6) {
  expect(a).toBeCloseTo(b, digits);
}

function layer(extra: Partial<Layer> = {}): Layer {
  return { id: "p", type: "shape", shape: "path", path: "M0 0 L1 0 L1 1 Z", fill: "#000000", transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.4, rotation: 0, opacity: 1 }, ...extra };
}

describe("unit and canvas coordinates", () => {
  it("map the layer box onto the canvas and back, rotation included", () => {
    const turned = layer({ transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.4, rotation: 90, opacity: 1 } });
    const corner = unitToCanvas(turned.transform, canvas, { x: 0, y: 0 });
    close(corner.x, 600);
    close(corner.y, 150);
    const back = canvasToUnit(turned.transform, canvas, corner);
    close(back.x, 0);
    close(back.y, 0);
  });

  it("maps canvas pixels to the screen through the viewport", () => {
    expect(worldToScreen({ scale: 2, x: 10, y: 20 }, { x: 5, y: 5 })).toEqual({ x: 20, y: 30 });
  });
});

describe("pathLayerFromCanvas", () => {
  it("builds a path layer whose box hugs what was drawn", () => {
    const drawn: Subpath[] = [{ closed: true, nodes: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 200 }] }];
    const built = pathLayerFromCanvas(drawn, canvas, false);
    expect(built).toMatchObject({ type: "shape", shape: "path", transform: { x: 0.2, y: 0.3, w: 0.2, h: 0.2, rotation: 0 } });
    expect(built.fill).toBeDefined();
    expect(isValidPath(built.path!)).toBe(true);
    expect(surfaceIssue({ ...emptyArtboard(canvas), layers: [built] })).toBeNull();
  });

  it("strokes an open drawing and keeps a flat line valid", () => {
    const line = pathLayerFromCanvas([{ closed: false, nodes: [{ x: 100, y: 250 }, { x: 900, y: 250 }] }], canvas, true);
    expect(line.fill).toBeUndefined();
    expect(line.strokeWidth).toBeGreaterThan(0);
    expect(line.transform.h).toBeGreaterThan(0);
    expect(surfaceIssue({ ...emptyArtboard(canvas), layers: [line] })).toBeNull();
  });
});

describe("refitPathLayer", () => {
  it("grows the box when a point is dragged out of it and keeps the shape in place on the canvas", () => {
    const original = layer();
    const edited: Subpath[] = [{ closed: true, nodes: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }] }];
    const patch = refitPathLayer(original, edited, canvas)!;
    const next = { ...original, ...patch };
    expect(next.transform.w).toBeCloseTo(0.4);
    const far = unitToCanvas(next.transform, canvas, { x: 1, y: 0 });
    const expected = unitToCanvas(original.transform, canvas, { x: 2, y: 0 });
    close(far.x, expected.x);
    close(far.y, expected.y);
    expect(pathBounds(layerSubpaths(next))).toEqual({ left: 0, top: 0, right: 1, bottom: 1 });
  });

  it("keeps a rotated layer rotated while refitting", () => {
    const turned = layer({ transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.4, rotation: 30, opacity: 1 } });
    const edited: Subpath[] = [{ closed: true, nodes: [{ x: -0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }];
    const patch = refitPathLayer(turned, edited, canvas)!;
    expect(patch.transform?.rotation).toBe(30);
    const moved = unitToCanvas(patch.transform!, canvas, { x: 0, y: 0 });
    const expected = unitToCanvas(turned.transform, canvas, { x: -0.5, y: 0 });
    close(moved.x, expected.x);
    close(moved.y, expected.y);
  });

  it("refuses a path that would leave the allowed size", () => {
    expect(refitPathLayer(layer(), [{ closed: false, nodes: [{ x: 0, y: 0 }, { x: 40, y: 0 }] }], canvas)).toBeNull();
  });
});

describe("convertToPath", () => {
  it("turns basic shapes into paths that keep their look", () => {
    for (const shape of ["rect", "ellipse", "triangle", "star"] as const) {
      const source = { ...newShapeLayer(shape), radius: shape === "rect" ? 0.3 : undefined };
      const patch = convertToPath(source, canvas)!;
      expect(patch.shape, shape).toBe("path");
      expect(isValidPath(patch.path!), shape).toBe(true);
      const converted = { ...source, ...patch } as Layer;
      expect(surfaceIssue({ ...emptyArtboard(canvas), layers: [converted] }), shape).toBeNull();
    }
    const ellipse = pathBounds(pathToSubpaths(convertToPath(newShapeLayer("ellipse"), canvas)!.path!));
    close(ellipse.left, 0, 3);
    close(ellipse.bottom, 1, 3);
  });

  it("keeps a tuned star tuned and leaves lines alone", () => {
    const star = convertToPath({ ...newShapeLayer("star"), points: 8, inner: 0.7 }, canvas)!;
    expect(pathToSubpaths(star.path!)[0].nodes).toHaveLength(16);
    expect(star.points).toBeUndefined();
    expect(convertToPath(newShapeLayer("line"), canvas)).toBeNull();
  });
});
