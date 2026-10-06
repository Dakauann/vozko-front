import { describe, expect, it } from "vitest";

import { emptyImageDocument, newImageLayer, newShapeLayer, newTextLayer, type ImageDocument } from "./document";
import { documentIssue } from "./validate";

function richDocument(): ImageDocument {
  const doc = emptyImageDocument({ width: 1080, height: 1080 });
  doc.canvas.gradient = { from: "#ff0000", to: "#0000ff", angle: 45 };
  doc.layers = [
    { ...newImageLayer("m-1"), id: "photo", blendMode: "multiply", frame: "ellipse", groupId: "inner" },
    { ...newTextLayer("Oferta"), id: "title", clip: true, highlight: { color: "#ffee00", radius: 0.3 }, curve: -0.5, gradient: { from: "#111111", to: "#eeeeee", angle: 0 }, groupId: "inner" },
    { ...newShapeLayer("rect"), id: "box", gradient: { from: "#111111", to: "#eeeeee", angle: 90 } },
  ];
  doc.groups = [{ id: "outer", name: "Cabeçalho" }, { id: "inner", parentId: "outer" }];
  return doc;
}

describe("effects, blending and groups in the image document", () => {
  it("accepts the full set the backend accepts", () => {
    expect(documentIssue("image", richDocument())).toBeNull();
  });

  it.each<[string, (d: ImageDocument) => void]>([
    ["blend", (d) => Object.assign(d.layers[0], { blendMode: "dissolve" })],
    ["frame", (d) => Object.assign(d.layers[0], { frame: "arrow" })],
    ["curve", (d) => Object.assign(d.layers[1], { curve: 1.5 })],
    ["highlight", (d) => Object.assign(d.layers[1], { highlight: { color: "yellow", radius: 0 } })],
    ["gradient", (d) => Object.assign(d.layers[1], { gradient: { from: "#111111", to: "", angle: 0 } })],
    ["canvas gradient", (d) => Object.assign(d.canvas, { gradient: { from: "#111111", to: "#222222", angle: 999 } })],
    ["unknown parent", (d) => Object.assign(d, { groups: [{ id: "inner", parentId: "ghost" }] })],
    ["cycle", (d) => Object.assign(d, { groups: [{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }] })],
    ["self parent", (d) => Object.assign(d, { groups: [{ id: "a", parentId: "a" }] })],
    ["duplicate group", (d) => Object.assign(d, { groups: [{ id: "a" }, { id: "a" }] })],
    ["group token", (d) => Object.assign(d, { groups: [{ id: "Not A Token" }] })],
    ["unknown group field", (d) => Object.assign(d, { groups: [{ id: "a", collapsed: true }] })],
  ])("refuses an invalid %s", (_, mutate) => {
    const doc = richDocument();
    mutate(doc);
    expect(documentIssue("image", doc)).not.toBeNull();
  });
});
