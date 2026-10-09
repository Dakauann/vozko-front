import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, newTextLayer, type Transform } from "../document";
import { clipMarkNumbers, imageMarkTargets, markRadius, placeMarks } from "./marks";

const box = (x: number, y: number, w: number, h: number, rotation = 0): Transform => ({ x, y, w, h, rotation, opacity: 1 });

describe("set of marks", () => {
  it("numbers the visible layers from the bottom up", () => {
    const doc = emptyArtboard({ width: 1080, height: 1080 });
    doc.layers = [
      { ...newShapeLayer("rect"), id: "back", transform: box(0.5, 0.5, 1, 1) },
      { ...newTextLayer("Oculto"), id: "hidden", hidden: true },
      { ...newTextLayer("Oferta"), id: "title", transform: box(0.5, 0.2, 0.6, 0.1) },
    ];
    expect(imageMarkTargets(doc).map(({ n, id }) => [n, id])).toEqual([
      [1, "back"],
      [2, "title"],
    ]);
    expect(imageMarkTargets(doc, 5).map(({ n }) => n)).toEqual([5, 6]);
  });

  it("puts each mark at the top left of its box, inside the canvas", () => {
    const radius = markRadius(1000, 1000);
    const [full, title, turned] = placeMarks(
      [
        { n: 1, id: "full", transform: box(0.5, 0.5, 1, 1) },
        { n: 2, id: "title", transform: box(0.5, 0.2, 0.6, 0.1) },
        { n: 3, id: "turned", transform: box(0.5, 0.7, 0.2, 0.2, 45) },
      ],
      1000,
      1000,
      radius,
    );
    expect(full).toEqual({ n: 1, id: "full", x: radius, y: radius });
    expect(title).toMatchObject({ x: 200 + radius, y: 150 + radius });
    expect(turned.x).toBeCloseTo(500 - 100 * Math.SQRT2 + radius, 5);
  });

  it("moves a mark aside when it would cover another one", () => {
    const radius = 10;
    const [first, second] = placeMarks(
      [
        { n: 1, id: "a", transform: box(0.5, 0.5, 0.4, 0.4) },
        { n: 2, id: "b", transform: box(0.5, 0.5, 0.4, 0.4) },
      ],
      500,
      500,
      radius,
    );
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThanOrEqual(radius * 2);
  });

  it("gives every visual clip one number for the whole video", () => {
    const doc = emptyVideoDocument("story");
    doc.tracks = [
      { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "a", 0, 1000), id: "clip" }] },
      { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "m", 0, 1000), id: "music" }] },
      { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 1000), id: "title" }] },
    ];
    expect([...clipMarkNumbers(doc)]).toEqual([
      ["clip", 1],
      ["title", 2],
    ]);
  });
});
