import { describe, expect, it } from "vitest";

import { KEYFRAME_LIMITS, KEYFRAME_PROPERTIES, animatedTransform, keyframesIssue, type Keyframes } from "./keyframes";
import { KEYFRAME_PRESETS, captureKeyframes, keyframeClipboardAction, pastePatch, presetKeyframes, presetPatch } from "./keyframe-presets";

const box = { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 };
const clip = { transform: box, durationMs: 3000 };

function stroke(key: string, extra: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; code: string }> = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra };
}

describe("keyframe presets", () => {
  it.each(KEYFRAME_PRESETS)("%s writes valid keys that start and end inside the clip", (id) => {
    const keyframes = presetKeyframes(id, clip);
    expect(keyframesIssue(keyframes, box)).toBeNull();
    for (const property of KEYFRAME_PROPERTIES) {
      for (const frame of keyframes[property] ?? []) {
        expect(frame.atMs).toBeGreaterThanOrEqual(0);
        expect(frame.atMs).toBeLessThanOrEqual(clip.durationMs);
      }
    }
  });

  it.each(KEYFRAME_PRESETS)("%s also fits the shortest clip", (id) => {
    const short = { transform: box, durationMs: 100 };
    expect(keyframesIssue(presetKeyframes(id, short), box)).toBeNull();
  });

  it.each(KEYFRAME_PRESETS)("%s keeps under the per-property limit on a long clip", (id) => {
    const long = { transform: box, durationMs: 90_000 };
    const keyframes = presetKeyframes(id, long);
    for (const property of KEYFRAME_PROPERTIES) expect((keyframes[property] ?? []).length).toBeLessThanOrEqual(KEYFRAME_LIMITS.perProperty);
  });

  it("enters from the left and lands on the clip position", () => {
    const keyframes = presetKeyframes("enterLeft", clip);
    expect(animatedTransform(box, keyframes, 0).x).toBeLessThanOrEqual(0);
    expect(animatedTransform(box, keyframes, clip.durationMs).x).toBeCloseTo(box.x);
  });

  it("zooms slowly from the clip size", () => {
    const keyframes = presetKeyframes("kenBurns", clip);
    expect(animatedTransform(box, keyframes, 0).w).toBeCloseTo(box.w);
    expect(animatedTransform(box, keyframes, clip.durationMs).w).toBeGreaterThan(box.w);
  });

  it("fades out to nothing at the end", () => {
    const keyframes = presetKeyframes("fadeOut", clip);
    expect(animatedTransform(box, keyframes, 0).opacity).toBe(1);
    expect(animatedTransform(box, keyframes, clip.durationMs).opacity).toBe(0);
  });

  it("replaces only the properties the preset animates", () => {
    const existing: Keyframes = { y: [{ atMs: 0, value: 0.3, easing: "linear" }], x: [{ atMs: 100, value: 0.9, easing: "linear" }] };
    const patch = presetPatch({ ...clip, keyframes: existing }, "enterLeft");
    expect(typeof patch).toBe("object");
    if (typeof patch !== "object") return;
    expect(patch.keyframes?.y).toEqual(existing.y);
    expect(patch.keyframes?.x?.some((f) => f.value === 0.9)).toBe(false);
  });

  it("refuses a preset that would push the box past its limit", () => {
    const huge = { transform: { ...box, w: 3.9, h: 3.9 }, durationMs: 3000 };
    expect(presetPatch(huge, "kenBurns")).toBe("outOfRange");
  });
});

describe("keyframe clipboard", () => {
  const animated = {
    ...clip,
    keyframes: {
      x: [
        { atMs: 500, value: 0.2, easing: "easeOut" as const },
        { atMs: 1500, value: 0.8, easing: "linear" as const },
      ],
      opacity: [{ atMs: 1000, value: 0.5, easing: "linear" as const }],
    } satisfies Keyframes,
  };

  it("captures keys relative to the first one", () => {
    const captured = captureKeyframes(animated);
    expect(captured?.x?.map((f) => f.atMs)).toEqual([0, 1000]);
    expect(captured?.opacity?.map((f) => f.atMs)).toEqual([500]);
    expect(captureKeyframes({ ...clip, keyframes: undefined })).toBeNull();
  });

  it("pastes at the playhead, keeping the target's other keys", () => {
    const captured = captureKeyframes(animated)!;
    const target = { ...clip, keyframes: { x: [{ atMs: 0, value: 0.5, easing: "linear" as const }], y: [{ atMs: 0, value: 0.1, easing: "linear" as const }] } };
    const patch = pastePatch(target, captured, 200);
    expect(typeof patch).toBe("object");
    if (typeof patch !== "object") return;
    expect(patch.keyframes?.x?.map((f) => f.atMs)).toEqual([0, 200, 1200]);
    expect(patch.keyframes?.y).toEqual(target.keyframes.y);
    expect(patch.keyframes?.opacity?.map((f) => f.atMs)).toEqual([700]);
  });

  it("overwrites a target key at the same time", () => {
    const captured = captureKeyframes(animated)!;
    const target = { ...clip, keyframes: { x: [{ atMs: 200, value: 0.5, easing: "linear" as const }] } };
    const patch = pastePatch(target, captured, 200);
    if (typeof patch !== "object") throw new Error("refused");
    expect(patch.keyframes?.x?.map((f) => [f.atMs, f.value])).toEqual([
      [200, 0.2],
      [1200, 0.8],
    ]);
  });

  it("refuses outside the clip and past the limits", () => {
    const captured = captureKeyframes(animated)!;
    expect(pastePatch(clip, captured, null)).toBe("keyframeOutside");
    const full = { ...clip, keyframes: { x: Array.from({ length: KEYFRAME_LIMITS.perProperty }, (_, i) => ({ atMs: i * 7 + 3, value: 0.5, easing: "linear" as const })) } };
    expect(pastePatch(full, captured, 1000)).toBe("keyframeLimit");
    const big = { transform: { ...box, w: 3.9 }, durationMs: 3000 };
    expect(pastePatch(big, { scale: [{ atMs: 0, value: 2, easing: "linear" }] }, 0)).toBe("outOfRange");
  });

  it("reads the copy and paste shortcuts", () => {
    expect(keyframeClipboardAction(stroke("c", { ctrlKey: true, altKey: true }))).toBe("copy");
    expect(keyframeClipboardAction(stroke("ç", { ctrlKey: true, altKey: true, code: "KeyC" }))).toBe("copy");
    expect(keyframeClipboardAction(stroke("v", { metaKey: true, altKey: true }))).toBe("paste");
    expect(keyframeClipboardAction(stroke("c", { ctrlKey: true }))).toBeNull();
    expect(keyframeClipboardAction(stroke("c", { ctrlKey: true, altKey: true, shiftKey: true }))).toBeNull();
    expect(keyframeClipboardAction({ ...stroke("c", { ctrlKey: true, altKey: true }), target: Object.assign(document.createElement("input")) })).toBeNull();
  });
});
