import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newOverlayClip, newShapeLayer, newTextLayer, type Clip, type VideoDocument } from "./document";
import { curvePath } from "./paint";
import { pathToSubpaths } from "./path-nodes";
import { newTextPath, pathOffsetAt, reshapedTextPath, textPathData, textPathIssue, textPathPatch, usesBend, type TextPath } from "./text-path";
import { PATH_OFFSET_RANGE } from "./text-properties";
import { documentIssue } from "./validate";

function textClip(patch: Partial<Clip> = {}, curve?: number): Clip {
  return { ...newOverlayClip({ ...newTextLayer("Oferta"), id: "l-arc", ...(curve !== undefined ? { curve } : {}) }, 0, 3000), id: "c-arc", ...patch };
}

function film(clip: Clip): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.durationMs = 3000;
  doc.tracks = [{ id: "t-1", kind: "visual", clips: [clip] }];
  return doc;
}

const arc: TextPath = { shape: "arc", bend: 0.6, offset: 0.5, align: "center" };

describe("text path geometry", () => {
  it("bends the arc like the curve control", () => {
    expect(textPathData(arc, 400, 100)).toBe(curvePath(400, 100, 0.6));
  });

  it("runs the circle clockwise from the bottom so the middle of the text sits on top", () => {
    const [ring] = pathToSubpaths(textPathData({ shape: "circle", offset: 0.5, align: "center" }, 200, 100));
    expect(ring.closed).toBe(true);
    expect(ring.nodes[0]).toMatchObject({ x: 100, y: 100 });
    expect(ring.nodes[1].x).toBeCloseTo(0);
    expect(ring.nodes[2]).toMatchObject({ x: 100, y: 0 });
  });

  it("waves once across the box with the bend as height", () => {
    const [wave] = pathToSubpaths(textPathData({ shape: "wave", bend: 1, offset: 0.5, align: "center" }, 400, 100));
    expect(wave.nodes[0]).toMatchObject({ x: 0, y: 50 });
    expect(wave.nodes[wave.nodes.length - 1]).toMatchObject({ x: 400, y: 50 });
  });

  it("scales a custom path from box fractions", () => {
    expect(textPathData({ shape: "custom", path: "M0 1 L1 0", offset: 0, align: "start" }, 200, 100)).toBe("M0 100 L200 0");
  });

  it("keeps the preset curve when it becomes a custom path", () => {
    const custom = reshapedTextPath(arc, "custom", { width: 300, height: 120 });
    expect(custom.shape).toBe("custom");
    expect(custom.bend).toBeUndefined();
    expect(custom.offset).toBe(arc.offset);
    const preset = pathToSubpaths(textPathData(arc, 300, 120))[0].nodes;
    const kept = pathToSubpaths(textPathData(custom, 300, 120))[0].nodes;
    expect(kept.length).toBe(preset.length);
    kept.forEach((node, i) => {
      expect(node.x).toBeCloseTo(preset[i].x, 1);
      expect(node.y).toBeCloseTo(preset[i].y, 1);
    });
  });

  it("gives bend only to the shapes that use it", () => {
    expect(usesBend("arc")).toBe(true);
    expect(usesBend("wave")).toBe(true);
    expect(usesBend("circle")).toBe(false);
    expect(reshapedTextPath(arc, "circle", { width: 300, height: 120 }).bend).toBeUndefined();
    expect(reshapedTextPath({ shape: "circle", offset: 0.2, align: "start" }, "arc", { width: 300, height: 120 }).bend).toBeGreaterThan(0);
  });
});

describe("text path offset", () => {
  it("reads the static offset or the keys", () => {
    expect(pathOffsetAt(textClip({ textPath: arc }), 100)).toBe(0.5);
    const keyed = textClip({ textPath: arc, keyframes: { pathOffset: [{ atMs: 0, value: -1, easing: "linear" }, { atMs: 1000, value: 1, easing: "linear" }] } });
    expect(pathOffsetAt(keyed, 500)).toBe(0);
  });
});

describe("text path rules", () => {
  it("accepts every shape on a text overlay", () => {
    for (const shape of ["arc", "circle", "wave", "custom"] as const) {
      const path = newTextPath(shape);
      const clip = textClip({ textPath: path, keyframes: { pathOffset: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 900, value: 1, easing: "easeOut" }] } });
      expect(textPathIssue(clip)).toBeNull();
      expect(documentIssue("video", film(clip))).toBeNull();
    }
  });

  it("refuses text paths on anything but text, and on curved text", () => {
    const shape = { ...newOverlayClip(newShapeLayer("rect"), 0, 3000), id: "c-shape", textPath: arc };
    expect(textPathIssue(shape)).toBe("invalid");
    expect(textPathIssue(textClip({ textPath: arc }, 0.4))).toBe("invalid");
    expect(documentIssue("video", film(textClip({ textPath: arc }, 0.4)))).not.toBeNull();
  });

  it("checks every field", () => {
    expect(textPathIssue(textClip({ textPath: { ...arc, shape: "spiral" as TextPath["shape"] } }))).toBe("unknown");
    expect(textPathIssue(textClip({ textPath: { ...arc, align: "middle" as TextPath["align"] } }))).toBe("unknown");
    expect(textPathIssue(textClip({ textPath: { ...arc, bend: 2 } }))).toBe("out_of_range");
    expect(textPathIssue(textClip({ textPath: { ...arc, bend: undefined } }))).toBe("invalid");
    expect(textPathIssue(textClip({ textPath: { shape: "circle", bend: 0.5, offset: 0, align: "start" } }))).toBe("invalid");
    expect(textPathIssue(textClip({ textPath: { shape: "custom", offset: 0, align: "start" } }))).toBe("invalid");
    expect(textPathIssue(textClip({ textPath: { shape: "custom", path: "nope", offset: 0, align: "start" } }))).toBe("invalid");
    expect(textPathIssue(textClip({ textPath: { ...arc, path: "M0 0 L1 1" } }))).toBe("invalid");
    expect(textPathIssue(textClip({ textPath: { ...arc, offset: PATH_OFFSET_RANGE[1] + 1 } }))).toBe("out_of_range");
  });

  it("refuses offset keys without a text path", () => {
    const clip = textClip({ keyframes: { pathOffset: [{ atMs: 0, value: 0, easing: "linear" }] } });
    expect(textPathIssue(clip)).toBe("invalid");
  });
});

describe("text path edits", () => {
  it("turns a curved text into an arc path with the same bend", () => {
    const clip = textClip({}, -0.4);
    const patch = textPathPatch(clip, newTextPath("arc", clip.layer));
    expect(patch.textPath).toMatchObject({ shape: "arc", bend: -0.4 });
    expect(patch.layer?.curve).toBeUndefined();
    expect(textPathIssue({ ...clip, ...patch })).toBeNull();
  });

  it("turns the path off together with its keys", () => {
    const clip = textClip({ textPath: arc, keyframes: { pathOffset: [{ atMs: 0, value: 0, easing: "linear" }] } });
    expect(textPathPatch(clip, null)).toEqual({ textPath: undefined, keyframes: undefined });
  });
});
