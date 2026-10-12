import { describe, expect, it } from "vitest";

import { boxCorners } from "../arrange";
import type { Transform } from "../document";
import { focusRegion, guideReport, lookViewOf } from "./look-views";

const box = (x: number, y: number, w: number, h: number, rotation = 0): Transform => ({ x, y, w, h, rotation, opacity: 1 });
const square = { width: 1000, height: 1000 };

describe("look views", () => {
  it("reads the view, defaulting to the plain render and refusing unknown names", () => {
    expect(lookViewOf(undefined)).toBe("render");
    expect(lookViewOf("wireframe")).toBe("wireframe");
    expect(lookViewOf("guides")).toBe("guides");
    expect(lookViewOf("depth")).toBe("depth");
    expect(lookViewOf("xray")).toBeNull();
  });

  it("draws a tilted layer by its real corners, not its upright bounding box", () => {
    const corners = boxCorners(box(0.5, 0.5, 0.2, 0.2, 45), square);
    const half = 100 * Math.SQRT2;
    expect(corners.map(([x]) => Math.round(x))).toEqual([500, Math.round(500 + half), 500, Math.round(500 - half)]);
    expect(corners[0][1]).toBeCloseTo(500 - half, 5);
  });

  it("finds edges and centers that several upright layers share", () => {
    const report = guideReport(
      [
        { n: 1, id: "title", transform: box(0.3, 0.2, 0.4, 0.1) },
        { n: 2, id: "body", transform: box(0.35, 0.4, 0.5, 0.2) },
        { n: 3, id: "badge", transform: box(0.8, 0.2, 0.2, 0.1) },
      ],
      square,
    );
    expect(report.lines).toContainEqual({ axis: "x", at: 0.1, ids: ["body", "title"] });
    expect(report.lines).toContainEqual({ axis: "y", at: 0.2, ids: ["badge", "title"] });
    expect(report.lines.every((line) => line.ids.length >= 2)).toBe(true);
  });

  it("groups tilted layers by angle and points at angles that are almost but not quite parallel", () => {
    const report = guideReport(
      [
        { n: 1, id: "band", transform: box(0.5, 0.6, 1.4, 0.2, -12) },
        { n: 2, id: "title", transform: box(0.5, 0.3, 0.8, 0.1, -12.4) },
        { n: 3, id: "seal", transform: box(0.8, 0.8, 0.2, 0.2, -14.5) },
        { n: 4, id: "logo", transform: box(0.1, 0.1, 0.1, 0.1) },
      ],
      square,
    );
    expect(report.angles).toEqual([
      { degrees: -14.5, ids: ["seal"] },
      { degrees: -12.2, ids: ["band", "title"] },
    ]);
    expect(report.notes).toHaveLength(1);
    expect(report.notes[0]).toContain("-14.5");
    expect(report.lines.flatMap((line) => line.ids)).not.toContain("band");
  });

  it("keeps quiet about angles that differ on purpose", () => {
    const report = guideReport(
      [
        { n: 1, id: "a", transform: box(0.3, 0.3, 0.2, 0.2, -12) },
        { n: 2, id: "b", transform: box(0.7, 0.7, 0.2, 0.2, 30) },
      ],
      square,
    );
    expect(report.notes).toEqual([]);
  });

  it("frames a layer with a margin around it, kept inside the artboard", () => {
    expect(focusRegion(box(0.5, 0.5, 0.2, 0.1), square)).toEqual({ x: 0.5, y: 0.5, w: 0.3, h: 0.15 });
    const corner = focusRegion(box(0.05, 0.95, 0.04, 0.02), square);
    expect(corner.w).toBeGreaterThanOrEqual(0.08);
    expect(corner.h).toBeGreaterThanOrEqual(0.08);
    expect(focusRegion(box(0.5, 0.5, 1.5, 1.5), square)).toEqual({ x: 0.5, y: 0.5, w: 1, h: 1 });
  });
});
