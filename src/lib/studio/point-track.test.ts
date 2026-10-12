import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { newMediaClip, type Clip } from "./document";
import { framePointOf } from "./clip-placement";
import { documentIssue } from "./validate";
import {
  boxPointOfFrame,
  frameJobOf,
  framePointOfBox,
  frameWindowAt,
  neededZoom,
  realOfShown,
  shownOfReal,
  stabilizeIssue,
  trackedPoint,
  trackerPointAt,
  trackersIssue,
  windowPlacement,
  type PointTracker,
  type Stabilize,
} from "./point-track";

const DIMS = { width: 1000, height: 500 };

function tracker(id: string, points: [number, number, number][], extra: Partial<PointTracker> = {}): PointTracker {
  return { id, frameWidth: DIMS.width, frameHeight: DIMS.height, size: 0.06, referenceMs: points[0][0], samples: points.map(([atMs, x, y]) => ({ atMs, x, y, confidence: 0.95 })), ...extra };
}

function video(extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("video", "m-1", 0, 4000), id: "v", ...extra };
}

const MOVING = tracker("a", [
  [0, 0.5, 0.5],
  [100, 0.52, 0.49],
  [200, 0.47, 0.53],
  [300, 0.55, 0.46],
]);

describe("a stored point track", () => {
  it("interpolates between frames and holds its ends", () => {
    expect(trackerPointAt(MOVING, 50)).toEqual({ x: 0.51, y: 0.495 });
    expect(trackerPointAt(MOVING, -20)).toEqual({ x: 0.5, y: 0.5 });
    expect(trackerPointAt(MOVING, 900)).toEqual({ x: 0.55, y: 0.46 });
    expect(trackerPointAt(MOVING, 200)).toEqual({ x: 0.47, y: 0.53 });
  });

  it("lives on video clips with strict samples", () => {
    expect(trackersIssue(video({ trackers: [MOVING] }))).toBeNull();
    expect(trackersIssue(video({ trackers: [] }))).toBeNull();
    const broken: Record<string, Partial<Clip>> = {
      "an image clip": { type: "image", trackers: [MOVING] },
      "two trackers with one id": { trackers: [MOVING, MOVING] },
      "a bad id": { trackers: [{ ...MOVING, id: "Bad Id" }] },
      "no samples": { trackers: [{ ...MOVING, samples: [] }] },
      "samples out of order": { trackers: [{ ...MOVING, samples: [...MOVING.samples].reverse(), referenceMs: 300 }] },
      "a repeated moment": { trackers: [{ ...MOVING, samples: [MOVING.samples[0], MOVING.samples[0]] }] },
      "a fractional moment": { trackers: [{ ...MOVING, samples: [{ ...MOVING.samples[0], atMs: 0.5 }], referenceMs: 0.5 }] },
      "a reference that is not a frame": { trackers: [{ ...MOVING, referenceMs: 150 }] },
      "a size too big": { trackers: [{ ...MOVING, size: 0.9 }] },
      "a frame of zero pixels": { trackers: [{ ...MOVING, frameWidth: 0 }] },
      "a fractional frame size": { trackers: [{ ...MOVING, frameHeight: 499.5 }] },
      "a long name": { trackers: [{ ...MOVING, name: "x".repeat(200) }] },
    };
    for (const [name, patch] of Object.entries(broken)) expect(trackersIssue(video(patch)), name).not.toBeNull();
    for (const sample of [{ x: 1.2 }, { y: -0.1 }, { confidence: 1.5 }, { x: Number.NaN }]) {
      expect(trackersIssue(video({ trackers: [{ ...MOVING, samples: [{ ...MOVING.samples[0], ...sample }, ...MOVING.samples.slice(1)] }] }))).toBe("out_of_range");
    }
  });
});

