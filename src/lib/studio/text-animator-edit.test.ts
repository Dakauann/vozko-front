import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "./document";
import { newRangeSelector, newTextUnitAnimator, newWigglySelector } from "./text-animator";
import {
  addClipTextAnimator,
  animateClipTextAnimator,
  moveClipTextAnimator,
  patchTextAnimator,
  removeClipTextAnimator,
  toggleClipTextAnimatorKey,
  updateClipTextAnimator,
} from "./text-animator-edit";
import type { TextUnitAnimator } from "./text-selectors";

function doc(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 2000), id: "clip" }] },
    { id: "t", kind: "visual", clips: [{ ...newOverlayClip({ ...newTextLayer("Oferta"), fill: "#ffffff" }, 0, 2000), id: "o" }] },
  ];
  d.durationMs = 2000;
  return d;
}

const animator = (id: string, patch: Partial<TextUnitAnimator> = {}): TextUnitAnimator => ({ ...newTextUnitAnimator("char", { opacity: 0 }, newRangeSelector(1)), id, ...patch });

function animators(result: { ok: boolean; document?: VideoDocument }): TextUnitAnimator[] {
  if (!result.ok || !result.document) throw new Error("edit refused");
  return result.document.tracks[1].clips[0].textAnimators ?? [];
}

describe("text animator edits", () => {
  it("adds, moves and removes animators on a text clip only", () => {
    let d = doc();
    const first = addClipTextAnimator(d, "o", animator("a1"));
    d = first.ok ? first.document : d;
    const second = addClipTextAnimator(d, "o", animator("a2"));
    d = second.ok ? second.document : d;
    expect(animators(second).map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(animators(moveClipTextAnimator(d, "o", "a2", 0)).map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(animators(removeClipTextAnimator(d, "o", "a1")).map((a) => a.id)).toEqual(["a2"]);
    expect(addClipTextAnimator(doc(), "clip", animator("a1"))).toEqual({ ok: false, reason: "notText" });
    expect(removeClipTextAnimator(d, "o", "nope")).toEqual({ ok: false, reason: "animatorMissing" });
  });

  it("drops the list when the last animator goes", () => {
    const added = addClipTextAnimator(doc(), "o", animator("a1"));
    const removed = removeClipTextAnimator(added.ok ? added.document : doc(), "o", "a1");
    expect(removed.ok && removed.document.tracks[1].clips[0].textAnimators).toBeUndefined();
  });

  it("patches properties, selector fields and keyed values", () => {
    const next = patchTextAnimator(animator("a1"), { unit: "word", properties: { opacity: null, y: 30 }, shape: "triangle", order: "random", seed: 77, keyed: { end: 40 } }, null);
    expect(next).toMatchObject({ unit: "word", properties: { y: 30 }, selector: { shape: "triangle", order: "random", seed: 77, end: 40 } });
    expect(patchTextAnimator(animator("a1"), { rate: 3 }, null)).toBe("foreign");
    expect(patchTextAnimator(animator("a1", { selector: newWigglySelector(1) }), { keyed: { offset: 10 } }, null)).toBe("foreign");
    expect(patchTextAnimator(animator("a1"), { kind: "wiggly", rate: 4 }, null)).toMatchObject({ selector: { kind: "wiggly", rate: 4, seed: 1 } });
    expect(patchTextAnimator(animator("a1"), { keyed: { start: 300 } }, null)).toBe("invalid");
  });

  it("asks for a moment when a keyed value changes and writes a key there", () => {
    const keyed = animator("a1", { keyframes: { offset: [{ atMs: 0, value: -25, easing: "linear" }, { atMs: 1000, value: 100, easing: "linear" }] } });
    expect(patchTextAnimator(keyed, { keyed: { offset: 0 } }, null)).toBe("animated");
    const placed = patchTextAnimator(keyed, { keyed: { offset: 0 } }, 500);
    expect(typeof placed !== "string" && placed.keyframes?.offset?.map((frame) => frame.atMs)).toEqual([0, 500, 1000]);
  });

  it("animates and toggles selector keys inside the clip", () => {
    const added = addClipTextAnimator(doc(), "o", animator("a1"));
    const d = added.ok ? added.document : doc();
    const lane = animateClipTextAnimator(d, "o", "a1", "offset", [{ atMs: 0, value: -25, easing: "easeOut" }, { atMs: 900, value: 100, easing: "linear" }]);
    expect(animators(lane)[0].keyframes?.offset).toHaveLength(2);
    expect(animateClipTextAnimator(d, "o", "a1", "offset", [{ atMs: 5000, value: 0, easing: "linear" }])).toEqual({ ok: false, reason: "outside" });
    const toggled = toggleClipTextAnimatorKey(d, "o", "a1", "amount", 300);
    expect(animators(toggled)[0].keyframes?.amount).toEqual([{ atMs: 300, value: 100, easing: "linear" }]);
    expect(updateClipTextAnimator(d, "o", "a1", { properties: { stroke: "#ff0000" } }, null)).toEqual({ ok: false, reason: "invalid" });
  });
});
