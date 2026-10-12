import { describe, expect, it } from "vitest";

import { imageDocument, type Artboard, type ImageDocument, type Layer, type Transform } from "./document";
import { instanceAnchors, instanceParts, instanceScale, isPartId, liveParts, overridableFields, partId, partIdsOf, partSource, perceivedSurface, resolvedSurface } from "./components";

function box(x: number, y: number, w: number, h: number, rotation = 0, opacity = 1): Transform {
  return { x, y, w, h, rotation, opacity };
}

const label: Layer = { id: "label", type: "text", text: "Saiba mais", fontId: "inter", fontSize: 0.3, fill: "#ffffff", transform: box(0.45, 0.5, 0.7, 0.5) };
const pill: Layer = { id: "pill", type: "shape", shape: "rect", fill: "#111111", stroke: "#000000", strokeWidth: 4, radius: 0.5, transform: box(0.5, 0.5, 1, 1) };
const arrow: Layer = { id: "arrow", type: "icon", iconId: "arrow-right", fill: "#ffffff", transform: box(0.87, 0.5, 0.1, 0.34, 30) };

function component(overrides: Partial<Artboard> = {}): Artboard {
  return { id: "cta", component: true, x: 0, y: -400, canvas: { width: 400, height: 100, background: "" }, layers: [pill, label, arrow], ...overrides };
}

function instance(overrides: Partial<Layer> = {}): Layer {
  return { id: "inst", type: "instance", componentId: "cta", transform: box(0.5, 0.5, 0.4, 0.1), ...overrides };
}

function host(layers: Layer[]): Artboard {
  return { id: "post", x: 0, y: 0, canvas: { width: 1000, height: 1000, background: "#ffffff" }, layers };
}

function doc(layers: Layer[], cta: Artboard = component()): ImageDocument {
  return imageDocument([host(layers), cta]);
}

describe("overridable fields", () => {
  it("follow the type and the single paint of the main layer", () => {
    expect(overridableFields(label)).toEqual(["text", "fill", "fontId", "fontWeight", "italic", "hidden"]);
    expect(overridableFields(pill)).toEqual(["fill", "stroke", "hidden"]);
    expect(overridableFields(arrow)).toEqual(["fill", "iconId", "hidden"]);
    expect(overridableFields({ id: "p", type: "image", assetId: "a", transform: box(0.5, 0.5, 1, 1) })).toEqual(["assetId", "crop", "hidden"]);
    expect(overridableFields({ ...pill, gradient: { from: "#000000", to: "#ffffff", angle: 0 } })).toEqual(["stroke", "hidden"]);
    expect(overridableFields({ ...pill, strokes: [{ type: "solid", color: "#000000", opacity: 1, width: 2, align: "center" }] })).toEqual(["fill", "hidden"]);
  });
});

describe("part ids", () => {
  it("join the instance and the main layer with a mark no stored id can hold", () => {
    expect(partId("inst", "label")).toBe("inst;label");
    expect(isPartId("inst;label")).toBe(true);
    expect(isPartId("label")).toBe(false);
    expect(partSource("inst;label#r2")).toEqual({ instanceId: "inst", layerId: "label#r2" });
    expect(partSource("label")).toBeNull();
  });
});

describe("instance parts", () => {
  it("scale the component to contain it in the instance box", () => {
    expect(instanceScale(box(0.5, 0.5, 0.4, 0.1), { width: 400, height: 100 }, { width: 1000, height: 1000 })).toBeCloseTo(1);
    expect(instanceScale(box(0.5, 0.5, 0.8, 0.1), { width: 400, height: 100 }, { width: 1000, height: 1000 })).toBeCloseTo(1);
    expect(instanceScale(box(0.5, 0.5, 0.2, 0.5), { width: 400, height: 100 }, { width: 1000, height: 1000 })).toBeCloseTo(0.5);
  });

  it("place every main layer through the instance box", () => {
    const parts = instanceParts(component(), instance({ transform: box(0.3, 0.6, 0.8, 0.2, 0, 0.5) }), { width: 1000, height: 1000 });
    expect(parts.map((p) => p.id)).toEqual(["inst;pill", "inst;label", "inst;arrow"]);
    const text = parts[1];
    expect(text.transform.x).toBeCloseTo(0.3 + (-0.05 * 400 * 2) / 1000);
    expect(text.transform.y).toBeCloseTo(0.6);
    expect(text.transform.w).toBeCloseTo((0.7 * 400 * 2) / 1000);
    expect(text.transform.h).toBeCloseTo((0.5 * 100 * 2) / 1000);
    expect(text.transform.opacity).toBeCloseTo(0.5);
    expect(text.fontSize).toBeCloseTo((0.3 * 100 * 2) / 1000);
    expect(parts[0].strokeWidth).toBeCloseTo(8);
    expect(parts.every((p) => p.locked)).toBe(true);
  });

  it("turn and mirror the parts with the instance", () => {
    const [, , turned] = instanceParts(component(), instance({ transform: box(0.5, 0.5, 0.4, 0.1, 90) }), { width: 1000, height: 1000 });
    expect(turned.transform.x).toBeCloseTo(0.5);
    expect(turned.transform.y).toBeCloseTo(0.5 + (0.37 * 400) / 1000);
    expect(turned.transform.rotation).toBeCloseTo(120);
    const [, , mirrored] = instanceParts(component(), instance({ flipX: true }), { width: 1000, height: 1000 });
    expect(mirrored.transform.x).toBeCloseTo(0.5 - (0.37 * 400) / 1000);
    expect(mirrored.transform.rotation).toBeCloseTo(-30);
    expect(mirrored.flipX).toBe(true);
  });

  it("apply the overrides, hide with the instance and join its group", () => {
    const parts = instanceParts(component(), instance({ hidden: true, groupId: "g1", overrides: [{ layerId: "label", text: "Compre" }, { layerId: "arrow", hidden: true }] }), { width: 1000, height: 1000 });
    expect(parts[1].text).toBe("Compre");
    expect(parts.every((p) => p.hidden && p.groupId === "g1")).toBe(true);
    const shown = instanceParts(component(), instance({ overrides: [{ layerId: "arrow", hidden: true }] }), { width: 1000, height: 1000 });
    expect(shown.map((p) => Boolean(p.hidden))).toEqual([false, false, true]);
  });

  it("paint the component background as the lowest part and drop a leading clip", () => {
    const parts = instanceParts(component({ canvas: { width: 400, height: 100, background: "#ff0000" }, layers: [{ ...pill, clip: true }, { ...label, clip: true }] }), instance(), { width: 1000, height: 1000 });
    expect(parts.map((p) => p.id)).toEqual(["inst;@canvas", "inst;pill", "inst;label"]);
    expect(parts[0]).toMatchObject({ type: "shape", shape: "rect", fill: "#ff0000" });
    expect(parts[0].clip).toBeUndefined();
    expect(parts[1].clip).toBe(true);
    const bare = instanceParts(component({ layers: [{ ...pill, clip: true }, { ...label, clip: true }] }), instance(), { width: 1000, height: 1000 });
    expect(bare[0].clip).toBeUndefined();
    expect(bare[1].clip).toBe(true);
  });

  it("expand repeats inside the component", () => {
    const repeated = component({ layers: [{ ...pill, transform: box(0.1, 0.5, 0.1, 0.5), groupId: "row" }], groups: [{ id: "row", repeat: { mode: "grid", rows: 1, columns: 3 } }] });
    expect(instanceParts(repeated, instance(), { width: 1000, height: 1000 }).map((p) => p.id)).toEqual(["inst;pill", "inst;pill#r1", "inst;pill#r2"]);
  });
});

