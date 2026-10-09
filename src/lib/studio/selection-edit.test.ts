import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, newTextLayer, type Clip, type VideoDocument } from "./document";
import { type Keyframes } from "./keyframes";
import {
  applyToSelection,
  commonFields,
  editSelection,
  moveSelectionBy,
  moveSelectionTo,
  seekInside,
  selectionEasing,
  selectionKeyTimes,
  selectionMoment,
  selectionStart,
  setSelectionEasing,
  sharedValue,
  shownTransform,
  toggleSelectionMoment,
  transformPatch,
  trimSelectionEnd,
} from "./selection-edit";
import { findClip, insertClip, timelineKeyframeCount, updateTrack } from "./timeline";
import { parseDocument } from "./validate";

const asset = "11111111-1111-4111-8111-111111111111";
const audioAsset = "22222222-2222-4222-8222-222222222222";

interface Fixture {
  doc: VideoDocument;
  textA: string;
  textB: string;
  image: string;
  shape: string;
  audio: string;
}

function place(doc: VideoDocument, trackIndex: number, clip: Clip): { doc: VideoDocument; id: string } {
  const result = insertClip(doc, doc.tracks[trackIndex].id, clip);
  if (!result.clipId) throw new Error("fixture clip did not fit");
  return { doc: result.document, id: result.clipId };
}

function fixture(): Fixture {
  let doc = emptyVideoDocument("story");
  const image = place(doc, 0, newMediaClip("image", asset, 0, 4000));
  doc = image.doc;
  const textA = place(doc, 1, newOverlayClip(newTextLayer("Oi", "heading"), 0, 2000));
  doc = textA.doc;
  const textB = place(doc, 1, { ...newOverlayClip(newTextLayer("Tchau", "body"), 2000, 2000), transform: { x: 0.3, y: 0.5, w: 0.8, h: 0.2, rotation: 0, opacity: 1 } });
  doc = textB.doc;
  const audio = place(doc, 2, newMediaClip("audio", audioAsset, 0, 3000));
  doc = audio.doc;
  const shape = place(doc, 0, newOverlayClip(newShapeLayer("rect"), 4000, 1000));
  doc = shape.doc;
  return { doc, textA: textA.id, textB: textB.id, image: image.id, shape: shape.id, audio: audio.id };
}

function clipOf(doc: VideoDocument, id: string): Clip {
  return findClip(doc, id)!.clip;
}

describe("sharedValue", () => {
  it("reports one value when every item agrees", () => {
    expect(sharedValue([{ v: 1 }, { v: 1 }], (item) => item.v)).toEqual({ kind: "same", value: 1 });
    expect(sharedValue([{ v: { a: 1 } }, { v: { a: 1 } }], (item) => item.v)).toEqual({ kind: "same", value: { a: 1 } });
    expect(sharedValue([{ v: 0.1 + 0.2 }, { v: 0.3 }], (item) => item.v).kind).toBe("same");
  });

  it("reports mixed values and an empty selection as mixed", () => {
    expect(sharedValue([{ v: 1 }, { v: 2 }], (item) => item.v)).toEqual({ kind: "mixed" });
    expect(sharedValue([{ v: undefined }, { v: 2 }], (item) => item.v)).toEqual({ kind: "mixed" });
    expect(sharedValue([] as { v: number }[], (item) => item.v)).toEqual({ kind: "mixed" });
  });
});

describe("commonFields", () => {
  it("keeps only what every clip in the selection has", () => {
    const { doc, textA, textB, image, audio, shape } = fixture();
    const texts = commonFields([clipOf(doc, textA), clipOf(doc, textB)]);
    expect([...texts].sort()).toEqual(["fades", "keyframes", "layer", "motion", "timing", "transform"]);
    const visual = commonFields([clipOf(doc, textA), clipOf(doc, image)]);
    expect(visual.has("transform")).toBe(true);
    expect(visual.has("layer")).toBe(false);
    expect(visual.has("fit")).toBe(false);
    expect(commonFields([clipOf(doc, textA), clipOf(doc, shape)]).has("layer")).toBe(false);
    const mixed = commonFields([clipOf(doc, textA), clipOf(doc, audio)]);
    expect([...mixed].sort()).toEqual(["fades", "timing"]);
    expect([...commonFields([clipOf(doc, audio)])].sort()).toEqual(["fades", "timing", "trimIn", "volume"]);
    expect(commonFields([clipOf(doc, image)]).has("fit")).toBe(true);
    expect(commonFields([]).size).toBe(0);
  });
});

