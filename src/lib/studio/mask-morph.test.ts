import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "./document";
import { animateClipMaskPath, toggleClipMaskPathKey, updateClipMask } from "./mask-edit";
import { editMaskPath, maskAt, maskIssue, maskPathKeyState, newMask, setMaskPathKey, toggleMaskPathKey, type Mask } from "./masks";
import { morphPath } from "./path-morph";
import { findClip, splitClip } from "./timeline";
import { documentIssue } from "./validate";

const DIAMOND = "M0.5 0 L1 0.5 L0.5 1 L0 0.5 Z";
const ROUND = "M0 0.5 A0.5 0.5 0 0 1 1 0.5 A0.5 0.5 0 0 1 0 0.5 Z";

function plate(mask: Mask): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.tracks = [{ id: "v", kind: "visual", clips: [{ ...newMediaClip("image", "m", 0, 2000), id: "plate", masks: [mask] }] }];
  doc.durationMs = 2000;
  return doc;
}

function maskOf(doc: VideoDocument, clipId = "plate"): Mask {
  return findClip(doc, clipId)!.clip.masks![0];
}

describe("path keys on masks", () => {
  const blob = { ...newMask("path", "blob"), path: DIAMOND };

  it("morphs the mask path between its keys", () => {
    const keyed = setMaskPathKey(setMaskPathKey(blob, 0, DIAMOND), 1000, ROUND);
    expect(maskAt(keyed, 500).path).toBe(morphPath(DIAMOND, ROUND, 0.5));
    expect(maskAt(keyed, 1000).path).toBe(ROUND);
    expect(maskPathKeyState(keyed, 1000)).toBe("key");
    expect(maskPathKeyState(keyed, 400)).toBe("interpolated");
    expect(maskPathKeyState(blob, 400)).toBe("static");
  });

  it("keys the shown path when toggled and leaves the last key as the still path", () => {
    const keyed = toggleMaskPathKey(setMaskPathKey(blob, 1000, ROUND), 0);
    expect(keyed.keyframes?.path?.map((key) => key.atMs)).toEqual([0, 1000]);
    const one = toggleMaskPathKey(toggleMaskPathKey(keyed, 0), 1000);
    expect(one.keyframes).toBeUndefined();
    expect(one.path).toBe(ROUND);
  });

  it("edits the still path, or writes a key once the path animates", () => {
    expect(editMaskPath(blob, ROUND, null)?.path).toBe(ROUND);
    const keyed = setMaskPathKey(blob, 0, DIAMOND);
    expect(editMaskPath(keyed, ROUND, null)).toBeNull();
    expect(editMaskPath(keyed, ROUND, 600)?.keyframes?.path?.map((key) => key.atMs)).toEqual([0, 600]);
  });

  it("refuses path keys on masks that are not paths and keys that do not parse", () => {
    expect(maskIssue([setMaskPathKey(blob, 0, DIAMOND)])).toBeNull();
    expect(maskIssue([{ ...newMask("ellipse", "e"), keyframes: { path: [{ atMs: 0, path: DIAMOND, easing: "linear" }] } }])).toBe("invalid");
    expect(maskIssue([{ ...blob, keyframes: { path: [{ atMs: 0, path: "Z", easing: "linear" }] } }])).toBe("invalid");
    expect(maskIssue([{ ...blob, keyframes: { path: [{ atMs: 0, path: DIAMOND, easing: "nope" as "linear" }] } }])).toBe("unknown");
  });

  it("edits masks of a clip through the shared mask edits", () => {
    const doc = plate(blob);
    const animated = animateClipMaskPath(doc, "plate", "blob", [
      { atMs: 0, path: DIAMOND, easing: "linear" },
      { atMs: 1500, path: ROUND, easing: "linear" },
    ]);
    if (!animated.ok) throw new Error(animated.reason);
    expect(documentIssue("video", animated.document)).toBeNull();
    expect(animateClipMaskPath(doc, "plate", "blob", [{ atMs: 2500, path: ROUND, easing: "linear" }])).toEqual({ ok: false, reason: "outside" });
    const toggled = toggleClipMaskPathKey(animated.document, "plate", "blob", 700);
    expect(toggled.ok && maskOf(toggled.document).keyframes?.path?.length).toBe(3);
    expect(updateClipMask(animated.document, "plate", "blob", { path: DIAMOND }, null)).toEqual({ ok: false, reason: "animated" });
  });

  it("shifts mask keys into the right piece of a split", () => {
    const keyed = { ...blob, keyframes: { path: [{ atMs: 0, path: DIAMOND, easing: "linear" as const }, { atMs: 1500, path: ROUND, easing: "linear" as const }], opacity: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 1000, value: 1, easing: "linear" as const }] } };
    const split = splitClip(plate(keyed), "plate", 500);
    const right = maskOf(split.document, split.clipId!);
    expect(right.keyframes?.path?.map((key) => key.atMs)).toEqual([-500, 1000]);
    expect(right.keyframes?.opacity?.map((key) => key.atMs)).toEqual([-500, 500]);
    expect(maskAt(right, 0).path).toBe(maskAt(keyed, 500).path);
  });
});