describe("resolved surfaces", () => {
  it("replace instances with their parts and keep plain surfaces as they are", () => {
    const plain: Layer = { ...pill, id: "bg" };
    const document = doc([plain, instance()]);
    const resolved = resolvedSurface(document, document.artboards[0]);
    expect(resolved.layers.map((l) => l.id)).toEqual(["bg", "inst;pill", "inst;label", "inst;arrow"]);
    expect(resolved.id).toBe("post");
    expect(resolvedSurface(document, document.artboards[0])).toBe(resolved);
    const flat = doc([plain]);
    expect(resolvedSurface(flat, flat.artboards[0])).toBe(flat.artboards[0]);
  });

  it("follow edits of the component and drop instances without one", () => {
    const first = doc([instance()]);
    const edited = doc([instance()], component({ layers: [pill] }));
    const sharedHost = { ...edited, artboards: [first.artboards[0], edited.artboards[1]] };
    expect(resolvedSurface(first, first.artboards[0]).layers).toHaveLength(3);
    expect(resolvedSurface(sharedHost, first.artboards[0]).layers).toHaveLength(1);
    const orphan = imageDocument([host([instance()])]);
    expect(resolvedSurface(orphan, orphan.artboards[0]).layers).toEqual([]);
  });
});

describe("perceived surfaces", () => {
  const sales: Layer = {
    id: "bars",
    type: "chart",
    transform: box(0.5, 0.6, 0.8, 0.3),
    chart: { kind: "bar", data: { labels: ["Jan", "Fev"], series: [{ name: "Vendas", values: [52, 61] }] }, style: { palette: ["#2563eb"], fontId: "inter", fontSize: 0.05, textColor: "#334155", gridColor: "#e2e8f0", axes: true, gridlines: true, legend: "none", valueLabels: true, barRadius: 0.3, barGap: 0.35, lineWidth: 0.006, smooth: false, points: false, hole: 0.62 }, format: { locale: "pt-BR", decimals: 0, percent: false } },
  };

  it("resolve instances but keep a chart, a table or a QR code as one element", () => {
    const document = doc([sales, instance()]);
    expect(resolvedSurface(document, document.artboards[0]).layers.some((l) => l.id.startsWith("bars;"))).toBe(true);
    expect(perceivedSurface(document, document.artboards[0]).layers.map((l) => l.id)).toEqual(["bars", "inst;pill", "inst;label", "inst;arrow"]);
    const flat = doc([sales]);
    expect(perceivedSurface(flat, flat.artboards[0])).toBe(flat.artboards[0]);
  });
});

describe("live parts", () => {
  it("move the parts of a dragged instance with it", () => {
    const document = doc([instance()]);
    const moved = liveParts(document, document.artboards[0], new Map([["inst", box(0.6, 0.5, 0.4, 0.1)]]));
    expect(moved.get("inst")?.x).toBeCloseTo(0.6);
    expect(moved.get("inst;label")?.x).toBeCloseTo(0.6 - (0.05 * 400) / 1000);
    expect(moved.size).toBe(4);
  });
});

describe("instance anchors", () => {
  it("place the hit area of each instance right after its topmost part", () => {
    const empty = component({ id: "empty", layers: [] });
    const document = imageDocument([host([instance(), { ...instance(), id: "ghost", componentId: "empty" }]), component(), empty]);
    const anchors = instanceAnchors(document.artboards[0], resolvedSurface(document, document.artboards[0]));
    expect([...anchors.after.entries()].map(([id, list]) => [id, list.map((l) => l.id)])).toEqual([["inst;arrow", ["inst"]]]);
    expect(anchors.loose.map((l) => l.id)).toEqual(["ghost"]);
    expect(partIdsOf(document, document.artboards[0], ["inst"])).toEqual(["inst;pill", "inst;label", "inst;arrow"]);
  });
});
