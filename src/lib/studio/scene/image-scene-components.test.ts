import { describe, expect, it } from "vitest";

import { liveParts } from "../components";
import { imageDocument, type Artboard } from "../document";
import { artboardScenes } from "./image-scene";

const component: Artboard = {
  id: "cta",
  component: true,
  x: 0,
  y: -300,
  canvas: { width: 400, height: 100, background: "" },
  layers: [{ id: "pill", type: "shape", shape: "rect", fill: "#111111", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } }],
};

const post: Artboard = {
  id: "post",
  x: 0,
  y: 0,
  canvas: { width: 1000, height: 1000, background: "#ffffff" },
  layers: [{ id: "inst", type: "instance", componentId: "cta", transform: { x: 0.5, y: 0.8, w: 0.4, h: 0.1, rotation: 0, opacity: 1 } }],
};

const none = { hidden: new Set<string>(), overrides: new Map() };

describe("instances in artboard scenes", () => {
  it("draw the component parts where the instance sits", () => {
    const [scene] = artboardScenes(imageDocument([post, component]), none);
    expect(scene.nodes.map((n) => n.id)).toEqual(["inst;pill"]);
    expect(scene.nodes[0].box).toMatchObject({ x: 500, y: 800 });
  });

  it("follow a live drag of the instance through its part transforms", () => {
    const doc = imageDocument([post, component]);
    const moved = liveParts(doc, post, new Map([["inst", { ...post.layers[0].transform, x: 0.3, w: 0.8, h: 0.2 }]]));
    const [still] = artboardScenes(doc, none);
    const [scene] = artboardScenes(doc, { hidden: new Set(), overrides: moved });
    expect(scene.nodes[0].box.x).toBeCloseTo(300);
    expect(scene.nodes[0].box.width).toBeCloseTo(still.nodes[0].box.width * 2);
  });
});
