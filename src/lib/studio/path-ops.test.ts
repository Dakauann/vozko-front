import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyImageDocument, emptyVideoDocument, newShapeLayer, type Layer, type VideoDocument } from "./document";
import { mergeShape, offsetShape, placedOperand, puckerBloatShape, roundCornersShape, twistShape, zigZagShape, type Shape } from "./path-op-geometry";
import { flattenSegment, pathBounds, pathToSubpaths, segmentCount, type Subpath } from "./path-nodes";
import {
  layerAtTime,
  MERGE_OPERAND_PATHS,
  newPathOp,
  PATH_OP_KINDS,
  pathOpIssue,
  pathOpsIssue,
  pathOpsKeyed,
  pathOpsLayer,
  pathOpsReach,
  pathOpValue,
  splitPathOps,
  stillPathOpsIssue,
  type OffsetOp,
  type PathOp,
} from "./path-ops";
import { parseDocument } from "./validate";
import type { Point } from "./viewport";

const SQUARE: Shape = { subpaths: [{ closed: true, nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] }], fillRule: "nonzero" };
const CANVAS = { width: 1000, height: 1000 };

function polygons(subpaths: readonly Subpath[]): Point[][] {
  return subpaths.map((subpath) => {
    const points: Point[] = [subpath.nodes[0]];
    for (let s = 0; s < segmentCount(subpath); s++) points.push(...flattenSegment(subpath, s, 0.5));
    return points;
  });
}

function inside(shape: Shape, p: Point): boolean {
  let winding = 0;
  let crossings = 0;
  for (const ring of polygons(shape.subpaths)) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (a.y <= p.y !== b.y <= p.y) {
        const x = a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x);
        if (x > p.x) {
          crossings += 1;
          winding += b.y > a.y ? 1 : -1;
        }
      }
    }
  }
  return shape.fillRule === "evenodd" ? crossings % 2 === 1 : winding !== 0;
}

function square(extra: Partial<Layer> = {}): Layer {
  return { ...newShapeLayer("rect", { x: 0.5, y: 0.5, w: 0.1, h: 0.1, rotation: 0, opacity: 1 }), id: "sq", fill: "#ff0000", ...extra };
}

function offset(amount: number, extra: Partial<OffsetOp> = {}): OffsetOp {
  return { ...(newPathOp("offset") as OffsetOp), id: "off", amount, ...extra };
}

