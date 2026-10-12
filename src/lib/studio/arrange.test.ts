import { describe, expect, it } from "vitest";

import { alignShift, alignTarget, boxBounds, distributeShifts, unionBounds, type Bounds } from "./arrange";

const box = (left: number, top: number, right: number, bottom: number): Bounds => ({ left, top, right, bottom });

describe("boxBounds", () => {
  it("measures a centered box in pixels of the canvas", () => {
    expect(boxBounds({ x: 0.5, y: 0.25, w: 0.2, h: 0.1, rotation: 0, opacity: 1 }, { width: 1000, height: 2000 })).toEqual(box(400, 400, 600, 600));
  });

  it("grows to the axis aligned bounds of a turned box", () => {
    const turned = boxBounds({ x: 0.5, y: 0.5, w: 0.2, h: 0.1, rotation: 90, opacity: 1 }, { width: 1000, height: 1000 });
    expect(turned.left).toBeCloseTo(450);
    expect(turned.right).toBeCloseTo(550);
    expect(turned.top).toBeCloseTo(400);
    expect(turned.bottom).toBeCloseTo(600);
  });
});

describe("unionBounds", () => {
  it("covers every box", () => {
    expect(unionBounds([box(10, 20, 30, 40), box(0, 30, 20, 90)])).toEqual(box(0, 20, 30, 90));
  });
});

describe("alignTarget", () => {
  it("aligns one item to its container and several to their own bounds", () => {
    const frame = box(0, 0, 100, 100);
    expect(alignTarget([box(10, 10, 20, 20)], frame)).toEqual(frame);
    expect(alignTarget([box(10, 10, 20, 20), box(50, 0, 70, 30)], frame)).toEqual(box(10, 0, 70, 30));
  });
});

describe("alignShift", () => {
  const frame = box(0, 0, 100, 200);
  const item = box(10, 20, 30, 60);

  it.each([
    ["left", [-10, 0]],
    ["center", [30, 0]],
    ["right", [70, 0]],
    ["top", [0, -20]],
    ["middle", [0, 60]],
    ["bottom", [0, 140]],
  ] as const)("moves the item to the %s of the frame", (alignment, shift) => {
    expect(alignShift(item, frame, alignment)).toEqual(shift);
  });
});

describe("distributeShifts", () => {
  it("spaces the items evenly between the outermost ones, keeping the input order", () => {
    const shifts = distributeShifts([box(80, 0, 100, 10), box(0, 0, 20, 10), box(30, 0, 40, 10)], "horizontal");
    expect(shifts).toEqual([
      [0, 0],
      [0, 0],
      [15, 0],
    ]);
  });

  it("works vertically and leaves fewer than three items alone", () => {
    expect(distributeShifts([box(0, 0, 10, 10), box(0, 12, 10, 22), box(0, 90, 10, 100)], "vertical")).toEqual([
      [0, 0],
      [0, 33],
      [0, 0],
    ]);
    expect(distributeShifts([box(0, 0, 10, 10), box(50, 0, 60, 10)], "horizontal")).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});
