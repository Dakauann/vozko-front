import { describe, expect, it } from "vitest";

import { emptyArtboard, newShapeLayer, newTextLayer, STUDIO_LIMITS, type Layer } from "./document";
import { clipboardOf, decodeClipboard, encodeClipboard, CLIPBOARD_PREFIX } from "./clipboard";
import { pasteLayers } from "./layers";
import { surfaceIssue } from "./validate";

const canvas = { width: 1000, height: 1000 };

function rect(id: string, extra: Partial<Layer> = {}): Layer {
  return { ...newShapeLayer("rect"), id, ...extra };
}

describe("clipboard payload", () => {
  it("round trips layers with their groups through text", () => {
    const doc = { ...emptyArtboard(canvas), layers: [rect("a", { groupId: "g" }), rect("b", { groupId: "g" }), newTextLayer("Oi")], groups: [{ id: "g", name: "Topo" }] };
    const content = clipboardOf(doc, ["a", "b"]);
    expect(content).toEqual({ layers: doc.layers.slice(0, 2), groups: doc.groups });
    const text = encodeClipboard(content);
    expect(text.startsWith(CLIPBOARD_PREFIX)).toBe(true);
    expect(decodeClipboard(text)).toEqual(content);
  });

  it("refuses text that is not ours, broken, empty or holds an invalid layer", () => {
    const wrap = (layers: unknown, extra: object = {}) => `${CLIPBOARD_PREFIX}${JSON.stringify({ layers, ...extra })}`;
    expect(decodeClipboard("hello")).toBeNull();
    expect(decodeClipboard(`${CLIPBOARD_PREFIX}{oops`)).toBeNull();
    expect(decodeClipboard(wrap([]))).toBeNull();
    expect(decodeClipboard(wrap([{ ...newTextLayer("x"), text: "" }]))).toBeNull();
    expect(decodeClipboard(wrap([{ ...rect("a"), extra: 1 }]))).toBeNull();
    expect(decodeClipboard(wrap([rect("a")], { canvas: {} }))).toBeNull();
    expect(decodeClipboard(wrap([rect("a")], { groups: [{ id: "g", parentId: "g" }] }))).toBeNull();
  });

  it("takes any number of layers that fit in a document", () => {
    const many = Array.from({ length: 600 }, (_, i) => rect(`l${i}`));
    expect(decodeClipboard(encodeClipboard({ layers: many, groups: [] }))?.layers).toHaveLength(600);
  });

  it("refuses clipboard text larger than a document can be", () => {
    const huge = `${encodeClipboard({ layers: [rect("a")], groups: [] })}${" ".repeat(STUDIO_LIMITS.maxDocumentBytes)}`;
    expect(decodeClipboard(huge)).toBeNull();
  });
});

describe("pasteLayers", () => {
  it("adds fresh copies on top with an offset, unlocked, keeping groups together under a new id", () => {
    const doc = { ...emptyArtboard(canvas), layers: [rect("a")] };
    const copied = [rect("a"), rect("b", { groupId: "g", locked: true }), rect("c", { groupId: "g" })];
    const { document, ids } = pasteLayers(doc, copied, 0.02);
    expect(ids).toHaveLength(3);
    expect(document.layers.slice(1).map((l) => l.id)).toEqual(ids);
    expect(new Set(ids).has("a")).toBe(false);
    const [, b, c] = document.layers.slice(1);
    expect(b.groupId).toBeDefined();
    expect(b.groupId).not.toBe("g");
    expect(b.groupId).toBe(c.groupId);
    expect(b.locked).toBeUndefined();
    expect(b.transform.x).toBeCloseTo(0.52);
    expect(surfaceIssue(document)).toBeNull();
  });

  it("drops a group id left with a single member", () => {
    const doc = emptyArtboard(canvas);
    const { document } = pasteLayers(doc, [rect("b", { groupId: "g" })], 0);
    expect(document.layers[0].groupId).toBeUndefined();
  });

  it("pastes onto a design that already has many layers", () => {
    const doc = { ...emptyArtboard(canvas), layers: Array.from({ length: 600 }, (_, i) => rect(`l${i}`)) };
    const result = pasteLayers(doc, [rect("x")], 0.02);
    expect(result.ids).toHaveLength(1);
    expect(result.document.layers).toHaveLength(601);
  });
});
