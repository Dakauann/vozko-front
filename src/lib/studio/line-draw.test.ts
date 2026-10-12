import { describe, expect, it } from "vitest";

import { drawLineFrame, type LinePen } from "./line-draw";
import type { LineFrame } from "./line-geometry";

interface Recorded {
  calls: string[];
  shapes: [number, number][][];
  pen: LinePen;
}

function recorder(): Recorded {
  const calls: string[] = [];
  const shapes: [number, number][][] = [];
  let current: [number, number][] = [];
  const pen = {
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    miterLimit: 10,
    strokeStyle: "",
    fillStyle: "",
    setLineDash: () => calls.push("dash"),
    beginPath: () => {
      calls.push("begin");
      current = [];
    },
    moveTo: (x: number, y: number) => {
      if (current.length > 0) shapes.push(current);
      current = [[x, y]];
    },
    lineTo: (x: number, y: number) => current.push([x, y]),
    arc: () => calls.push("arc"),
    closePath: () => calls.push("close"),
    stroke: () => {
      if (current.length > 0) shapes.push(current);
      current = [];
      calls.push(`stroke ${pen.lineWidth} ${pen.lineCap} ${pen.lineJoin}`);
    },
    fill: () => {
      if (current.length > 0) shapes.push(current);
      current = [];
      calls.push("fill");
    },
  };
  return { calls, shapes, pen: pen as unknown as LinePen };
}

function frame(extra: Partial<LineFrame> = {}): LineFrame {
  return {
    runs: [
      {
        closed: false,
        points: [
          { x: 0, y: 0, width: 4 },
          { x: 10, y: 0, width: 4 },
          { x: 20, y: 0, width: 4 },
        ],
      },
    ],
    heads: [],
    width: 4,
    uniform: true,
    cap: "round",
    join: "round",
    miterLimit: 10,
    color: "#ff0000",
    ...extra,
  };
}

function area(shape: readonly [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < shape.length; i++) {
    const [x1, y1] = shape[i];
    const [x2, y2] = shape[(i + 1) % shape.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

describe("drawing a line frame", () => {
  it("strokes uniform runs natively with the layer caps and joins, without dashes", () => {
    const { calls, pen } = recorder();
    drawLineFrame(pen, frame());
    expect(calls).toEqual(["dash", "begin", "stroke 4 round round"]);
    expect(pen.strokeStyle).toBe("#ff0000");
  });

  it("closes a closed run so its seam is a join, not two caps", () => {
    const { calls, pen } = recorder();
    drawLineFrame(pen, frame({ runs: [{ ...frame().runs[0], closed: true }] }));
    expect(calls).toContain("close");
  });

  it("fills a varying width as one union of same-winding pieces, with round end caps", () => {
    const { calls, shapes, pen } = recorder();
    const tapered = frame({
      uniform: false,
      runs: [
        {
          closed: false,
          points: [
            { x: 0, y: 0, width: 0 },
            { x: 10, y: 0, width: 4 },
            { x: 20, y: 5, width: 2 },
          ],
        },
      ],
    });
    drawLineFrame(pen, tapered);
    expect(calls.filter((call) => call === "fill")).toHaveLength(1);
    expect(calls.filter((call) => call.startsWith("stroke"))).toHaveLength(0);
    expect(calls.filter((call) => call === "arc").length).toBeGreaterThanOrEqual(1);
    const quads = shapes.filter((shape) => shape.length === 4);
    expect(quads.length).toBeGreaterThan(0);
    expect(quads.every((quad) => area(quad) > 0)).toBe(true);
  });

  it("fills arrow heads and strokes the heads of lines", () => {
    const { calls, pen } = recorder();
    drawLineFrame(pen, frame({ heads: [{ points: [0, 0, 5, 5, 0, 10], stroked: true }, { points: [20, 0, 25, 5, 20, 10], stroked: false }] }));
    expect(calls.filter((call) => call === "fill")).toHaveLength(2);
    expect(calls.filter((call) => call.startsWith("stroke"))).toHaveLength(2);
  });

  it("draws nothing for an empty frame", () => {
    const { calls, pen } = recorder();
    drawLineFrame(pen, frame({ runs: [] }));
    expect(calls.filter((call) => call.startsWith("stroke") || call === "fill")).toHaveLength(0);
  });
});
