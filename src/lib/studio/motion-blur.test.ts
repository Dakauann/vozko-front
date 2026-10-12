import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newNullClip, newOverlayClip, newShapeLayer, type Clip, type Transform, type VideoDocument } from "./document";
import { blurredPlan, withMotionBlur } from "./blurred-plan";
import { boxMap, DEFAULT_SHUTTER, motionTrail, SAMPLE_SPACING_PX, sampleTimes, shutterOf, shutterSpan, sweepPx, trailReach, trailSampleCount, type MotionTrail } from "./motion-blur";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { documentIssue } from "./validate";

const WIDTH = 1920;
const HEIGHT = 1080;
const CANVAS = { width: WIDTH, height: HEIGHT };
const FRAME_MS = 1000 / 30;

function film(clips: Clip[][]): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.tracks = clips.map((list, index) => ({ id: `t${index}`, kind: "visual" as const, clips: list }));
  doc.durationMs = 2000;
  return doc;
}

function image(id: string, extra: Partial<Clip> = {}, transform: Partial<Transform> = {}): Clip {
  const base = newMediaClip("image", `m-${id}`, 0, 2000);
  return { ...base, id, transform: { ...base.transform, w: 0.1, h: 0.1, ...transform }, ...extra };
}

function sliding(extra: Partial<Clip> = {}): Clip {
  return image("swatch", {
    motionBlur: true,
    keyframes: {
      x: [
        { atMs: 0, value: 0.2, easing: "linear" },
        { atMs: 1000, value: 0.8, easing: "linear" },
      ],
    },
    ...extra,
  });
}

function trailOf(doc: VideoDocument, ms: number, scale = 1): MotionTrail | undefined {
  return blurredPlan(doc, ms, scale).find((item) => item.clipId === "swatch")?.trail;
}

function mapsOf(trail: MotionTrail): number[][] {
  const maps: number[][] = [];
  for (let i = 0; i < trail.maps.length; i += 6) maps.push(trail.maps.slice(i, i + 6));
  return maps;
}

function apply(map: readonly number[], u: number, v: number): [number, number] {
  return [map[0] * u + map[1] * v + map[2], map[3] * u + map[4] * v + map[5]];
}

describe("the shutter", () => {
  it("defaults to a half frame centred on the frame time", () => {
    expect(shutterOf(film([]).canvas)).toEqual(DEFAULT_SHUTTER);
    expect(DEFAULT_SHUTTER).toEqual({ angle: 180, phase: -90 });
    const span = shutterSpan(DEFAULT_SHUTTER, 1000);
    expect(span.startMs).toBeCloseTo(1000 - FRAME_MS / 4, 9);
    expect(span.endMs).toBeCloseTo(1000 + FRAME_MS / 4, 9);
  });

  it("reads the project angle and phase", () => {
    const doc = film([]);
    doc.canvas.shutterAngle = 360;
    doc.canvas.shutterPhase = 0;
    const span = shutterSpan(shutterOf(doc.canvas), 500);
    expect(span.startMs).toBe(500);
    expect(span.endMs).toBeCloseTo(500 + FRAME_MS, 9);
  });

  it("spreads the samples evenly inside the shutter", () => {
    expect(sampleTimes({ startMs: 0, endMs: 10 }, 4)).toEqual([1.25, 3.75, 6.25, 8.75]);
  });
});

describe("sample count from the size of the motion", () => {
  it("takes one sample per pixel the box sweeps, and scales with the rendered size", () => {
    const pose = (ms: number): Transform => ({ x: 0.5 + ms / 1000, y: 0.5, w: 0.1, h: 0.1, rotation: 0, opacity: 1 });
    const sweep = sweepPx(pose, { startMs: 0, endMs: 10 }, CANVAS);
    expect(sweep).toBeCloseTo(0.01 * WIDTH, 9);
    expect(trailSampleCount(sweep, 1)).toBe(Math.ceil((0.01 * WIDTH) / SAMPLE_SPACING_PX));
    expect(trailSampleCount(sweep, 0.5)).toBe(Math.ceil((0.005 * WIDTH) / SAMPLE_SPACING_PX));
  });

  it("measures a turn by the arc of the corners, not by the centre", () => {
    const pose = (ms: number): Transform => ({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 * (WIDTH / HEIGHT), rotation: ms * 9, opacity: 1 });
    const radius = Math.hypot(0.1 * WIDTH, 0.1 * WIDTH);
    expect(sweepPx(pose, { startMs: 0, endMs: 10 }, CANVAS)).toBeCloseTo((radius * Math.PI) / 2, -1);
  });

  it("gives no trail to a clip that moves less than a pixel", () => {
    const still = (): Transform => ({ x: 0.5, y: 0.5, w: 0.1, h: 0.1, rotation: 0, opacity: 1 });
    expect(motionTrail(still, 500, DEFAULT_SHUTTER, CANVAS, 1)).toBeNull();
  });
});

