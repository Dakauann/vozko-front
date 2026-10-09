import { describe, expect, it } from "vitest";

import { isSmooth } from "./path-nodes";
import { constrainAngle, EMPTY_PEN, penDrag, penFinish, penPress, penUndo } from "./pen";

describe("pen tool", () => {
  it("places corners on clicks and finishes an open path", () => {
    let draft = penPress(EMPTY_PEN, { x: 0, y: 0 }, 6).draft;
    draft = penPress(draft, { x: 100, y: 0 }, 6).draft;
    draft = penPress(draft, { x: 100, y: 100 }, 6).draft;
    expect(penFinish(draft)).toEqual({ closed: false, nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] });
  });

  it("drags out symmetric handles for a smooth node, and Alt moves only the outgoing one", () => {
    let draft = penPress(EMPTY_PEN, { x: 0, y: 0 }, 6).draft;
    draft = penPress(draft, { x: 100, y: 0 }, 6).draft;
    const smooth = penDrag(draft, { x: 140, y: 30 }, false);
    expect(smooth.nodes[1]).toEqual({ x: 100, y: 0, in: { x: 60, y: -30 }, out: { x: 140, y: 30 } });
    expect(isSmooth(smooth.nodes[1])).toBe(true);
    const broken = penDrag(smooth, { x: 100, y: 60 }, true);
    expect(broken.nodes[1].in).toEqual({ x: 60, y: -30 });
    expect(broken.nodes[1].out).toEqual({ x: 100, y: 60 });
  });

  it("closes the path when the first node is clicked", () => {
    let draft = penPress(EMPTY_PEN, { x: 0, y: 0 }, 6).draft;
    draft = penPress(draft, { x: 100, y: 0 }, 6).draft;
    draft = penPress(draft, { x: 50, y: 80 }, 6).draft;
    const closing = penPress(draft, { x: 3, y: -2 }, 6);
    expect(closing.finished).toBe(true);
    expect(penFinish(closing.draft)).toMatchObject({ closed: true, nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }] });
  });

  it("does not stack a second point on the last one, so a double click can finish", () => {
    let draft = penPress(EMPTY_PEN, { x: 0, y: 0 }, 6).draft;
    draft = penPress(draft, { x: 100, y: 0 }, 6).draft;
    draft = penPress(draft, { x: 101, y: 1 }, 6).draft;
    expect(draft.nodes).toHaveLength(2);
  });

  it("removes the last point while drawing", () => {
    let draft = penPress(EMPTY_PEN, { x: 0, y: 0 }, 6).draft;
    draft = penPress(draft, { x: 100, y: 0 }, 6).draft;
    expect(penUndo(draft).nodes).toEqual([{ x: 0, y: 0 }]);
    expect(penUndo(EMPTY_PEN)).toBe(EMPTY_PEN);
  });

  it("needs two points to make a path", () => {
    expect(penFinish(penPress(EMPTY_PEN, { x: 0, y: 0 }, 6).draft)).toBeNull();
  });

  it("snaps a direction to steps of 45 degrees", () => {
    const snapped = constrainAngle({ x: 0, y: 0 }, { x: 100, y: 10 });
    expect(snapped.y).toBeCloseTo(0);
    expect(snapped.x).toBeCloseTo(Math.hypot(100, 10));
    const diagonal = constrainAngle({ x: 0, y: 0 }, { x: 50, y: 60 });
    expect(diagonal.x).toBeCloseTo(diagonal.y);
  });
});