describe("applyToSelection", () => {
  it("patches every clip in one document", () => {
    const { doc, textA, textB } = fixture();
    const result = applyToSelection(doc, [textA, textB], () => ({ fadeInMs: 300 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(clipOf(result.document, textA).fadeInMs).toBe(300);
    expect(clipOf(result.document, textB).fadeInMs).toBe(300);
    expect(parseDocument("video", JSON.parse(JSON.stringify(result.document))).ok).toBe(true);
  });

  it("skips clips on locked tracks", () => {
    const fx = fixture();
    const doc = updateTrack(fx.doc, fx.doc.tracks[0].id, { locked: true });
    const result = applyToSelection(doc, [fx.textA, fx.image], () => ({ fadeInMs: 200 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(clipOf(result.document, fx.textA).fadeInMs).toBe(200);
    expect(clipOf(result.document, fx.image).fadeInMs).toBe(0);
  });

  it("refuses when every clip is locked", () => {
    const fx = fixture();
    const doc = updateTrack(fx.doc, fx.doc.tracks[0].id, { locked: true });
    expect(applyToSelection(doc, [fx.image], () => ({ fadeInMs: 200 }))).toEqual({ ok: false, reason: "locked" });
  });

  it("refuses the whole edit when one clip would become invalid", () => {
    const { doc, textA, textB } = fixture();
    const result = applyToSelection(doc, [textA, textB], (clip) => ({ layer: { ...clip.layer!, text: clip.id === textB ? "" : "ok" } }));
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("animates every selected clip however many keyframes the video already has", () => {
    const { doc, textA, textB } = fixture();
    const many = (offset: number): Keyframes => ({
      x: Array.from({ length: 32 }, (_, i) => ({ atMs: i * 10 + offset, value: 0.5, easing: "linear" as const })),
      y: Array.from({ length: 32 }, (_, i) => ({ atMs: i * 10 + offset, value: 0.5, easing: "linear" as const })),
      scale: Array.from({ length: 32 }, (_, i) => ({ atMs: i * 10 + offset, value: 1, easing: "linear" as const })),
      rotation: Array.from({ length: 32 }, (_, i) => ({ atMs: i * 10 + offset, value: 0, easing: "linear" as const })),
      opacity: Array.from({ length: 32 }, (_, i) => ({ atMs: i * 10 + offset, value: 1, easing: "linear" as const })),
    });
    const first = applyToSelection(doc, [textA, textB], () => ({ keyframes: many(0) }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const image = first.document.tracks[0].clips.find((c) => c.type === "image")!.id;
    const second = applyToSelection(first.document, [image], () => ({ keyframes: many(0) }));
    expect(second.ok && timelineKeyframeCount(second.document)).toBe(32 * 5 * 3);
  });

  it("passes refusals from the patch builder through", () => {
    const { doc, textA, textB } = fixture();
    expect(applyToSelection(doc, [textA, textB], (clip) => (clip.id === textB ? "keyframeOutside" : { fadeInMs: 100 }))).toEqual({ ok: false, reason: "keyframeOutside" });
  });

  it("returns the same document when nothing changes", () => {
    const { doc, textA } = fixture();
    const result = applyToSelection(doc, [textA], () => null);
    expect(result).toEqual({ ok: true, document: doc });
  });
});

describe("transform edits", () => {
  it("shows the animated transform at the playhead", () => {
    const { doc, textB } = fixture();
    const clip = { ...clipOf(doc, textB), keyframes: { x: [{ atMs: 0, value: 0.1, easing: "linear" as const }, { atMs: 1000, value: 0.9, easing: "linear" as const }] } };
    expect(shownTransform(clip, 2500).x).toBeCloseTo(0.5);
    expect(shownTransform(clip, 9000).x).toBeCloseTo(0.9);
  });

  it("sets a static value and clamps it", () => {
    const { doc, textA } = fixture();
    const clip = clipOf(doc, textA);
    expect(transformPatch(clip, () => ({ x: 0.25 }), 500)).toEqual({ transform: { ...clip.transform, x: 0.25 } });
    const clamped = transformPatch(clip, () => ({ x: 7 }), 500);
    expect(typeof clamped === "object" && clamped.transform?.x).toBe(1);
  });

  it("applies a delta from the shown value", () => {
    const { doc, textA, textB } = fixture();
    const result = applyToSelection(doc, [textA, textB], (clip) => transformPatch(clip, (shown) => ({ x: shown.x + 0.1 }), 0));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(clipOf(result.document, textA).transform.x).toBeCloseTo(0.6);
    expect(clipOf(result.document, textB).transform.x).toBeCloseTo(0.4);
  });

  it("writes a key when the property is animated and the playhead is inside", () => {
    const { doc, textA } = fixture();
    const clip = { ...clipOf(doc, textA), keyframes: { x: [{ atMs: 0, value: 0.2, easing: "linear" as const }] } };
    const patch = transformPatch(clip, () => ({ x: 0.7 }), 1000);
    expect(typeof patch === "object" && patch.keyframes?.x?.map((f) => [f.atMs, f.value])).toEqual([
      [0, 0.2],
      [1000, 0.7],
    ]);
  });

  it("refuses an animated edit while the playhead is outside the clip", () => {
    const { doc, textB } = fixture();
    const clip = { ...clipOf(doc, textB), keyframes: { x: [{ atMs: 0, value: 0.2, easing: "linear" as const }] } };
    expect(transformPatch(clip, () => ({ x: 0.7 }), 100)).toBe("keyframeOutside");
  });
});

describe("timing", () => {
  it("moves the selection as a group from its earliest start", () => {
    const { doc, textB, shape } = fixture();
    const clips = [clipOf(doc, textB), clipOf(doc, shape)];
    expect(selectionStart(clips)).toBe(2000);
    const result = moveSelectionTo(doc, [textB, shape], 2500);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(clipOf(result.document, textB).startMs).toBe(2500);
    expect(clipOf(result.document, shape).startMs).toBe(4500);
  });

  it("refuses a group move that collides", () => {
    const { doc, textB } = fixture();
    expect(moveSelectionTo(doc, [textB], 1000)).toEqual({ ok: false, reason: "noRoom" });
  });

  it("sets the length of every clip and waits for unknown source lengths", () => {
    const { doc, textA, audio } = fixture();
    const known = trimSelectionEnd(doc, [textA, audio], () => 1500, { [audioAsset]: 10_000 });
    expect(known.ok).toBe(true);
    if (!known.ok) return;
    expect(clipOf(known.document, textA).durationMs).toBe(1500);
    expect(clipOf(known.document, audio).durationMs).toBe(1500);
    expect(trimSelectionEnd(doc, [textA, audio], () => 1500, {})).toEqual({ ok: false, reason: "sourcePending" });
  });

  it("validates any edit before committing", () => {
    const { doc, textA } = fixture();
    const broken = editSelection(doc, [textA], (current, location) => ({
      ...current,
      tracks: current.tracks.map((t) => (t.id === location.track.id ? { ...t, clips: t.clips.map((c) => (c.id === textA ? { ...c, volume: 9 } : c)) } : t)),
    }));
    expect(broken).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("keyframe moments across a selection", () => {
  function animatedPair() {
    const fx = fixture();
    const result = applyToSelection(fx.doc, [fx.textA, fx.image], () => ({
      keyframes: { x: [{ atMs: 0, value: 0.2, easing: "easeIn" as const }, { atMs: 1000, value: 0.8, easing: "easeIn" as const }] },
    }));
    if (!result.ok) throw new Error("fixture refused");
    return { ...fx, doc: result.document };
  }

  it("describes the playhead for every selected clip", () => {
    const fx = animatedPair();
    const clips = [clipOf(fx.doc, fx.textA), clipOf(fx.doc, fx.image)];
    expect(selectionMoment(clips, 1000)).toBe("key");
    expect(selectionMoment(clips, 500)).toBe("between");
    expect(selectionMoment(clips, 3000)).toBe("outside");
    expect(selectionMoment([clipOf(fx.doc, fx.textB)], 2500)).toBe("none");
    expect(selectionMoment([], 0)).toBe("none");
  });

  it("records a moment on every clip, then removes it", () => {
    const fx = animatedPair();
    const recorded = toggleSelectionMoment(fx.doc, [fx.textA, fx.image], 500);
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    for (const id of [fx.textA, fx.image]) expect(clipOf(recorded.document, id).keyframes?.opacity?.map((f) => f.atMs)).toEqual([500]);
    const removed = toggleSelectionMoment(recorded.document, [fx.textA, fx.image], 500);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(clipOf(removed.document, fx.textA).keyframes?.x?.map((f) => f.atMs)).toEqual([0, 1000]);
    expect(clipOf(removed.document, fx.textA).keyframes?.opacity).toBeUndefined();
  });

  it("refuses a moment when the playhead is outside any selected clip", () => {
    const fx = animatedPair();
    expect(toggleSelectionMoment(fx.doc, [fx.textA, fx.textB], 500)).toEqual({ ok: false, reason: "keyframeOutside" });
  });

  it("reads and sets easing for the moment under the playhead, or for every key", () => {
    const fx = animatedPair();
    const clips = [clipOf(fx.doc, fx.textA), clipOf(fx.doc, fx.image)];
    expect(selectionEasing(clips, 1000)).toEqual({ scope: "moment", easing: "easeIn" });
    expect(selectionEasing(clips, 500)).toEqual({ scope: "all", easing: "easeIn" });
    const moment = setSelectionEasing(fx.doc, [fx.textA, fx.image], 1000, "hold");
    if (!moment.ok) throw new Error("refused");
    expect(clipOf(moment.document, fx.textA).keyframes?.x?.map((f) => f.easing)).toEqual(["easeIn", "hold"]);
    expect(selectionEasing([clipOf(moment.document, fx.textA)], 500)).toEqual({ scope: "all", easing: null });
    const all = setSelectionEasing(fx.doc, [fx.textA, fx.image], 500, "linear");
    if (!all.ok) throw new Error("refused");
    expect(clipOf(all.document, fx.image).keyframes?.x?.map((f) => f.easing)).toEqual(["linear", "linear"]);
  });
});

describe("selection time helpers", () => {
  const a = { startMs: 1000, durationMs: 2000, keyframes: { x: [{ atMs: 0, value: 0.5, easing: "linear" as const }, { atMs: 500, value: 0.5, easing: "linear" as const }] } };
  const b = { startMs: 2000, durationMs: 2000, keyframes: { opacity: [{ atMs: 0, value: 1, easing: "linear" as const }] } };

  it("lists every key time of the selection on the timeline", () => {
    expect(selectionKeyTimes([a, b])).toEqual([1000, 1500, 2000]);
    expect(selectionKeyTimes([{ startMs: 0 }])).toEqual([]);
  });

  it("finds a time inside every selected clip, nearest to the playhead", () => {
    expect(seekInside([a, b], 0)).toBe(2000);
    expect(seekInside([a, b], 2500)).toBe(2500);
    expect(seekInside([a, b], 9000)).toBe(2999);
    expect(seekInside([a, { ...b, startMs: 3000 }], 0)).toBeNull();
    expect(seekInside([], 0)).toBeNull();
  });
});

describe("moveSelectionBy", () => {
  it("moves by a delta from the live document", () => {
    const { doc, textB, shape } = fixture();
    const moved = moveSelectionBy(doc, [textB, shape], 300);
    if (!moved.ok) throw new Error("refused");
    const again = moveSelectionBy(moved.document, [textB, shape], 300);
    if (!again.ok) throw new Error("refused");
    expect(clipOf(again.document, textB).startMs).toBe(2600);
    expect(moveSelectionBy(doc, [textB], -500)).toEqual({ ok: false, reason: "noRoom" });
  });
});
