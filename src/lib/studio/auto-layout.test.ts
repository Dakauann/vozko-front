import { describe, expect, it } from "vitest";

import { inferredLayout, layoutSurface, settleLayouts, type HugMeasure, type Layout } from "./auto-layout";
import { imageDocument, type Artboard, type ImageDocument, type ImageSurface, type Layer, type StudioGroup } from "./document";

const CANVAS = { width: 1000, height: 1000 };

function px(x: number, y: number, w: number, h: number) {
  return { x: x / CANVAS.width, y: y / CANVAS.height, w: w / CANVAS.width, h: h / CANVAS.height, rotation: 0, opacity: 1 };
}

function rect(id: string, x: number, y: number, w: number, h: number, extra: Partial<Layer> = {}): Layer {
  return { id, type: "shape", shape: "rect", fill: "#111111", transform: px(x, y, w, h), groupId: "row", ...extra };
}

function row(layout: Partial<Layout>, children: Layer[], groups: StudioGroup[] = []): ImageSurface {
  const base = rect("base", 500, 500, 100, 100);
  return {
    canvas: { ...CANVAS, background: "#ffffff" },
    layers: [base, ...children],
    groups: [{ id: "row", baseId: "base", layout: { direction: "horizontal", width: "hug", height: "hug", ...layout } }, ...groups],
  };
}

function boxOf(surface: ImageSurface, id: string) {
  const t = surface.layers.find((l) => l.id === id)!.transform;
  const w = t.w * CANVAS.width;
  const h = t.h * CANVAS.height;
  return { left: Math.round(t.x * CANVAS.width - w / 2), top: Math.round(t.y * CANVAS.height - h / 2), width: Math.round(w), height: Math.round(h) };
}

function laid(surface: ImageSurface, measure?: HugMeasure): ImageSurface {
  const result = layoutSurface(surface, measure);
  if (!result) throw new Error("layout refused");
  return result;
}

describe("auto layout", () => {
  it("hugs a horizontal row with padding and gap, keeping the base's top left corner", () => {
    const surface = laid(row({ gap: 10, padding: { top: 20, right: 30, bottom: 20, left: 30 } }, [rect("a", 0, 0, 100, 40), rect("b", 900, 900, 60, 80)]));
    expect(boxOf(surface, "base")).toEqual({ left: 450, top: 450, width: 30 + 100 + 10 + 60 + 30, height: 20 + 80 + 20 });
    expect(boxOf(surface, "a")).toEqual({ left: 480, top: 470, width: 100, height: 40 });
    expect(boxOf(surface, "b")).toEqual({ left: 590, top: 470, width: 60, height: 80 });
  });

  it("aligns on both axes inside a fixed container and spreads with an auto gap", () => {
    const centered = laid(row({ width: "fixed", height: "fixed", alignMain: "center", alignCross: "end" }, [rect("a", 0, 0, 20, 20), rect("b", 0, 0, 20, 40)]));
    expect(boxOf(centered, "base")).toEqual({ left: 450, top: 450, width: 100, height: 100 });
    expect(boxOf(centered, "a")).toEqual({ left: 480, top: 530, width: 20, height: 20 });
    expect(boxOf(centered, "b")).toEqual({ left: 500, top: 510, width: 20, height: 40 });
    const spread = laid(row({ width: "fixed", height: "fixed", autoGap: true }, [rect("a", 0, 0, 20, 20), rect("b", 0, 0, 20, 20), rect("c", 0, 0, 20, 20)]));
    expect([boxOf(spread, "a").left, boxOf(spread, "b").left, boxOf(spread, "c").left]).toEqual([450, 490, 530]);
  });

  it("gives fill items the room left and measures hug text", () => {
    const text: Layer = { id: "t", type: "text", text: "Oferta", fontId: "inter", fontSize: 0.02, transform: px(0, 0, 50, 50), groupId: "row", layoutItem: { width: "hug", height: "hug" } };
    const measure: HugMeasure = (layer, width) => (layer.id === "t" ? { width: width ?? 70, height: 24 } : null);
    const surface = laid(row({ width: "fixed", height: "hug", gap: 10, padding: { top: 5, right: 5, bottom: 5, left: 5 } }, [text, rect("grow", 0, 0, 10, 10, { layoutItem: { width: "fill" } })]), measure);
    expect(boxOf(surface, "t")).toEqual({ left: 455, top: 455, width: 70, height: 24 });
    expect(boxOf(surface, "grow")).toEqual({ left: 535, top: 455, width: 10, height: 10 });
    expect(boxOf(surface, "base")).toEqual({ left: 450, top: 450, width: 100, height: 34 });
  });

  it("keeps hug text as it is without a measure and skips hidden and absolute children", () => {
    const text: Layer = { id: "t", type: "text", text: "Oferta", fontId: "inter", fontSize: 0.02, transform: px(0, 0, 50, 30), groupId: "row", layoutItem: { width: "hug", height: "hug" } };
    const surface = laid(row({ gap: 10 }, [text, rect("ghost", 0, 0, 500, 500, { hidden: true }), rect("pin", 900, 900, 40, 40, { layoutItem: { absolute: true } }), rect("b", 0, 0, 20, 20)]));
    expect(boxOf(surface, "base")).toEqual({ left: 450, top: 450, width: 80, height: 30 });
    expect(boxOf(surface, "b").left).toBe(510);
    expect(boxOf(surface, "pin")).toEqual({ left: 880, top: 880, width: 40, height: 40 });
  });

  it("lays out nested layout groups as one item and fills them from the parent", () => {
    const inner: StudioGroup = { id: "col", parentId: "row", baseId: "colbase", layout: { direction: "vertical", width: "fixed", height: "hug", gap: 4 }, layoutItem: { width: "fill" } };
    const surface = laid(
      row({ width: "fixed", height: "hug", gap: 10 }, [rect("a", 0, 0, 30, 30), rect("colbase", 0, 0, 10, 10, { groupId: "col" }), rect("c1", 0, 0, 20, 20, { groupId: "col" }), rect("c2", 0, 0, 20, 10, { groupId: "col" })], [inner]),
    );
    expect(boxOf(surface, "colbase")).toEqual({ left: 490, top: 450, width: 60, height: 34 });
    expect(boxOf(surface, "c1")).toEqual({ left: 490, top: 450, width: 20, height: 20 });
    expect(boxOf(surface, "c2")).toEqual({ left: 490, top: 474, width: 20, height: 10 });
    expect(boxOf(surface, "base")).toEqual({ left: 450, top: 450, width: 100, height: 34 });
  });

  it("moves clip layers with the layer they clip", () => {
    const surface = laid(row({ gap: 0 }, [rect("a", 0, 0, 40, 40), rect("mask", 10, 10, 20, 20, { clip: true }), rect("b", 0, 0, 40, 40)]));
    expect(boxOf(surface, "a").left).toBe(450);
    expect(boxOf(surface, "mask")).toEqual({ left: 470, top: 470, width: 20, height: 20 });
    expect(boxOf(surface, "b").left).toBe(490);
  });

  it("refuses a result outside the stored ranges", () => {
    expect(layoutSurface(row({ gap: 9000 }, [rect("a", 0, 0, 40, 40), rect("b", 0, 0, 40, 40)]))).toBeNull();
  });

  it("infers a layout from the current arrangement", () => {
    expect(inferredLayout(row({}, [rect("a", 470, 500, 40, 40), rect("b", 530, 500, 40, 40)]), "row")).toEqual({ direction: "horizontal", gap: 20, padding: { top: 30, right: 0, bottom: 30, left: 0 }, alignCross: "center", width: "hug", height: "fixed" });
  });
});