describe("path operator geometry", () => {
  it("grows and shrinks a closed shape by the offset amount", () => {
    const grown = pathBounds(offsetShape(SQUARE, { amount: 10, copies: 1, copyOffset: 0, join: "miter", miterLimit: 4 }).subpaths);
    expect(grown.left).toBeCloseTo(-10, 0);
    expect(grown.right).toBeCloseTo(110, 0);
    const shrunk = pathBounds(offsetShape(SQUARE, { amount: -10, copies: 1, copyOffset: 0, join: "miter", miterLimit: 4 }).subpaths);
    expect(shrunk.left).toBeCloseTo(10, 0);
    expect(shrunk.bottom).toBeCloseTo(90, 0);
  });

  it("rounds the grown corners with a round join and keeps them sharp with a miter", () => {
    const round = offsetShape(SQUARE, { amount: 10, copies: 1, copyOffset: 0, join: "round", miterLimit: 4 });
    const miter = offsetShape(SQUARE, { amount: 10, copies: 1, copyOffset: 0, join: "miter", miterLimit: 4 });
    expect(inside(miter, { x: -8, y: -8 })).toBe(true);
    expect(inside(round, { x: -8, y: -8 })).toBe(false);
    expect(inside(round, { x: -8, y: 50 })).toBe(true);
  });

  it("draws one ring per copy, each a copy offset further out, as alternating bands", () => {
    const rings = offsetShape(SQUARE, { amount: 10, copies: 3, copyOffset: 10, join: "miter", miterLimit: 4 });
    expect(pathBounds(rings.subpaths).left).toBeCloseTo(-30, 0);
    expect(rings.fillRule).toBe("evenodd");
    expect(inside(rings, { x: -25, y: 50 })).toBe(true);
    expect(inside(rings, { x: -15, y: 50 })).toBe(false);
    expect(inside(rings, { x: 50, y: 50 })).toBe(true);
  });

  it("pulls vertices to the center and pushes handles out when bloating, the other way when puckering", () => {
    const bloated = puckerBloatShape(SQUARE, 50).subpaths[0].nodes[0];
    expect(bloated.x).toBeCloseTo(25);
    expect(bloated.out?.x).toBeCloseTo(-25);
    const puckered = puckerBloatShape(SQUARE, -50).subpaths[0].nodes[0];
    expect(puckered.x).toBeCloseTo(-25);
    expect(puckered.in?.x).toBeCloseTo(25);
    expect(puckerBloatShape(SQUARE, 0)).toBe(SQUARE);
  });

  it("replaces each sharp corner with a curve that starts the radius away", () => {
    const rounded = roundCornersShape(SQUARE, 10).subpaths[0].nodes;
    expect(rounded).toHaveLength(8);
    expect(rounded[0]).toMatchObject({ x: 0, y: 10 });
    expect(rounded[1]).toMatchObject({ x: 10, y: 0 });
    expect(roundCornersShape(SQUARE, 80).subpaths[0].nodes[1]).toMatchObject({ x: 50, y: 0 });
  });

  it("alternates the ridges to either side of each segment", () => {
    const zig = zigZagShape(SQUARE, { size: 10, ridges: 1, points: "corner" }).subpaths[0].nodes;
    expect(zig).toHaveLength(8);
    expect(zig[1].x).toBeCloseTo(50);
    expect(zig[1].y).toBeCloseTo(-10);
    expect(zig[3].x).toBeCloseTo(110);
    const smooth = zigZagShape(SQUARE, { size: 10, ridges: 1, points: "smooth" }).subpaths[0].nodes;
    expect(smooth[1].in?.x).toBeCloseTo(50 - 50 / 3);
  });

  it("twists the middle and leaves the farthest points in place", () => {
    const twisted = twistShape(SQUARE, 90, { x: 50, y: 50 });
    const corner = twisted.subpaths[0].nodes[0];
    expect(corner.x).toBeCloseTo(0);
    expect(corner.y).toBeCloseTo(0);
    const mid = twisted.subpaths[0].nodes.find((node) => Math.abs(node.y) > 1e-6 && node.y < 50 && node.x > 40 && node.x < 60);
    expect(mid).toBeDefined();
    expect(twistShape(SQUARE, 0, { x: 50, y: 50 })).toBe(SQUARE);
  });

  it("merges an operand shape with the four boolean modes", () => {
    const disc = placedOperand(MERGE_OPERAND_PATHS.ellipse, "nonzero", { x: 0.5, y: 0.5, w: 0.4, h: 0.4, rotation: 0 }, 100, 100);
    const holed = mergeShape(SQUARE, disc, "subtract");
    expect(inside(holed, { x: 50, y: 50 })).toBe(false);
    expect(inside(holed, { x: 5, y: 5 })).toBe(true);
    const kept = mergeShape(SQUARE, disc, "intersect");
    expect(inside(kept, { x: 50, y: 50 })).toBe(true);
    expect(inside(kept, { x: 5, y: 5 })).toBe(false);
    const away = placedOperand(MERGE_OPERAND_PATHS.rect, "nonzero", { x: 1, y: 0.5, w: 0.4, h: 0.4, rotation: 0 }, 100, 100);
    expect(inside(mergeShape(SQUARE, away, "union"), { x: 115, y: 50 })).toBe(true);
    const flipped = mergeShape(SQUARE, away, "exclude");
    expect(inside(flipped, { x: 95, y: 50 })).toBe(false);
    expect(inside(flipped, { x: 115, y: 50 })).toBe(true);
  });
});

