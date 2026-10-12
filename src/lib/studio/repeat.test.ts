import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyArtboard, newIconLayer, newShapeLayer, newTextLayer, type ImageSurface, type Layer, type StudioGroup } from "./document";
import { defaultRepeat, repeatInstances, repeatIssue, repeatsIssue, scaledRepeat, type Repeat } from "./repeat";
import { resizeCanvas } from "./layers";
import { expandRepeat, repeatedLayers, repeatLayers, setRepeat, sourceBox } from "./repeat-edits";
import { documentIssue, surfaceIssue } from "./validate";

const CANVAS = { width: 1000, height: 1000 };

function board(layers: Layer[], groups: StudioGroup[] = []): ImageSurface {
  return { ...emptyArtboard(CANVAS), layers, ...(groups.length > 0 ? { groups } : {}) };
}

function petal(id = "p", patch: Partial<Layer> = {}): Layer {
  return { ...newShapeLayer("ellipse", { x: 0.5, y: 0.3, w: 0.04, h: 0.1, rotation: 0, opacity: 1 }), id, ...patch };
}

const near = (got: number, want: number) => expect(got).toBeCloseTo(want, 6);

describe("repeat parameters", () => {
  it("accepts each mode with its own fields only", () => {
    expect(repeatIssue({ mode: "radial", count: 12, radius: 200, startAngle: -90, shown: 9, sweep: 180, direction: "ccw", upright: true, reverseOverlap: true })).toBeNull();
    expect(repeatIssue({ mode: "grid", rows: 4, columns: 6, gapX: 12, gapY: -5, layout: "brick-row", offset: 0.5, flipRows: "horizontal", flipColumns: "both" })).toBeNull();
    expect(repeatIssue({ mode: "mirror", angle: 0, gap: -20, side: "start" })).toBeNull();
    expect(repeatIssue({ mode: "radial", count: 5000, radius: 10 })).toBeNull();
  });

  it.each<[string, Repeat]>([
    ["an unknown mode", { mode: "spiral" as Repeat["mode"] }],
    ["a radial of one", { mode: "radial", count: 1, radius: 10 }],
    ["a fractional count", { mode: "radial", count: 2.5, radius: 10 }],
    ["more shown than placed", { mode: "radial", count: 4, shown: 5, radius: 10 }],
    ["a radius of zero", { mode: "radial", count: 4, radius: 0 }],
    ["a start angle past 180", { mode: "radial", count: 4, radius: 10, startAngle: 200 }],
    ["a sweep past a turn", { mode: "radial", count: 4, radius: 10, sweep: 400 }],
    ["an unknown direction", { mode: "radial", count: 4, radius: 10, direction: "up" as Repeat["direction"] }],
    ["grid fields on a radial", { mode: "radial", count: 4, radius: 10, rows: 2 }],
    ["a one cell grid", { mode: "grid", rows: 1, columns: 1 }],
    ["a grid without rows", { mode: "grid", columns: 3 }],
    ["a brick offset on a plain grid", { mode: "grid", rows: 2, columns: 2, offset: 0.5 }],
    ["an unknown flip", { mode: "grid", rows: 2, columns: 2, flipRows: "diagonal" as Repeat["flipRows"] }],
    ["a gap past 4096", { mode: "grid", rows: 2, columns: 2, gapX: 5000 }],
    ["radial fields on a grid", { mode: "grid", rows: 2, columns: 2, upright: true }],
    ["a mirror axis past 180", { mode: "mirror", angle: 190 }],
    ["an unknown side", { mode: "mirror", angle: 90, side: "middle" as Repeat["side"] }],
    ["grid fields on a mirror", { mode: "mirror", angle: 90, columns: 2 }],
  ])("refuses %s", (_, repeat) => {
    expect(repeatIssue(repeat)).not.toBeNull();
  });

  it("refuses repeats inside repeats and repeats of nothing", () => {
    const inner: StudioGroup = { id: "inner", parentId: "outer", repeat: { mode: "mirror", angle: 90 } };
    const outer: StudioGroup = { id: "outer", repeat: { mode: "grid", rows: 2, columns: 2 } };
    const layers = [petal("a", { groupId: "inner" }), petal("b", { groupId: "inner" })];
    expect(repeatsIssue([outer, inner], layers)).toBe("invalid");
    expect(repeatsIssue([{ ...outer, repeat: undefined }, inner], layers)).toBeNull();
    expect(surfaceIssue(board(layers, [outer, inner]))).not.toBeNull();
    expect(surfaceIssue(board(layers, [{ ...outer, repeat: undefined }, inner]))).toBeNull();
  });
});

