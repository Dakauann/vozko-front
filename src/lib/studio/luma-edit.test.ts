import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "./document";
import { animateClipLuma, lumaSelectionEdit, removeClipLuma, setClipLuma, toggleClipLumaKey } from "./luma-edit";
import { LUMA_DEFAULTS } from "./luma-key";
import { findClip } from "./timeline";
import { documentIssue } from "./validate";

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 2000), id: "c" }] },
    { id: "t", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 2000), id: "o" }] },
  ];
  d.durationMs = 2000;
  return d;
}

const keyOf = (d: VideoDocument) => findClip(d, "c")!.clip.lumaKey;

describe("luma key edits", () => {
  it("turns the key on with the defaults, then changes mode and values", () => {
    const on = setClipLuma(film(), "c", {}, null);
    if (!on.ok) throw new Error(on.reason);
    expect(keyOf(on.document)).toEqual({ mode: "dark", ...LUMA_DEFAULTS });
    const tuned = setClipLuma(on.document, "c", { mode: "light", threshold: 0.3 }, null);
    if (!tuned.ok) throw new Error(tuned.reason);
    expect(keyOf(tuned.document)).toEqual({ mode: "light", threshold: 0.3, softness: LUMA_DEFAULTS.softness });
    expect(documentIssue("video", tuned.document)).toBeNull();
  });

  it("refuses texts, an unknown mode, values out of range and an animated value without a moment", () => {
    expect(setClipLuma(film(), "o", {}, null)).toEqual({ ok: false, reason: "notKeyable" });
    expect(setClipLuma(film(), "c", { mode: "gray" as "dark" }, null)).toEqual({ ok: false, reason: "invalid" });
    expect(setClipLuma(film(), "c", { softness: 0 }, null)).toEqual({ ok: false, reason: "invalid" });
    const animated = animateClipLuma(film(), "c", "threshold", [{ atMs: 0, value: 0.1, easing: "linear" }]);
    if (!animated.ok) throw new Error(animated.reason);
    expect(setClipLuma(animated.document, "c", { threshold: 0.5 }, null)).toEqual({ ok: false, reason: "animated" });
    const keyed = setClipLuma(animated.document, "c", { threshold: 0.5 }, 1000);
    expect(keyed.ok && keyOf(keyed.document)?.keyframes?.threshold?.map((k) => k.atMs)).toEqual([0, 1000]);
    expect(animateClipLuma(film(), "c", "softness", [{ atMs: 5000, value: 0.2, easing: "linear" }])).toEqual({ ok: false, reason: "outside" });
  });

  it("toggles a key at the playhead and removes the key entirely", () => {
    const on = setClipLuma(film(), "c", {}, null);
    if (!on.ok) throw new Error(on.reason);
    const keyed = toggleClipLumaKey(on.document, "c", "softness", 400);
    expect(keyed.ok && keyOf(keyed.document)?.keyframes?.softness).toHaveLength(1);
    expect(toggleClipLumaKey(film(), "c", "softness", 400)).toEqual({ ok: false, reason: "off" });
    const removed = removeClipLuma(on.document, "c");
    expect(removed.ok && keyOf(removed.document)).toBeUndefined();
    expect(lumaSelectionEdit({ ok: false, reason: "notKeyable" })).toEqual({ ok: false, reason: "invalid" });
  });
});
