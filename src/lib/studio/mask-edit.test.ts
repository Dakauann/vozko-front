import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "./document";
import { addClipMask, animateClipMask, moveClipMask, maskSelectionEdit, removeClipMask, toggleClipMaskKey, updateClipMask } from "./mask-edit";
import { MASK_DEFAULT_PATH, maskProperties, newMask, reshapeMask } from "./masks";
import { findClip } from "./timeline";
import { documentIssue } from "./validate";

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 1000, 2000), id: "c" }] },
    { id: "a", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 2000), id: "s" }] },
  ];
  d.durationMs = 3000;
  return d;
}

const masksOf = (d: VideoDocument) => findClip(d, "c")!.clip.masks ?? [];

describe("clip mask edits", () => {
  it("adds masks in order and inserts at an index", () => {
    const first = addClipMask(film(), "c", newMask("ellipse", "m1"));
    if (!first.ok) throw new Error(first.reason);
    const second = addClipMask(first.document, "c", newMask("rectangle", "m2"), 0);
    if (!second.ok) throw new Error(second.reason);
    expect(masksOf(second.document).map((m) => m.id)).toEqual(["m2", "m1"]);
    expect(documentIssue("video", second.document)).toBeNull();
  });

  it("refuses sound clips, locked tracks, missing clips and unknown masks", () => {
    expect(addClipMask(film(), "s", newMask("ellipse", "m"))).toEqual({ ok: false, reason: "notVisual" });
    expect(addClipMask(film(), "x", newMask("ellipse", "m"))).toEqual({ ok: false, reason: "missing" });
    const locked = film();
    locked.tracks[0].locked = true;
    expect(addClipMask(locked, "c", newMask("ellipse", "m"))).toEqual({ ok: false, reason: "locked" });
    expect(updateClipMask(film(), "c", "nope", { feather: 0.1 }, null)).toEqual({ ok: false, reason: "maskMissing" });
  });

  it("updates values, writes a key at the moment when the value is animated, and refuses without one", () => {
    const added = addClipMask(film(), "c", newMask("ellipse", "m"));
    if (!added.ok) throw new Error(added.reason);
    const moved = updateClipMask(added.document, "c", "m", { x: 0.3, mode: "subtract", invert: true }, null);
    if (!moved.ok) throw new Error(moved.reason);
    expect(masksOf(moved.document)[0]).toMatchObject({ x: 0.3, mode: "subtract", invert: true });
    const animated = animateClipMask(moved.document, "c", "m", "opacity", [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 500, value: 1, easing: "linear" }]);
    if (!animated.ok) throw new Error(animated.reason);
    expect(updateClipMask(animated.document, "c", "m", { opacity: 0.5 }, null)).toEqual({ ok: false, reason: "animated" });
    const keyed = updateClipMask(animated.document, "c", "m", { opacity: 0.5 }, 250);
    if (!keyed.ok) throw new Error(keyed.reason);
    expect(masksOf(keyed.document)[0].keyframes?.opacity?.map((k) => k.atMs)).toEqual([0, 250, 500]);
  });

  it("clears a lane with no keys and refuses keys past the clip or out of range", () => {
    const added = addClipMask(film(), "c", newMask("ellipse", "m"));
    if (!added.ok) throw new Error(added.reason);
    const animated = animateClipMask(added.document, "c", "m", "x", [{ atMs: 0, value: 0.2, easing: "linear" }]);
    if (!animated.ok) throw new Error(animated.reason);
    const cleared = animateClipMask(animated.document, "c", "m", "x", []);
    if (!cleared.ok) throw new Error(cleared.reason);
    expect(masksOf(cleared.document)[0].keyframes).toBeUndefined();
    expect(masksOf(cleared.document)[0].x).toBeCloseTo(0.2);
    expect(animateClipMask(added.document, "c", "m", "x", [{ atMs: 2500, value: 0.2, easing: "linear" }])).toEqual({ ok: false, reason: "outside" });
    expect(animateClipMask(added.document, "c", "m", "feather", [{ atMs: 0, value: 2, easing: "linear" }])).toEqual({ ok: false, reason: "invalid" });
  });

  it("reorders and removes masks", () => {
    let d = film();
    for (const id of ["a", "b", "c"]) {
      const result = addClipMask(d, "c", newMask("ellipse", id));
      if (!result.ok) throw new Error(result.reason);
      d = result.document;
    }
    const moved = moveClipMask(d, "c", "c", 0);
    if (!moved.ok) throw new Error(moved.reason);
    expect(masksOf(moved.document).map((m) => m.id)).toEqual(["c", "a", "b"]);
    const removed = removeClipMask(moved.document, "c", "a");
    if (!removed.ok) throw new Error(removed.reason);
    expect(masksOf(removed.document).map((m) => m.id)).toEqual(["c", "b"]);
    let emptied = removed.document;
    for (const id of ["c", "b"]) {
      const result = removeClipMask(emptied, "c", id);
      if (!result.ok) throw new Error(result.reason);
      emptied = result.document;
    }
    expect(findClip(emptied, "c")!.clip.masks).toBeUndefined();
  });
});

