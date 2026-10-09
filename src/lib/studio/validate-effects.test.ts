import { describe, expect, it } from "vitest";

import { emptyArtboard, newImageLayer, newShapeLayer, newTextLayer, type ImageSurface } from "./document";
import { documentIssue, surfaceIssue } from "./validate";

function richDocument(): ImageSurface {
  const doc = emptyArtboard({ width: 1080, height: 1080 });
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
    expect(surfaceIssue(richDocument())).toBeNull();
  });

  it.each<[string, (d: ImageSurface) => void]>([
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
  ])("refuses an invalid %s", (_, mutate) => {
    const doc = richDocument();
    mutate(doc);
    expect(surfaceIssue(doc)).not.toBeNull();
  });

  it("refuses unknown fields anywhere in the saved document", () => {
    const surface = { ...richDocument(), groups: [{ id: "outer", collapsed: true }] };
    const saved = { schema: "studio.image", version: 2, artboards: [{ id: "a1", x: 0, y: 0, ...surface }] };
    expect(documentIssue("image", saved)).toEqual({ field: "document", code: "invalid" });
  });
});

describe("scaffolds in the image document", () => {
  function scaffolded(): ImageSurface {
    const doc = richDocument();
    doc.groups = [{ id: "outer", name: "Cabeçalho" }, { id: "inner", parentId: "outer", baseId: "photo" }];
    return doc;
  }

  it("accepts a group whose base is one of its own layers", () => {
    expect(surfaceIssue(scaffolded())).toBeNull();
  });

  it.each<[string, (d: ImageSurface) => void]>([
    ["missing base", (d) => Object.assign(d.groups![1], { baseId: "ghost" })],
    ["base outside", (d) => Object.assign(d.groups![1], { baseId: "box" })],
    ["base token", (d) => Object.assign(d.groups![1], { baseId: "Not A Token" })],
    ["base of two", (d) => d.groups!.push({ id: "other", baseId: "photo" })],
    ["base nested deeper", (d) => {
      delete d.groups![1].baseId;
      d.groups![0].baseId = "photo";
    }],
  ])("refuses a scaffold with a %s", (_, mutate) => {
    const doc = scaffolded();
    mutate(doc);
    expect(surfaceIssue(doc)).not.toBeNull();
  });
});
