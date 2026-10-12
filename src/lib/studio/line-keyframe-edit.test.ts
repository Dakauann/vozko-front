import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newOverlayClip, newShapeLayer, type Clip, type VideoDocument } from "./document";
import { editKeyed, laneProperties, propertyValue, recordMoment, toggleAnimation, toggleKeyAt } from "./keyframe-edit";
import { LINE_DEFAULTS } from "./line-animation";
import { commonFields, keyedPatch } from "./selection-edit";
import { splitAt } from "./edits";

function lineClip(extra: Partial<Clip> = {}): Clip {
  return { ...newOverlayClip(newShapeLayer("line"), 0, 2000), id: "c-line", ...extra };
}

describe("line properties in the shared keyframe machinery", () => {
  it("shows lanes only for the groups that are on", () => {
    expect(laneProperties(lineClip())).not.toContain("trimEnd");
    const lanes = laneProperties(lineClip({ line: { trim: LINE_DEFAULTS.trim, wave: LINE_DEFAULTS.wave } }));
    expect(lanes).toEqual(expect.arrayContaining(["trimStart", "trimEnd", "trimOffset", "waveAmount", "waveLength", "waveSpeed", "wavePhase"]));
    expect(lanes).not.toContain("wiggleSize");
  });

  it("starts animating from the still value and stops back into the group", () => {
    const clip = lineClip({ line: { trim: { ...LINE_DEFAULTS.trim, end: 0.3 } } });
    const started = toggleAnimation(clip, "trimEnd", 400, 1);
    expect(started.keyframes?.trimEnd).toEqual([{ atMs: 400, value: 0.3, easing: "linear" }]);
    const animated = { ...clip, keyframes: { trimEnd: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 1000, value: 1, easing: "linear" as const }] } };
    const stopped = toggleAnimation(animated, "trimEnd", 500, 1);
    expect(stopped.keyframes).toBeUndefined();
    expect(stopped.line?.trim?.end).toBeCloseTo(0.5);
  });

  it("toggles a key at the moment with the value shown there", () => {
    const animated = lineClip({ line: { wave: LINE_DEFAULTS.wave }, keyframes: { waveAmount: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 20, easing: "linear" }] } });
    const keyed = toggleKeyAt(animated, "waveAmount", 500, 1);
    expect(keyed.keyframes?.waveAmount?.[1]).toEqual({ atMs: 500, value: 10, easing: "linear" });
  });

  it("records a moment that includes animated line lanes", () => {
    const animated = lineClip({ line: { trim: LINE_DEFAULTS.trim }, keyframes: { trimEnd: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 1, easing: "linear" }] } });
    const moment = recordMoment(animated, 250, 1);
    expect(moment?.keyframes?.trimEnd?.map((frame) => frame.atMs)).toEqual([0, 250, 1000]);
  });

  it("edits a still value in place or keys it at the playhead when animated, clamped to its range", () => {
    const clip = lineClip({ line: { wave: LINE_DEFAULTS.wave } });
    expect(editKeyed(clip, "waveLength", 2, null).patch.line?.wave?.wavelength).toBe(8);
    const animated = { ...clip, keyframes: { waveSpeed: [{ atMs: 0, value: 1, easing: "linear" as const }] } };
    expect(editKeyed(animated, "waveSpeed", 3, null)).toEqual({ patch: {}, outside: true });
    expect(editKeyed(animated, "waveSpeed", 3, 600).patch.keyframes?.waveSpeed?.[1]).toEqual({ atMs: 600, value: 3, easing: "linear" });
    expect(keyedPatch(clip, "waveAmount", (shown) => shown + 4, 300)).toEqual({ line: { wave: { ...LINE_DEFAULTS.wave, amount: 16 } } });
    expect(propertyValue(clip, "waveAmount", 0)).toBe(LINE_DEFAULTS.wave.amount);
  });

  it("offers the line section for a single stroked overlay", () => {
    expect(commonFields([lineClip()]).has("line")).toBe(true);
    expect(commonFields([lineClip(), { ...lineClip(), id: "c-2" }]).has("line")).toBe(false);
    expect(commonFields([{ ...lineClip(), layer: { ...newShapeLayer("rect") } }]).has("line")).toBe(false);
  });

  it("keeps line keys on both pieces of a split", () => {
    const doc: VideoDocument = emptyVideoDocument("square");
    doc.tracks = [{ id: "v1", kind: "visual", clips: [lineClip({ line: { trim: LINE_DEFAULTS.trim }, keyframes: { trimEnd: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 2000, value: 1, easing: "linear" }] } })] }];
    doc.durationMs = 2000;
    const split = splitAt(doc, 1000, ["c-line"]);
    const pieces = split.tracks[0].clips;
    expect(pieces).toHaveLength(2);
    expect(pieces.every((piece) => piece.line?.trim)).toBe(true);
    expect(propertyValue(pieces[1], "trimEnd", 0)).toBeCloseTo(0.5);
  });
});