describe("repeat geometry", () => {
  it("measures the source as the union of its members' rotated boxes", () => {
    const box = sourceBox([petal("a"), petal("b", { transform: { x: 0.6, y: 0.3, w: 0.04, h: 0.1, rotation: 90, opacity: 1 } })], CANVAS);
    expect(box).toEqual({ left: 480, top: 250, right: 650, bottom: 350 });
  });

  it("places radial copies around a center found from the source, rotating them", () => {
    const box = { left: 480, top: 250, right: 520, bottom: 350 };
    const places = repeatInstances({ mode: "radial", count: 4, radius: 200, startAngle: -90 }, box);
    expect(places).toHaveLength(4);
    const [, right] = places;
    near(right.a, 0);
    near(right.b, 1);
    near(right.e, 1000);
    const center = (m: (typeof places)[number]) => ({ x: m.a * 500 + m.c * 300 + m.e, y: m.b * 500 + m.d * 300 + m.f });
    near(center(right).x, 700);
    near(center(right).y, 500);
    near(center(places[2]).y, 700);
  });

  it("keeps radial copies upright when asked, shows only some and fans out over a sweep", () => {
    const box = { left: 480, top: 250, right: 520, bottom: 350 };
    const upright = repeatInstances({ mode: "radial", count: 4, radius: 200, startAngle: -90, upright: true, shown: 3 }, box);
    expect(upright).toHaveLength(3);
    near(upright[1].a, 1);
    near(upright[1].b, 0);
    const fan = repeatInstances({ mode: "radial", count: 3, radius: 200, startAngle: -90, sweep: 90 }, box);
    near(Math.atan2(fan[2].b, fan[2].a) * (180 / Math.PI), 90);
    const ccw = repeatInstances({ mode: "radial", count: 4, radius: 200, startAngle: -90, direction: "ccw" }, box);
    near(ccw[1].b, -1);
  });

  it("lays grid copies by pitch with brick offsets and flips", () => {
    const box = { left: 0, top: 0, right: 100, bottom: 50 };
    const grid = repeatInstances({ mode: "grid", rows: 2, columns: 3, gapX: 10, gapY: 5, layout: "brick-row", offset: 0.5, flipColumns: "horizontal" }, box);
    expect(grid).toHaveLength(6);
    expect(grid[2]).toMatchObject({ a: 1, e: 220, f: 0 });
    expect(grid[3]).toMatchObject({ e: 55, f: 55 });
    expect(grid[1]).toMatchObject({ a: -1, d: 1, e: 210 });
  });

  it("reflects a mirror copy across an axis beside the source", () => {
    const box = { left: 100, top: 100, right: 200, bottom: 300 };
    const [, copy] = repeatInstances({ mode: "mirror", angle: 90, gap: 20 }, box);
    expect(copy.a).toBeCloseTo(-1, 9);
    expect(copy.e).toBeCloseTo(2 * 210, 9);
    const [, below] = repeatInstances({ mode: "mirror", angle: 0 }, box);
    expect(below.d).toBeCloseTo(-1, 9);
    expect(below.f).toBeCloseTo(600, 9);
    const [, before] = repeatInstances({ mode: "mirror", angle: 90, side: "start" }, box);
    expect(before.e).toBeCloseTo(200, 9);
  });
});

describe("repeated layers", () => {
  const withRepeat = (repeat: Repeat) => board([newTextLayer("fundo"), petal("a", { groupId: "g" }), petal("b", { groupId: "g", transform: { x: 0.5, y: 0.2, w: 0.02, h: 0.02, rotation: 0, opacity: 1 } }), newIconLayer("star")], [{ id: "g", repeat }]);

  it("adds virtual copies of every member after the topmost member, keeping the source in place", () => {
    const doc = withRepeat({ mode: "radial", count: 3, radius: 100, startAngle: -90 });
    const shown = repeatedLayers(doc);
    expect(shown.map((l) => l.id)).toEqual([doc.layers[0].id, "a", "b", "a#r1", "b#r1", "a#r2", "b#r2", doc.layers[3].id]);
    expect(shown[1]).toBe(doc.layers[1]);
    expect(shown[3].transform.rotation).toBeCloseTo(120, 6);
    expect(shown[3].locked).toBe(true);
  });

  it("draws copies in reverse with reverse overlap and leaves documents without repeats alone", () => {
    const reversed = repeatedLayers(withRepeat({ mode: "radial", count: 3, radius: 100, startAngle: -90, reverseOverlap: true }));
    expect(reversed.map((l) => l.id).slice(3, 7)).toEqual(["a#r2", "b#r2", "a#r1", "b#r1"]);
    const plain = board([petal("a")]);
    expect(repeatedLayers(plain)).toBe(plain.layers);
  });

  it("mirrors copies by flipping them and turning their rotation", () => {
    const doc = board([petal("a", { groupId: "g", transform: { x: 0.5, y: 0.3, w: 0.04, h: 0.1, rotation: 30, opacity: 1 } })], [{ id: "g", repeat: { mode: "mirror", angle: 90 } }]);
    const copy = repeatedLayers(doc)[1];
    expect(copy.flipX).toBe(true);
    expect(copy.transform.rotation).toBeCloseTo(-30, 6);
  });
});

