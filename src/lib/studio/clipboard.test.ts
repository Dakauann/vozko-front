import { describe, expect, it } from "vitest";

import { emptyImageDocument, newShapeLayer, newTextLayer, STUDIO_LIMITS, type Layer } from "./document";
import { clipboardOf, decodeClipboard, encodeClipboard, CLIPBOARD_PREFIX } from "./clipboard";
import { pasteLayers } from "./layers";
import { documentIssue } from "./validate";

const canvas = { width: 1000, height: 1000 };

function rect(id: string, extra: Partial<Layer> = {}): Layer {
  return { ...newShapeLayer("rect"), id, ...extra };
}

describe("clipboard payload", () => {
  it("round trips layers with their groups through text", () => {
    const doc = { ...emptyImageDocument(canvas), layers: [rect("a", { groupId: "g" }), rect("b", { groupId: "g" }), newTextLayer("Oi")], groups: [{ id: "g", name: "Topo" }] };
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

  it("refuses more layers than a document can hold", () => {
    const many = Array.from({ length: STUDIO_LIMITS.maxLayers + 1 }, (_, i) => rect(`l${i}`));
    expect(decodeClipboard(encodeClipboard({ layers: many, groups: [] }))).toBeNull();
  });
});

describe("pasteLayers", () => {
  it("adds fresh copies on top with an offset, unlocked, keeping groups together under a new id", () => {
    const doc = { ...emptyImageDocument(canvas), layers: [rect("a")] };
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
    expect(documentIssue("image", document)).toBeNull();
  });

  it("drops a group id left with a single member", () => {
    const doc = emptyImageDocument(canvas);
    const { document } = pasteLayers(doc, [rect("b", { groupId: "g" })], 0);
    expect(document.layers[0].groupId).toBeUndefined();
  });

  it("does nothing when the document would exceed the layer limit", () => {
    const doc = { ...emptyImageDocument(canvas), layers: Array.from({ length: STUDIO_LIMITS.maxLayers }, (_, i) => rect(`l${i}`)) };
    const result = pasteLayers(doc, [rect("x")], 0.02);
    expect(result.document).toBe(doc);
    expect(result.ids).toEqual([]);
  });
});