describe("box maps", () => {
  it("is the identity between the same pose", () => {
    const pose: Transform = { x: 0.3, y: 0.6, w: 0.2, h: 0.3, rotation: 25, opacity: 1 };
    const map = boxMap(pose, pose, CANVAS)!;
    [1, 0, 0, 0, 1, 0].forEach((value, i) => expect(map[i]).toBeCloseTo(value, 12));
  });

  it("sends a point of the frame to the same point of the frame across poses", () => {
    const center: Transform = { x: 0.4, y: 0.5, w: 0.2, h: 0.1, rotation: 10, opacity: 1 };
    const sample: Transform = { x: 0.45, y: 0.47, w: 0.3, h: 0.12, rotation: 40, opacity: 1 };
    const framePoint = (t: Transform, u: number, v: number) => {
      const r = (t.rotation * Math.PI) / 180;
      const dx = (u - 0.5) * t.w * WIDTH;
      const dy = (v - 0.5) * t.h * HEIGHT;
      return [t.x * WIDTH + dx * Math.cos(r) - dy * Math.sin(r), t.y * HEIGHT + dx * Math.sin(r) + dy * Math.cos(r)];
    };
    const map = boxMap(center, sample, CANVAS)!;
    for (const [u, v] of [[0, 0], [1, 0.3], [0.2, 0.9], [0.5, 0.5]]) {
      const [su, sv] = apply(map, u, v);
      const [x, y] = framePoint(center, u, v);
      const [sx, sy] = framePoint(sample, su, sv);
      expect(sx).toBeCloseTo(x, 8);
      expect(sy).toBeCloseTo(y, 8);
    }
  });

  it("refuses a sample whose box has no size", () => {
    expect(boxMap({ x: 0.5, y: 0.5, w: 0.1, h: 0.1, rotation: 0, opacity: 1 }, { x: 0.5, y: 0.5, w: 0, h: 0.1, rotation: 0, opacity: 1 }, CANVAS)).toBeNull();
  });
});

describe("motion trails in the plan", () => {
  it("samples the shared placement inside the shutter, one sample per swept pixel", () => {
    const doc = film([[sliding()]]);
    const trail = trailOf(doc, 500)!;
    const speedPx = 0.6 * WIDTH;
    const sweep = (speedPx * FRAME_MS) / 2 / 1000;
    const maps = mapsOf(trail);
    expect(maps).toHaveLength(Math.ceil(sweep / SAMPLE_SPACING_PX));
    const times = sampleTimes(shutterSpan(DEFAULT_SHUTTER, 500), maps.length);
    maps.forEach((map, i) => {
      const shiftPx = (speedPx * (times[i] - 500)) / 1000;
      expect(map[2]).toBeCloseTo(-shiftPx / (0.1 * WIDTH), 9);
      expect(map[5]).toBeCloseTo(0, 9);
      expect(map[0]).toBeCloseTo(1, 12);
    });
  });

  it("takes fewer samples when drawn smaller", () => {
    const doc = film([[sliding()]]);
    expect(mapsOf(trailOf(doc, 500, 0.5)!).length).toBe(Math.ceil(mapsOf(trailOf(doc, 500, 1)!).length / 2));
  });

  it("gives the same trail every time", () => {
    const doc = film([[sliding()]]);
    expect(trailOf(doc, 733)).toEqual(trailOf(doc, 733));
  });

  it("leaves clips without the switch, a closed shutter and a still clip sharp", () => {
    expect(trailOf(film([[sliding({ motionBlur: undefined })]]), 500)).toBeUndefined();
    const closed = film([[sliding()]]);
    closed.canvas.shutterAngle = 0;
    expect(trailOf(closed, 500)).toBeUndefined();
    expect(trailOf(film([[image("swatch", { motionBlur: true })]]), 500)).toBeUndefined();
  });

  it("blurs a still child carried by a moving parent", () => {
    const rig: Clip = { ...newNullClip(0, 2000), id: "rig", keyframes: { rotation: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 360, easing: "linear" }] } };
    const doc = film([[image("swatch", { motionBlur: true, parentId: "rig" }, { x: 0.8 })], [rig]]);
    const trail = trailOf(doc, 500)!;
    expect(mapsOf(trail).length).toBeGreaterThan(10);
    const first = mapsOf(trail)[0];
    expect(Math.abs(first[1])).toBeGreaterThan(0.01);
  });

  it("follows an entrance slide", () => {
    const doc = film([[image("swatch", { motionBlur: true, motionIn: { edge: "left", durationMs: 400 } })]]);
    expect(trailOf(doc, 100)).toBeDefined();
    expect(trailOf(doc, 1000)).toBeUndefined();
  });

  it("keeps a trail when the clip holds its pose at its ends", () => {
    const doc = film([[sliding({ durationMs: 1000 })]]);
    doc.tracks[0].clips[0].keyframes!.x![1].atMs = 999;
    expect(trailOf(doc, 0)).toBeDefined();
  });

  it("only touches the clips that ask for it and keeps the plan otherwise", () => {
    const doc = film([[sliding()], [image("other", {}, { x: 0.3 })]]);
    const plan = visualPlan(doc, 500);
    const blurred = withMotionBlur(doc, plan, 500, 1);
    expect(blurred.find((item) => item.clipId === "other")).toBe(plan.find((item) => item.clipId === "other"));
    expect(blurred.find((item) => item.clipId === "swatch")).toEqual({ ...plan.find((item) => item.clipId === "swatch"), trail: expect.any(Object) });
  });

  it("puts the trail and the box it is measured in on the scene node", () => {
    const shape = { ...newOverlayClip(newShapeLayer("rect"), 0, 2000), id: "swatch", motionBlur: true, keyframes: { rotation: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 1000, value: 180, easing: "linear" as const }] } };
    const doc = film([[shape]]);
    const plan = blurredPlan(doc, 500, 1);
    const node = videoScene(doc, plan).nodes[0];
    const t = plan[0].transform;
    expect(node.trail?.maps).toEqual(plan[0].trail?.maps);
    expect(node.trail?.box).toEqual({ x: t.x * WIDTH, y: t.y * HEIGHT, width: t.w * WIDTH, height: t.h * HEIGHT, rotation: t.rotation });
    expect(videoScene(doc, visualPlan(doc, 500)).nodes[0].trail).toBeUndefined();
  });
});

