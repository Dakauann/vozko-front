import { describe, expect, it } from "vitest";

import { sourceAt, sourceSpanMs, speedAt } from "./clip-time";
import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import { retimeClip } from "./retime";
import { addSpeedPoint, clearSpeedCurve, isSmoothCurve, moveSpeedPoint, presetPoints, removeSpeedPoint, setSpeedCurve, smoothRamp, speedCurvePoints, speedCurvePointsIssue } from "./speed-curve";
import { findClip, updateClip } from "./timeline";
import { documentIssue } from "./validate";

function film(): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  const shot: Clip = { ...newMediaClip("video", "media", 0, 4000), id: "shot", trimInMs: 500, linkId: "pair" };
  const sound: Clip = { ...newMediaClip("audio", "media", 0, 4000), id: "sound", trimInMs: 500, linkId: "pair" };
  const after: Clip = { ...newMediaClip("image", "still", 4000, 1000), id: "after" };
  const title: Clip = {
    ...newMediaClip("image", "logo", 0, 4000),
    id: "logo",
  };
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [shot, after] },
    { id: "v2", kind: "visual", clips: [title] },
    { id: "a1", kind: "audio", clips: [sound] },
  ];
  doc.durationMs = 5000;
  return doc;
}

const noSource = () => undefined;

function clipOf(doc: VideoDocument, id: string): Clip {
  return findClip(doc, id)!.clip;
}