describe("repeat edits", () => {
  it("repeats one layer by giving it a group of its own that stays", () => {
    const doc = board([petal("a"), petal("other")]);
    const result = repeatLayers(doc, ["a"], defaultRepeat("radial", sourceBox([doc.layers[0]], CANVAS)));
    expect(result.groupId).not.toBeNull();
    const group = result.document.groups?.find((g) => g.id === result.groupId);
    expect(group?.repeat).toMatchObject({ mode: "radial", count: 8, radius: 100, startAngle: -90 });
    expect(result.document.layers[0].groupId).toBe(result.groupId);
    expect(surfaceIssue(result.document)).toBeNull();
    const cleared = setRepeat(result.document, result.groupId!, undefined);
    expect(cleared.groups?.find((g) => g.id === result.groupId)?.repeat).toBeUndefined();
  });

  it("repeats a selection by grouping it, or reuses the group it already is", () => {
    const doc = board([petal("a"), petal("b")]);
    const grouped = repeatLayers(doc, ["a", "b"], { mode: "grid", rows: 2, columns: 2 });
    expect(grouped.document.layers.every((l) => l.groupId === grouped.groupId)).toBe(true);
    const again = repeatLayers(grouped.document, ["a", "b"], { mode: "mirror", angle: 90 });
    expect(again.groupId).toBe(grouped.groupId);
    expect(again.document.groups).toHaveLength(1);
  });

  it("refuses a repeat inside another repeat", () => {
    const doc = board([petal("a", { groupId: "outer" }), petal("b", { groupId: "outer" })], [{ id: "outer", repeat: { mode: "grid", rows: 2, columns: 2 } }]);
    expect(repeatLayers(doc, ["a"], { mode: "mirror", angle: 90 }).groupId).toBeNull();
  });

  it("expands copies into real layers that look the same and drops the repeat", () => {
    const doc = board([petal("a", { groupId: "g" }), petal("b", { groupId: "g" })], [{ id: "g", repeat: { mode: "mirror", angle: 90, gap: 10 } }]);
    const expanded = expandRepeat(doc, "g");
    if (!expanded.ok) throw new Error(expanded.reason);
    expect(expanded.document.layers).toHaveLength(4);
    expect(expanded.document.groups?.find((g) => g.id === "g")?.repeat).toBeUndefined();
    const virtual = repeatedLayers(doc).slice(2);
    expanded.document.layers.slice(2).forEach((layer, i) => {
      expect(layer.transform.x).toBeCloseTo(virtual[i].transform.x, 9);
      expect(layer.flipX).toBe(virtual[i].flipX);
      expect(layer.id).not.toContain("#");
    });
    expect(surfaceIssue(expanded.document)).toBeNull();
  });

  it("refuses to expand copies that would leave the artboard's coordinate range", () => {
    const doc = board([petal("a", { groupId: "g" })], [{ id: "g", repeat: { mode: "grid", rows: 1, columns: 400, gapX: 100 } }]);
    const expanded = expandRepeat(doc, "g");
    expect(expanded.ok).toBe(false);
  });

  it("rescales its pixel distances with the artboard", () => {
    expect(scaledRepeat({ mode: "radial", count: 6, radius: 300 }, 0.5)).toMatchObject({ radius: 150 });
    expect(scaledRepeat({ mode: "grid", rows: 2, columns: 2, gapX: 40, gapY: -10 }, 2)).toMatchObject({ gapX: 80, gapY: -20 });
    expect(scaledRepeat({ mode: "mirror", angle: 90, gap: 30 }, 0.5)).toMatchObject({ gap: 15 });
  });
});

describe("the repeat contract shared with the backend", () => {
  it("accepts the fixture the backend accepts", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_repeat.json"), "utf8"));
    expect(documentIssue("image", raw)).toBeNull();
  });
});

describe("repeats and artboard resizing", () => {
  it("rescales the radius when the artboard is resized", () => {
    const doc = board([petal("a", { groupId: "g" })], [{ id: "g", repeat: { mode: "radial", count: 6, radius: 300 } }]);
    expect(resizeCanvas(doc, { width: 500, height: 500 }).groups?.[0].repeat?.radius).toBe(150);
  });
});
