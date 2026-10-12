import { describe, expect, it } from "vitest";

import { affineOf, cssMatrix3d, DEFAULT_PERSPECTIVE, invertAffine, invertHomography, lensOf, multiplyHomography, pieceQuad, projectHomography, projectPoint, quadReach, scaledHomography, tiltHomography, turned3d, type Homography } from "./perspective";

const FRAME = { width: 1920, height: 1080 };
const close = (a: number, b: number, digits = 9) => expect(a).toBeCloseTo(b, digits);

describe("the lens", () => {
  it("places the eye so the angle of view spans the frame height", () => {
    const lens = lensOf(90, FRAME.width, FRAME.height);
    close(lens.distance, 540);
    expect(lens.center).toEqual({ x: 960, y: 540 });
  });

  it("is flat at zero degrees", () => {
    expect(lensOf(0, FRAME.width, FRAME.height).distance).toBe(Infinity);
  });

  it("uses forty degrees by default", () => {
    expect(DEFAULT_PERSPECTIVE).toBe(40);
  });
});

describe("turning in depth", () => {
  it("turns around Y first so a positive Y turn sends the right side away", () => {
    const right = turned3d({ x: 0, y: 45 }, { x: 1, y: 0, z: 0 });
    close(right.x, Math.SQRT1_2);
    close(right.z, Math.SQRT1_2);
  });

  it("sends the top away on a positive X turn", () => {
    const top = turned3d({ x: 30, y: 0 }, { x: 0, y: -1, z: 0 });
    close(top.y, -Math.cos(Math.PI / 6));
    close(top.z, Math.sin(Math.PI / 6));
  });
});

describe("the tilt homography", () => {
  const lens = lensOf(DEFAULT_PERSPECTIVE, FRAME.width, FRAME.height);
  const pivot = { x: 700, y: 500 };

  it("keeps the pivot in place", () => {
    const h = tiltHomography(lens, pivot, { x: 20, y: 45 });
    const at = projectHomography(h, pivot)!;
    close(at.x, 700);
    close(at.y, 500);
  });

  it("matches projecting the turned point by hand", () => {
    const tilt = { x: 15, y: 45 };
    const h = tiltHomography(lens, pivot, tilt);
    const point = { x: 900, y: 420 };
    const q = turned3d(tilt, { x: point.x - pivot.x, y: point.y - pivot.y, z: 0 });
    const want = projectPoint(lens, { x: pivot.x + q.x, y: pivot.y + q.y, z: q.z })!;
    const got = projectHomography(h, point)!;
    close(got.x, want.x);
    close(got.y, want.y);
  });

  it("shrinks the far side and grows the near side", () => {
    const h = tiltHomography(lens, { x: 960, y: 540 }, { x: 0, y: 45 });
    const right = projectHomography(h, { x: 1160, y: 340 })!;
    const left = projectHomography(h, { x: 760, y: 340 })!;
    expect(540 - right.y).toBeLessThan(200);
    expect(540 - left.y).toBeGreaterThan(200);
  });

  it("is a plain squash when the lens is flat", () => {
    const h = tiltHomography(lensOf(0, FRAME.width, FRAME.height), { x: 960, y: 540 }, { x: 0, y: 60 });
    const at = projectHomography(h, { x: 1160, y: 300 })!;
    close(at.x, 1060);
    close(at.y, 300);
  });

  it("reports points that fall behind the eye", () => {
    const wide = lensOf(120, FRAME.width, FRAME.height);
    const h = tiltHomography(wide, { x: 1900, y: 540 }, { x: 0, y: 80 });
    expect(projectHomography(h, { x: 0, y: 540 })).toBeNull();
  });

  it("inverts back to the plane", () => {
    const h = tiltHomography(lens, pivot, { x: 25, y: -35 });
    const back = invertHomography(h)!;
    const point = { x: 1200, y: 800 };
    const there = projectHomography(back, projectHomography(h, point)!)!;
    close(there.x, point.x, 6);
    close(there.y, point.y, 6);
    const identity = multiplyHomography(h, back);
    identity.forEach((value, i) => close(value / identity[8], [1, 0, 0, 0, 1, 0, 0, 0, 1][i], 9));
  });

  it("rescales into another unit square", () => {
    const h = tiltHomography(lens, pivot, { x: 10, y: 30 });
    const fraction = scaledHomography(h, FRAME.width, FRAME.height);
    const px = projectHomography(h, { x: 1000, y: 600 })!;
    const fr = projectHomography(fraction, { x: 1000 / FRAME.width, y: 600 / FRAME.height })!;
    close(fr.x * FRAME.width, px.x, 6);
    close(fr.y * FRAME.height, px.y, 6);
  });

  it("writes a css matrix that maps the same points", () => {
    const h: Homography = [2, 0.5, 10, 0.25, 3, 20, 0.001, 0.002, 1];
    expect(cssMatrix3d(h)).toBe("matrix3d(2,0.25,0,0.001,0.5,3,0,0.002,0,0,1,0,10,20,0,1)");
  });
});