describe("mask edits in the inspector", () => {
  it("toggles a key at the moment inside the clip", () => {
    const added = addClipMask(film(), "c", newMask("ellipse", "m"));
    if (!added.ok) throw new Error(added.reason);
    const keyed = toggleClipMaskKey(added.document, "c", "m", "w", 300);
    if (!keyed.ok) throw new Error(keyed.reason);
    expect(masksOf(keyed.document)[0].keyframes?.w).toEqual([{ atMs: 300, value: 0.5, easing: "linear" }]);
    const cleared = toggleClipMaskKey(keyed.document, "c", "m", "w", 300);
    expect(cleared.ok && masksOf(cleared.document)[0].keyframes).toBeUndefined();
    expect(toggleClipMaskKey(added.document, "c", "m", "w", 9000)).toEqual({ ok: false, reason: "outside" });
  });

  it("offers the fields each shape uses", () => {
    expect(maskProperties("linear")).toEqual(["x", "y", "rotation", "feather", "expansion", "opacity"]);
    expect(maskProperties("mirror")).toEqual(["x", "y", "h", "rotation", "feather", "expansion", "opacity"]);
    expect(maskProperties("rectangle")).toContain("roundness");
    expect(maskProperties("star")).toContain("inner");
    expect(maskProperties("ellipse")).not.toContain("roundness");
  });

  it("speaks the inspector refusals", () => {
    const locked = film();
    locked.tracks[0].locked = true;
    expect(maskSelectionEdit(addClipMask(locked, "c", newMask("ellipse", "m")))).toEqual({ ok: false, reason: "locked" });
    expect(maskSelectionEdit(updateClipMask(film(), "c", "m", {}, null))).toEqual({ ok: false, reason: "invalid" });
    expect(maskSelectionEdit(addClipMask(film(), "c", newMask("ellipse", "m"))).ok).toBe(true);
  });
});

describe("reshaping a mask", () => {
  it("keeps the frame and adds or drops what only some shapes carry", () => {
    const star = reshapeMask({ ...newMask("rectangle", "m"), x: 0.2, roundness: 0.3 }, "star");
    expect(star).toMatchObject({ shape: "star", x: 0.2, points: 5, inner: 0.45 });
    expect(star.roundness).toBeUndefined();
    const ellipse = reshapeMask(star, "ellipse");
    expect(ellipse.points).toBeUndefined();
    expect(ellipse.inner).toBeUndefined();
    const keyed = reshapeMask({ ...star, keyframes: { inner: [{ atMs: 0, value: 0.3, easing: "linear" }], x: [{ atMs: 0, value: 0.1, easing: "linear" }] } }, "ellipse");
    expect(Object.keys(keyed.keyframes ?? {})).toEqual(["x"]);
    expect(reshapeMask(newMask("path", "p"), "ellipse").path).toBeUndefined();
    expect(reshapeMask(newMask("ellipse", "e"), "path").path).toBe(MASK_DEFAULT_PATH);
  });
});