describe("trail reach", () => {
  it("is the farthest a corner of the drawn box travels", () => {
    const trail: MotionTrail = { maps: [1, 0, 0.25, 0, 1, 0, 1, 0, -0.5, 0, 1, 0.1] };
    expect(trailReach(trail, 200, 100)).toBeCloseTo(Math.hypot(100, 10), 9);
    expect(trailReach(trail, 200, 100, { x: 3, y: 1 })).toBeCloseTo(Math.hypot(100, 10), 9);
  });

  it("grows with content that reaches past the box when it turns", () => {
    const turn = (degrees: number): number[] => {
      const r = (degrees * Math.PI) / 180;
      return [Math.cos(r), -Math.sin(r), 0.5 - 0.5 * (Math.cos(r) - Math.sin(r)), Math.sin(r), Math.cos(r), 0.5 - 0.5 * (Math.sin(r) + Math.cos(r))];
    };
    const trail: MotionTrail = { maps: turn(90) };
    expect(trailReach(trail, 100, 100, { x: 2, y: 2 })).toBeGreaterThan(trailReach(trail, 100, 100));
  });
});

describe("motion blur in the document", () => {
  it("accepts the shared fixture", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_motion_blur.json"), "utf8"));
    expect(documentIssue("video", raw)).toBeNull();
  });

  it("takes the switch on video, image and overlay clips only", () => {
    const shape = { ...newOverlayClip(newShapeLayer("rect"), 0, 2000), id: "o", motionBlur: true };
    expect(documentIssue("video", film([[sliding()], [shape]]))).toBeNull();
    const sound = film([]);
    sound.tracks = [{ id: "a", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 1000), id: "a1", motionBlur: true }] }];
    sound.durationMs = 1000;
    expect(documentIssue("video", sound)).toEqual({ field: "document.tracks", code: "invalid" });
    expect(documentIssue("video", film([[{ ...newNullClip(0, 1000), id: "n", motionBlur: true }]]))).toEqual({ field: "document.tracks", code: "invalid" });
  });

  it.each([
    ["an angle past a full turn and back", { shutterAngle: 721 }],
    ["a negative angle", { shutterAngle: -1 }],
    ["a phase past a turn", { shutterPhase: 361 }],
    ["a phase below a turn", { shutterPhase: -361 }],
  ])("refuses %s", (_, canvas) => {
    const doc = film([[sliding()]]);
    Object.assign(doc.canvas, canvas);
    expect(documentIssue("video", doc)).toEqual({ field: "document.canvas", code: "out_of_range" });
  });

  it("accepts the edges of the shutter ranges", () => {
    const doc = film([[sliding()]]);
    Object.assign(doc.canvas, { shutterAngle: 720, shutterPhase: -360 });
    expect(documentIssue("video", doc)).toBeNull();
    Object.assign(doc.canvas, { shutterAngle: 0, shutterPhase: 360 });
    expect(documentIssue("video", doc)).toBeNull();
  });
});