describe("the reach of a projected quad", () => {
  it("is zero when nothing moves out", () => {
    const corners = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(quadReach(corners, corners)).toBe(0);
  });

  it("measures how far the projected corners leave the box", () => {
    const box = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const shown = [{ x: -3, y: 0 }, { x: 10, y: -1 }, { x: 12, y: 10 }, { x: 0, y: 10 }];
    expect(quadReach(box, shown)).toBe(3);
  });

  it("is endless when a corner falls behind the eye", () => {
    const box = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(quadReach(box, [box[0], null, box[2], box[3]])).toBe(Infinity);
  });
});

describe("a tilted piece", () => {
  const lens = lensOf(DEFAULT_PERSPECTIVE, FRAME.width, FRAME.height);
  const frame = affineOf({ x: 960, y: 540, rotation: 0, scaleX: 1, scaleY: 1 });

  it("keeps an untilted piece where the sprite draws it", () => {
    const quad = pieceQuad({ x: 100, y: 0, width: 40, height: 60, rotation: 0 }, frame, lens)!;
    expect(quad.map((p) => [Math.round(p.x * 1e6) / 1e6, Math.round(p.y * 1e6) / 1e6])).toEqual([
      [1040, 510],
      [1080, 510],
      [1080, 570],
      [1040, 570],
    ]);
  });

  it("narrows to the cosine of a flip on a flat lens", () => {
    const flat = lensOf(0, FRAME.width, FRAME.height);
    const quad = pieceQuad({ x: 0, y: 0, width: 40, height: 60, rotation: 0, rotationY: 60 }, frame, flat)!;
    close(quad[1].x - quad[0].x, 20, 6);
  });

  it("mirrors at a half turn", () => {
    const quad = pieceQuad({ x: 0, y: 0, width: 40, height: 60, rotation: 0, rotationY: 180 }, frame, lens)!;
    expect(quad[0].x).toBeGreaterThan(quad[1].x);
  });

  it("moves with its depth toward the middle of the frame", () => {
    const near = pieceQuad({ x: 400, y: 0, width: 40, height: 60, rotation: 0 }, frame, lens)!;
    const far = pieceQuad({ x: 400, y: 0, width: 40, height: 60, rotation: 0, depth: 500 }, frame, lens)!;
    expect(far[0].x).toBeLessThan(near[0].x);
    expect(far[1].x - far[0].x).toBeLessThan(40);
  });

  it("follows the container turn and stretch", () => {
    const turned = affineOf({ x: 960, y: 540, rotation: 90, scaleX: 2, scaleY: 2 });
    const quad = pieceQuad({ x: 10, y: 0, width: 4, height: 6, rotation: 0 }, turned, lensOf(0, FRAME.width, FRAME.height))!;
    close(quad[0].x, 966, 6);
    close(quad[0].y, 556, 6);
    const back = invertAffine(turned)!;
    close(back[0] * quad[0].x + back[2] * quad[0].y + back[4], 8, 6);
  });

  it("hides behind the eye", () => {
    const wide = lensOf(120, FRAME.width, FRAME.height);
    expect(pieceQuad({ x: 0, y: 0, width: 40, height: 60, rotation: 0, depth: -wide.distance }, frame, wide)).toBeNull();
  });
});