describe("speed curves", () => {
  it("keeps the footage by default, so the duration follows the average speed and the pair moves together", () => {
    const doc = film();
    const result = setSpeedCurve(doc, "shot", { points: presetPoints("hero") }, noSource);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const shot = clipOf(result.document, "shot");
    const sound = clipOf(result.document, "sound");
    expect(Math.abs(sourceSpanMs(shot) - 4000)).toBeLessThanOrEqual(2);
    expect(shot.durationMs).toBeGreaterThan(4000);
    expect(sound.keyframes?.speed).toEqual(shot.keyframes?.speed);
    expect(sound.durationMs).toBe(shot.durationMs);
    expect(clipOf(result.document, "after").startMs).toBe(shot.durationMs);
    expect(shot.speed).toBeUndefined();
    expect(isSmoothCurve(shot)).toBe(true);
    expect(documentIssue("video", { ...result.document, durationMs: 20000 })).toBeNull();
  });

  it("keeps the duration when asked and refuses running past the media", () => {
    const doc = film();
    const kept = setSpeedCurve(doc, "shot", { points: presetPoints("flashIn"), keep: "duration" }, noSource);
    expect(kept.ok && clipOf(kept.document, "shot").durationMs).toBe(4000);
    expect(setSpeedCurve(doc, "shot", { points: presetPoints("flashIn"), keep: "duration" }, () => 5000)).toEqual({ ok: false, reason: "source" });
  });

  it("refuses points that do not span the clip or leave the speed range", () => {
    expect(speedCurvePointsIssue([{ at: 0, speed: 1 }])).toBe(true);
    expect(speedCurvePointsIssue([{ at: 0.1, speed: 1 }, { at: 1, speed: 2 }])).toBe(true);
    expect(speedCurvePointsIssue([{ at: 0, speed: 1 }, { at: 1, speed: 20 }])).toBe(true);
    expect(speedCurvePointsIssue([{ at: 0, speed: 1 }, { at: 0.01, speed: 2 }, { at: 1, speed: 1 }])).toBe(true);
    expect(setSpeedCurve(film(), "after", { points: presetPoints("hero") }, noSource)).toEqual({ ok: false, reason: "notSourced" });
  });

  it("reads the editable points back and clears the curve without changing the footage or the duration", () => {
    const set = setSpeedCurve(film(), "shot", { points: presetPoints("bullet"), smooth: false }, noSource);
    if (!set.ok) throw new Error(set.reason);
    const shot = clipOf(set.document, "shot");
    expect(speedCurvePoints(shot).map((point) => point.speed)).toEqual([2, 0.2, 0.2, 2]);
    const cleared = clearSpeedCurve(set.document, "shot");
    if (!cleared.ok) throw new Error(cleared.reason);
    const flat = clipOf(cleared.document, "shot");
    expect(flat.keyframes?.speed).toBeUndefined();
    expect(flat.durationMs).toBe(shot.durationMs);
    expect(Math.abs(sourceSpanMs(flat) - sourceSpanMs(shot))).toBeLessThanOrEqual(3);
    expect(clipOf(cleared.document, "sound").speed).toBe(flat.speed);
  });

  it("ramps smoothly from the current speed to the new one and holds it after", () => {
    const result = smoothRamp(film(), "shot", { atMs: 1000, rampMs: 800, toSpeed: 0.5 });
    if (!result.ok) throw new Error(result.reason);
    const shot = clipOf(result.document, "shot");
    expect(speedAt(shot, 500)).toBe(1);
    expect(speedAt(shot, 1400)).toBeCloseTo(0.75, 6);
    expect(speedAt(shot, 3000)).toBe(0.5);
    expect(Math.abs(sourceSpanMs(shot) - 4000)).toBeLessThanOrEqual(1);
    expect(sourceAt(shot, 1000)).toBeCloseTo(1500, 6);
  });

  it("stretches a curve to a new duration and flattens it for a constant speed", () => {
    const set = setSpeedCurve(film(), "shot", { points: presetPoints("hero") }, noSource);
    if (!set.ok) throw new Error(set.reason);
    const before = clipOf(set.document, "shot");
    const fitted = retimeClip(set.document, "shot", { durationMs: before.durationMs * 2 }, noSource);
    if (!fitted.ok) throw new Error(fitted.reason);
    const after = clipOf(fitted.document, "shot");
    expect(after.durationMs).toBe(before.durationMs * 2);
    expect(Math.abs(sourceSpanMs(after) - sourceSpanMs(before))).toBeLessThanOrEqual(3);
    const flat = retimeClip(set.document, "shot", { speed: 2 }, noSource);
    if (!flat.ok) throw new Error(flat.reason);
    expect(clipOf(flat.document, "shot").keyframes?.speed).toBeUndefined();
    expect(clipOf(flat.document, "shot").speed).toBe(2);
  });

  it("copies hand edits of the speed lane to the linked sound", () => {
    const set = setSpeedCurve(film(), "shot", { points: presetPoints("hero") }, noSource);
    if (!set.ok) throw new Error(set.reason);
    const shot = clipOf(set.document, "shot");
    const keys = shot.keyframes!.speed!.map((key, i) => (i === 1 ? { ...key, value: 0.6 } : key));
    const edited = updateClip(set.document, "shot", { keyframes: { ...shot.keyframes, speed: keys } });
    expect(clipOf(edited, "sound").keyframes?.speed?.[1].value).toBe(0.6);
  });

  it("adds, moves and removes editor points while the ends stay pinned and points keep apart", () => {
    const points = presetPoints("flashIn");
    const added = addSpeedPoint(points, 0.7, 2.345);
    expect(added).toEqual({ ok: true, points: [points[0], points[1], { at: 0.7, speed: 2.35 }, points[2]], index: 2 });
    expect(addSpeedPoint(points, 0.36, 1)).toEqual({ ok: false, reason: "crowded" });
    const end = moveSpeedPoint(points, 0, 0.5, 40);
    expect(end.ok && end.points[0]).toEqual({ at: 0, speed: 16 });
    const middle = moveSpeedPoint(points, 1, 2, 0.01);
    expect(middle.ok && middle.points[1]).toEqual({ at: 0.98, speed: 0.1 });
    expect(removeSpeedPoint(points, 0)).toEqual({ ok: false, reason: "ends" });
    expect(removeSpeedPoint(points, 1)).toEqual({ ok: true, points: [points[0], points[2]], index: 0 });
  });
});