describe("stabilizing a clip", () => {
  const second = tracker("b", [
    [0, 0.7, 0.5],
    [100, 0.71, 0.53],
    [200, 0.68, 0.55],
    [300, 0.74, 0.47],
  ]);

  it("checks its trackers, its zoom and the steadiness it can take", () => {
    const ok: Stabilize = { trackerId: "a", zoom: 1.2 };
    expect(stabilizeIssue(video({ trackers: [MOVING], stabilize: ok }))).toBeNull();
    expect(stabilizeIssue(video({ trackers: [MOVING, second], stabilize: { trackerId: "a", secondTrackerId: "b", rotation: true, scale: true, smoothMs: 800, zoom: 1.5 } }))).toBeNull();
    const broken: Stabilize[] = [
      { trackerId: "ghost", zoom: 1.2 },
      { trackerId: "a", secondTrackerId: "a", zoom: 1.2 },
      { trackerId: "a", rotation: true, zoom: 1.2 },
      { trackerId: "a", scale: true, zoom: 1.2 },
      { trackerId: "a", zoom: 0.9 },
      { trackerId: "a", zoom: 5 },
      { trackerId: "a", smoothMs: 50, zoom: 1.2 },
      { trackerId: "a", smoothMs: 20000, zoom: 1.2 },
      { trackerId: "a", smoothMs: 120.5, zoom: 1.2 },
    ];
    for (const stabilize of broken) expect(stabilizeIssue(video({ trackers: [MOVING, second], stabilize })), JSON.stringify(stabilize)).not.toBeNull();
    expect(stabilizeIssue(video({ trackers: [MOVING], stabilize: ok, freeze: true }))).toBe("invalid");
    expect(stabilizeIssue(video({ trackers: [MOVING, { ...second, frameWidth: 640 }], stabilize: { trackerId: "a", secondTrackerId: "b", zoom: 1.2 } }))).toBe("invalid");
  });

  it("holds the tracked point still where it was at the reference frame", () => {
    const clip = video({ trackers: [MOVING], stabilize: { trackerId: "a", zoom: 1.25 } });
    const held = shownOfReal(frameWindowAt(clip, 0)!, DIMS, trackerPointAt(MOVING, 0));
    for (const ms of [40, 100, 170, 260, 300]) {
      const shown = shownOfReal(frameWindowAt(clip, ms)!, DIMS, trackerPointAt(MOVING, ms));
      expect(shown.x).toBeCloseTo(held.x, 9);
      expect(shown.y).toBeCloseTo(held.y, 9);
    }
    expect(held).toEqual({ x: 0.5, y: 0.5 });
  });

  it("holds a second point too when rotation and scale are countered", () => {
    const turning = tracker("b", [
      [0, 0.7, 0.5],
      [100, 0.66, 0.6],
      [200, 0.55, 0.65],
      [300, 0.75, 0.42],
    ]);
    const clip = video({ trackers: [MOVING, turning], stabilize: { trackerId: "a", secondTrackerId: "b", rotation: true, scale: true, zoom: 1.5 } });
    const first = (ms: number) => shownOfReal(frameWindowAt(clip, ms)!, DIMS, trackerPointAt(MOVING, ms));
    const other = (ms: number) => shownOfReal(frameWindowAt(clip, ms)!, DIMS, trackerPointAt(turning, ms));
    for (const ms of [0, 100, 150, 200, 300]) {
      expect(first(ms).x).toBeCloseTo(first(0).x, 9);
      expect(first(ms).y).toBeCloseTo(first(0).y, 9);
      expect(other(ms).x).toBeCloseTo(other(0).x, 9);
      expect(other(ms).y).toBeCloseTo(other(0).y, 9);
    }
  });

  it("maps between the shown and the real frame both ways", () => {
    const clip = video({ trackers: [MOVING, second], stabilize: { trackerId: "a", secondTrackerId: "b", rotation: true, zoom: 1.4 } });
    const window = frameWindowAt(clip, 170)!;
    const point = { x: 0.31, y: 0.77 };
    const back = shownOfReal(window, DIMS, realOfShown(window, DIMS, point));
    expect(back.x).toBeCloseTo(point.x, 12);
    expect(back.y).toBeCloseTo(point.y, 12);
  });

  it("places the frame in the renderer exactly where the shown frame mapping puts it", () => {
    const window = { x: 0.43, y: 0.58, scale: 0.7, rotation: 12 };
    const placed = windowPlacement(window, DIMS.width, DIMS.height);
    for (const real of [{ x: 0.2, y: 0.3 }, { x: 0.43, y: 0.58 }, { x: 0.9, y: 0.75 }]) {
      const ux = real.x * DIMS.width - DIMS.width / 2;
      const uy = real.y * DIMS.height - DIMS.height / 2;
      const drawn = { x: placed.x + placed.scale * (ux * Math.cos(placed.rotation) - uy * Math.sin(placed.rotation)), y: placed.y + placed.scale * (ux * Math.sin(placed.rotation) + uy * Math.cos(placed.rotation)) };
      const shown = shownOfReal(window, DIMS, real);
      expect(drawn.x).toBeCloseTo(shown.x * DIMS.width, 9);
      expect(drawn.y).toBeCloseTo(shown.y * DIMS.height, 9);
    }
  });

  it("removes shake but keeps a pan when smoothing", () => {
    const jitter = tracker(
      "a",
      Array.from({ length: 61 }, (_, n): [number, number, number] => [n * 33, 0.3 + n * 0.005 + (n % 2 === 0 ? 0.004 : -0.004), 0.5]),
    );
    const clip = video({ trackers: [jitter], stabilize: { trackerId: "a", smoothMs: 600, zoom: 1.1 } });
    const shown = jitter.samples.map((sample) => shownOfReal(frameWindowAt(clip, sample.atMs)!, DIMS, sample).x);
    const middle = shown.slice(15, 45);
    const steps = middle.slice(1).map((x, i) => x - middle[i]);
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(0.002);
    expect(middle.at(-1)! - middle[0]).toBeGreaterThan(0.1);
  });

  it("finds the least zoom that keeps the edges out of the picture", () => {
    const sway = tracker("a", [
      [0, 0.5, 0.5],
      [100, 0.55, 0.5],
      [200, 0.45, 0.5],
    ]);
    const clip = video({ trackers: [sway] });
    const zoom = neededZoom(clip, { trackerId: "a" }, [0, 200]);
    expect(zoom).toBeCloseTo(1 / 0.9, 2);
    expect(zoom).toBeGreaterThanOrEqual(1 / 0.9);
    const steady = video({ trackers: [sway], stabilize: { trackerId: "a", zoom: zoom! } });
    for (const ms of [0, 50, 100, 150, 200]) {
      const window = frameWindowAt(steady, ms)!;
      for (const corner of [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]) {
        const real = realOfShown(window, DIMS, corner);
        expect(real.x).toBeGreaterThanOrEqual(-1e-9);
        expect(real.x).toBeLessThanOrEqual(1 + 1e-9);
        expect(real.y).toBeGreaterThanOrEqual(-1e-9);
        expect(real.y).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
    expect(neededZoom(video({ trackers: [tracker("a", [[0, 0.5, 0.5], [100, 0.95, 0.5]])] }), { trackerId: "a" }, [0, 100])).toBeNull();
  });
});

describe("tracked points on the canvas", () => {
  it("maps frame points into the clip box for cover and contain, and back", () => {
    for (const fit of ["cover", "contain"] as const) {
      for (const aspect of [0.5, 1, 2, 3]) {
        const point = { x: 0.37, y: 0.61 };
        const box = boxPointOfFrame(point, DIMS, aspect, fit);
        const back = framePointOfBox(box, DIMS, aspect, fit);
        expect(back.x).toBeCloseTo(point.x, 12);
        expect(back.y).toBeCloseTo(point.y, 12);
      }
    }
    expect(boxPointOfFrame({ x: 0.5, y: 0.25 }, DIMS, 1, "cover")).toEqual({ x: 0.5, y: 0.25 });
    expect(boxPointOfFrame({ x: 0.25, y: 0.5 }, DIMS, 1, "contain")).toEqual({ x: 0.25, y: 0.5 });
  });

  it("puts a tracked point of a full frame clip on the canvas where the frame shows it", () => {
    const clip = video({ trackers: [MOVING] });
    const box = { ...clip.transform };
    expect(trackedPoint(clip, MOVING, 100, box, 2)).toEqual({ x: 0.52, y: 0.49 });
  });

  it("follows the box, its turn and its flips", () => {
    const clip = video({ trackers: [MOVING], flipX: true, transform: { x: 0.4, y: 0.6, w: 0.5, h: 0.5, rotation: 30, opacity: 1 } });
    const placed = { ...clip.transform };
    const point = trackedPoint(clip, MOVING, 100, placed, 2);
    const expected = framePointOf(placed, { x: 1 - 0.52, y: 0.49 }, 2);
    expect(point.x).toBeCloseTo(expected.x, 12);
    expect(point.y).toBeCloseTo(expected.y, 12);
  });

  it("turns a point picked in the clip box into a job in frame pixels", () => {
    const job = frameJobOf({ boxPoint: { x: 0.5, y: 0.5 }, boxSize: 0.1, boxAspect: 2, fit: "cover", atMs: 100, fromMs: 0, toMs: 300, direction: "both" }, DIMS);
    expect(job).toEqual({ point: { x: 0.5, y: 0.5 }, size: 0.1, atMs: 100, fromMs: 0, toMs: 300, direction: "both" });
    const zoomed = frameJobOf({ boxPoint: { x: 0.5, y: 0.5 }, boxSize: 0.1, boxAspect: 2, fit: "cover", window: { x: 0.6, y: 0.4, scale: 0.5, rotation: 0 }, atMs: 0, fromMs: 0, toMs: 0, direction: "forward" }, DIMS);
    expect(zoomed?.point.x).toBeCloseTo(0.6, 12);
    expect(zoomed?.point.y).toBeCloseTo(0.4, 12);
    expect(zoomed?.size).toBeCloseTo(0.05, 12);
  });
});

describe("the tracking contract", () => {
  it("accepts the shared fixture and refuses a link to a missing tracker", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_tracking.json"), "utf8"));
    expect(documentIssue("video", raw)).toBeNull();
    raw.tracks[1].clips[0].parentTracker = "ghost";
    expect(documentIssue("video", raw)).toEqual({ field: "document.tracks", code: "invalid" });
  });
});