describe("settling layouts", () => {
  function doc(surface: ImageSurface): ImageDocument {
    const artboard: Artboard = { id: "board", x: 0, y: 0, ...surface };
    const laidOut = laid(artboard) as Artboard;
    return imageDocument([laidOut]);
  }

  function edit(d: ImageDocument, recipe: (layers: Layer[]) => Layer[]): ImageDocument {
    return { ...d, artboards: [{ ...d.artboards[0], layers: recipe(d.artboards[0].layers) }] };
  }

  function surfaceOf(d: ImageDocument): ImageSurface {
    return d.artboards[0];
  }

  it("relays out after a child grows and leaves untouched documents alone", () => {
    const before = doc(row({ gap: 10 }, [rect("a", 0, 0, 40, 40), rect("b", 0, 0, 40, 40)]));
    expect(settleLayouts(before, before)).toBe(before);
    const grown = edit(before, (layers) => layers.map((l) => (l.id === "a" ? { ...l, transform: { ...l.transform, w: 0.08 } } : l)));
    const settled = settleLayouts(before, grown);
    expect(boxOf(surfaceOf(settled), "b").left).toBe(450 + 80 + 10);
    expect(boxOf(surfaceOf(settled), "base").width).toBe(130);
  });

  it("switches an axis to fixed when the base or a fill child is resized by hand", () => {
    const before = doc(row({ gap: 10, height: "fixed" }, [rect("a", 0, 0, 40, 40), rect("b", 0, 0, 40, 40, { layoutItem: { height: "fill" } })]));
    const wider = edit(before, (layers) => layers.map((l) => (l.id === "base" ? { ...l, transform: { ...l.transform, w: 0.2 } } : l)));
    const settled = settleLayouts(before, wider);
    expect(settled.artboards[0].groups?.[0].layout?.width).toBe("fixed");
    expect(boxOf(surfaceOf(settled), "base").width).toBe(200);
    const taller = edit(before, (layers) => layers.map((l) => (l.id === "b" ? { ...l, transform: { ...l.transform, h: 0.02 } } : l)));
    expect(settleLayouts(before, taller).artboards[0].layers.find((l) => l.id === "b")?.layoutItem).toBeUndefined();
  });

  it("turns a dragged child into a reorder", () => {
    const before = doc(row({ gap: 10 }, [rect("a", 0, 0, 40, 40), rect("b", 0, 0, 40, 40), rect("c", 0, 0, 40, 40)]));
    const dragged = edit(before, (layers) => layers.map((l) => (l.id === "a" ? { ...l, transform: { ...l.transform, x: 0.6 } } : l)));
    const settled = settleLayouts(before, dragged);
    expect(surfaceOf(settled).layers.map((l) => l.id)).toEqual(["base", "b", "c", "a"]);
    expect(boxOf(surfaceOf(settled), "a").left).toBe(450 + 100);
  });

  it("refuses a rotated base by keeping the document as it was", () => {
    const before = doc(row({ gap: 10 }, [rect("a", 0, 0, 40, 40), rect("b", 0, 0, 40, 40)]));
    const turned = edit(before, (layers) => layers.map((l) => (l.id === "base" ? { ...l, transform: { ...l.transform, rotation: 15 } } : l)));
    expect(settleLayouts(before, turned)).toBe(before);
  });
});
