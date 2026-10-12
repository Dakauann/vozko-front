import { describe, expect, it } from "vitest";

import { removeLayout, setLayout, setLayoutItem } from "./auto-layout-edits";
import type { ImageSurface, Layer } from "./document";
import { surfaceIssue } from "./validate";

const CANVAS = { width: 1000, height: 1000 };

function px(x: number, y: number, w: number, h: number, rotation = 0) {
  return { x: x / 1000, y: y / 1000, w: w / 1000, h: h / 1000, rotation, opacity: 1 };
}

const card: Layer = { id: "card", type: "shape", shape: "rect", fill: "#ffffff", transform: px(500, 500, 400, 300) };
const title: Layer = { id: "title", type: "text", text: "Oferta", fontId: "inter", fontSize: 0.03, transform: px(500, 420, 300, 40) };
const button: Layer = { id: "button", type: "shape", shape: "rect", fill: "#e4003a", transform: px(500, 560, 200, 60) };

function surface(layers: Layer[] = [card, title, button]): ImageSurface {
  return { canvas: { ...CANVAS, background: "#ffffff" }, layers };
}

function boxOf(s: ImageSurface, id: string) {
  const t = s.layers.find((l) => l.id === id)!.transform;
  return { left: Math.round((t.x - t.w / 2) * 1000), top: Math.round((t.y - t.h / 2) * 1000), width: Math.round(t.w * 1000), height: Math.round(t.h * 1000) };
}

describe("setting a layout", () => {
  it("builds a scaffold on the bottom shape of a selection and infers the layout", () => {
    const result = setLayout(surface(), { ids: ["card", "title", "button"] }, {});
    if (!result.ok) throw new Error(result.reason);
    expect(surfaceIssue(result.document)).toBeNull();
    const group = result.document.groups?.find((g) => g.id === result.groupId);
    expect(group).toMatchObject({ baseId: "card", layout: { direction: "vertical", width: "fixed", height: "hug" } });
    expect(boxOf(result.document, "title").top).toBe(400);
  });

  it("adds a clear base under a selection without one and applies the given values", () => {
    const result = setLayout(surface([title, button]), { ids: ["title", "button"] }, { direction: "horizontal", gap: 12, padding: { top: 8, right: 8, bottom: 8, left: 8 }, width: "hug", height: "hug" });
    if (!result.ok) throw new Error(result.reason);
    expect(surfaceIssue(result.document)).toBeNull();
    const group = result.document.groups!.find((g) => g.id === result.groupId)!;
    const base = result.document.layers.find((l) => l.id === group.baseId)!;
    expect(base).toMatchObject({ type: "shape", shape: "rect", fill: "#00000000" });
    expect(result.document.layers[0].id).toBe(base.id);
    expect(boxOf(result.document, base.id).width).toBe(8 + 300 + 12 + 200 + 8);
  });

  it("updates an existing layout and drops values that mean nothing", () => {
    const first = setLayout(surface(), { ids: ["card", "title", "button"] }, {});
    if (!first.ok) throw new Error(first.reason);
    const spread = setLayout(first.document, { groupId: first.groupId }, { autoGap: true, height: "fixed" });
    if (!spread.ok) throw new Error(spread.reason);
    const layout = spread.document.groups!.find((g) => g.id === first.groupId)!.layout!;
    expect(layout.autoGap).toBe(true);
    expect(layout.gap).toBeUndefined();
    expect(layout.alignMain).toBeUndefined();
  });

  it("refuses a turned base and a result off the canvas range", () => {
    expect(setLayout(surface([{ ...card, transform: px(500, 500, 400, 300, 10) }, title, button]), { ids: ["card", "title", "button"] }, {})).toEqual({ ok: false, reason: "base" });
    const first = setLayout(surface(), { ids: ["card", "title", "button"] }, {});
    if (!first.ok) throw new Error(first.reason);
    expect(setLayout(first.document, { groupId: first.groupId }, { gap: 9000 })).toEqual({ ok: false, reason: "range" });
    expect(setLayout(surface(), { groupId: "ghost" }, {})).toEqual({ ok: false, reason: "missing" });
  });
});

describe("layout items and removal", () => {
  function laid() {
    const result = setLayout(surface(), { ids: ["card", "title", "button"] }, { direction: "vertical", width: "hug", height: "hug" });
    if (!result.ok) throw new Error(result.reason);
    return result;
  }

  it("fills a child, switching the hugging parent to fixed on that axis", () => {
    const { document, groupId } = laid();
    const result = setLayoutItem(document, "button", { width: "fill" });
    if (!result.ok) throw new Error(result.reason);
    expect(result.fixed).toEqual(["width"]);
    expect(result.document.groups!.find((g) => g.id === groupId)!.layout!.width).toBe("fixed");
    expect(boxOf(result.document, "button").width).toBe(boxOf(result.document, "card").width - 100);
    expect(setLayoutItem(document, "button", { width: "hug" })).toEqual({ ok: false, reason: "invalid" });
    expect(setLayoutItem(document, "card", { width: "fill" })).toEqual({ ok: false, reason: "invalid" });
    expect(setLayoutItem(document, "ghost", { width: "fill" })).toEqual({ ok: false, reason: "missing" });
  });

  it("removes the layout and every item setting, keeping positions", () => {
    const { document, groupId } = laid();
    const withItem = setLayoutItem(document, "title", { absolute: true });
    if (!withItem.ok) throw new Error(withItem.reason);
    const removed = removeLayout(withItem.document, groupId);
    expect(removed.groups!.find((g) => g.id === groupId)!.layout).toBeUndefined();
    expect(removed.layers.find((l) => l.id === "title")!.layoutItem).toBeUndefined();
    expect(boxOf(removed, "button")).toEqual(boxOf(withItem.document, "button"));
  });
});
