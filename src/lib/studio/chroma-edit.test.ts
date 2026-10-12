import { describe, expect, it } from "vitest";

import { animateClipChroma, chromaSelectionEdit, removeClipChroma, setClipChroma, toggleClipChromaKey } from "./chroma-edit";
import { CHROMA_DEFAULTS, CHROMA_PRESETS } from "./chroma-key";
import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "./document";
import { findClip } from "./timeline";
import { documentIssue } from "./validate";

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 2000), id: "c" }] },
    { id: "t", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 2000), id: "o" }] },
  ];
  d.durationMs = 2000;
  return d;
}

const keyOf = (d: VideoDocument) => findClip(d, "c")!.clip.chromaKey;

describe("chroma key edits", () => {
  it("turns the key on with the defaults, then changes color and values", () => {
    const on = setClipChroma(film(), "c", {}, null);
    if (!on.ok) throw new Error(on.reason);
    expect(keyOf(on.document)).toEqual({ color: CHROMA_PRESETS.green, ...CHROMA_DEFAULTS });
    const tuned = setClipChroma(on.document, "c", { color: "#0099FF", similarity: 0.3 }, null);
    if (!tuned.ok) throw new Error(tuned.reason);
    expect(keyOf(tuned.document)).toMatchObject({ color: "#0099ff", similarity: 0.3 });
    expect(documentIssue("video", tuned.document)).toBeNull();
  });

  it("refuses texts, a bad color, values out of range and an animated value without a moment", () => {
    expect(setClipChroma(film(), "o", {}, null)).toEqual({ ok: false, reason: "notKeyable" });
    expect(setClipChroma(film(), "c", { color: "verde" }, null)).toEqual({ ok: false, reason: "invalid" });
    expect(setClipChroma(film(), "c", { spill: 2 }, null)).toEqual({ ok: false, reason: "invalid" });
    const animated = animateClipChroma(film(), "c", "similarity", [{ atMs: 0, value: 0.2, easing: "linear" }]);
    if (!animated.ok) throw new Error(animated.reason);
    expect(setClipChroma(animated.document, "c", { similarity: 0.5 }, null)).toEqual({ ok: false, reason: "animated" });
    const keyed = setClipChroma(animated.document, "c", { similarity: 0.5 }, 1000);
    expect(keyed.ok && keyOf(keyed.document)?.keyframes?.similarity?.map((k) => k.atMs)).toEqual([0, 1000]);
    expect(animateClipChroma(film(), "c", "spill", [{ atMs: 5000, value: 0.2, easing: "linear" }])).toEqual({ ok: false, reason: "outside" });
  });

  it("toggles a key at the playhead and removes the key entirely", () => {
    const on = setClipChroma(film(), "c", {}, null);
    if (!on.ok) throw new Error(on.reason);
    const keyed = toggleClipChromaKey(on.document, "c", "smoothness", 400);
    expect(keyed.ok && keyOf(keyed.document)?.keyframes?.smoothness).toHaveLength(1);
    expect(toggleClipChromaKey(film(), "c", "smoothness", 400)).toEqual({ ok: false, reason: "off" });
    const removed = removeClipChroma(on.document, "c");
    expect(removed.ok && keyOf(removed.document)).toBeUndefined();
    expect(chromaSelectionEdit({ ok: false, reason: "notKeyable" })).toEqual({ ok: false, reason: "invalid" });
  });
});