describe("path operator model", () => {
  it("makes a valid operator of every kind", () => {
    for (const kind of PATH_OP_KINDS) expect(pathOpIssue(newPathOp(kind))).toBeNull();
  });

  it("refuses fields of another kind, numbers out of range and broken values", () => {
    const zig = newPathOp("zigZag");
    expect(pathOpIssue({ ...zig, amount: 3 } as PathOp)).toBe("invalid");
    expect(pathOpIssue({ ...zig, join: "round" } as unknown as PathOp)).toBe("invalid");
    expect(pathOpIssue({ ...zig, ridges: 2.5 } as PathOp)).toBe("invalid");
    expect(pathOpIssue({ ...zig, points: "wavy" } as unknown as PathOp)).toBe("unknown");
    expect(pathOpIssue(offset(5000))).toBe("out_of_range");
    expect(pathOpIssue(offset(5, { copies: 0 }))).toBe("out_of_range");
    expect(pathOpIssue(offset(5, { copies: 400 }))).toBeNull();
    expect(pathOpIssue({ ...newPathOp("merge"), path: "Z" } as PathOp)).toBe("invalid");
    expect(pathOpIssue({ ...newPathOp("merge"), mode: "flatten" } as unknown as PathOp)).toBe("unknown");
    expect(pathOpIssue({ ...newPathOp("twist"), kind: "spiral" } as unknown as PathOp)).toBe("unknown");
    expect(pathOpIssue(offset(5, { keyframes: { radius: [{ atMs: 0, value: 3, easing: "linear" }] } }))).toBe("invalid");
    expect(pathOpIssue(offset(5, { keyframes: { amount: [{ atMs: 0, value: 3000, easing: "linear" }] } }))).toBe("out_of_range");
  });

  it("takes operators only on shapes with an outline and refuses repeated ids", () => {
    expect(pathOpsIssue(square({ pathOps: [offset(4)] }))).toBeNull();
    expect(pathOpsIssue({ ...newShapeLayer("line"), id: "l", stroke: "#000000", strokeWidth: 4, pathOps: [offset(4)] })).toBe("invalid");
    expect(pathOpsIssue(square({ pathOps: [offset(4), offset(5)] }))).toBe("invalid");
  });

  it("keys operators only in video, where time exists", () => {
    const keyed = offset(0, { keyframes: { amount: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 500, value: 20, easing: "linear" }] } });
    expect(pathOpsKeyed([keyed])).toBe(true);
    expect(pathOpsKeyed([offset(3)])).toBe(false);
    expect(stillPathOpsIssue(square({ pathOps: [keyed] }))).toBe("invalid");
    expect(stillPathOpsIssue(square({ pathOps: [offset(3)] }))).toBeNull();
  });

  it("reads keyed values at a moment and carries them across a split", () => {
    const keyed = offset(0, { keyframes: { amount: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 20, easing: "linear" }] } });
    expect(pathOpValue(keyed, "amount", 500)).toBeCloseTo(10);
    const at = layerAtTime(square({ pathOps: [keyed] }), 250).pathOps![0] as OffsetOp;
    expect(at.amount).toBeCloseTo(5);
    expect(at.keyframes).toBeUndefined();
    const right = splitPathOps([keyed], 400)[0];
    expect(pathOpValue(right, "amount", 100)).toBeCloseTo(10);
  });

  it("turns the layer into the resulting path and skips hidden operators", () => {
    const layer = square({ pathOps: [offset(10, { join: "miter" })] });
    const shaped = pathOpsLayer(layer, CANVAS);
    expect(shaped.shape).toBe("path");
    expect(shaped.pathOps).toBeUndefined();
    const bounds = pathBounds(pathToSubpaths(shaped.path ?? ""));
    expect(bounds.left).toBeCloseTo(-0.1, 2);
    expect(bounds.right).toBeCloseTo(1.1, 2);
    expect(pathOpsLayer(layer, CANVAS).path).toBe(shaped.path);
    const hidden = pathOpsLayer(square({ pathOps: [offset(10, { hidden: true })] }), CANVAS);
    expect(hidden.shape).toBe("rect");
  });

  it("pads the raster far enough for the farthest keyed value", () => {
    expect(pathOpsReach(square({ pathOps: [offset(10)] }), CANVAS)).toBe(10);
    expect(pathOpsReach(square({ pathOps: [offset(10, { join: "miter", miterLimit: 4 })] }), CANVAS)).toBe(40);
    expect(pathOpsReach(square({ pathOps: [offset(-10)] }), CANVAS)).toBe(0);
    const keyed = offset(0, { keyframes: { amount: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 500, value: 30, easing: "linear" }] } });
    expect(pathOpsReach(square({ pathOps: [keyed] }), CANVAS)).toBe(30);
    expect(pathOpsReach(square({ pathOps: [newPathOp("roundCorners")] }), CANVAS)).toBe(0);
  });
});

describe("path operators in documents", () => {
  const fixture = (name: string) => JSON.parse(readFileSync(resolve(__dirname, `../../../../vozko-back/domain/studio/testdata/${name}`), "utf8"));

  it("accepts the shared fixtures the backend also checks", () => {
    expect(parseDocument("video", fixture("editor_path_ops.json")).ok).toBe(true);
    expect(parseDocument("image", fixture("editor_path_ops_image.json")).ok).toBe(true);
  });

  it("refuses keyed operators in the image editor and unknown operator fields", () => {
    const image = fixture("editor_path_ops_image.json");
    image.artboards[0].layers[0].pathOps[1].keyframes = { amount: [{ atMs: 0, value: -10, easing: "linear" }] };
    expect(parseDocument("image", image).ok).toBe(false);
    const video = fixture("editor_path_ops.json") as VideoDocument;
    (video.tracks[0].clips[0].layer!.pathOps![0] as unknown as Record<string, unknown>).speed = 2;
    expect(parseDocument("video", video).ok).toBe(false);
  });

  it("accepts static operators on a plain document of both editors", () => {
    const doc = emptyImageDocument({ width: 500, height: 500 });
    doc.artboards[0] = { ...emptyArtboard({ width: 500, height: 500 }), id: doc.artboards[0].id, layers: [square({ pathOps: [newPathOp("twist"), newPathOp("merge")] })] };
    expect(parseDocument("image", doc).ok).toBe(true);
    expect(emptyVideoDocument("square").tracks.length).toBeGreaterThan(0);
  });
});
