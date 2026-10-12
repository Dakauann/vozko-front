import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "./document";
import { findClip } from "./timeline";
import { documentIssue } from "./validate";
import { newVfx } from "./vfx";
import { addClipVfx, addEffectClip, animateClipVfx, moveClipVfx, removeClipVfx, toggleClipVfxKey, updateClipVfx, vfxSelectionEdit } from "./vfx-edit";

function film(): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 3000), id: "c" }] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Hi"), 500, 1000), id: "t" }] },
    { id: "a", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 3000), id: "s" }] },
  ];
  d.durationMs = 3000;
  return d;
}

const vfxOf = (d: VideoDocument, id = "c") => findClip(d, id)!.clip.vfx ?? [];

function ok(result: ReturnType<typeof addClipVfx>): VideoDocument {
  if (!result.ok) throw new Error(result.reason);
  return result.document;
}

describe("clip effect edits", () => {
  it("adds effects in order, inserts at an index, moves and removes them", () => {
    const one = ok(addClipVfx(film(), "c", newVfx("grain", "g", 1)));
    const two = ok(addClipVfx(one, "c", newVfx("vignette", "v", 2), 0));
    expect(vfxOf(two).map((vfx) => vfx.id)).toEqual(["v", "g"]);
    const moved = ok(moveClipVfx(two, "c", "v", 1));
    expect(vfxOf(moved).map((vfx) => vfx.id)).toEqual(["g", "v"]);
    const removed = ok(removeClipVfx(moved, "c", "g"));
    expect(vfxOf(removed).map((vfx) => vfx.id)).toEqual(["v"]);
    expect(findClip(ok(removeClipVfx(removed, "c", "v")), "c")!.clip.vfx).toBeUndefined();
    expect(documentIssue("video", two)).toBeNull();
  });

  it("refuses sound clips, missing effects and invalid values", () => {
    expect(addClipVfx(film(), "s", newVfx("grain", "g", 1))).toEqual({ ok: false, reason: "notVisual" });
    expect(updateClipVfx(film(), "c", "nope", { params: { amount: 0.2 } }, null)).toEqual({ ok: false, reason: "vfxMissing" });
    const grain = ok(addClipVfx(film(), "c", newVfx("grain", "g", 1)));
    expect(updateClipVfx(grain, "c", "g", { params: { amount: 5 } }, null)).toEqual({ ok: false, reason: "invalid" });
    expect(updateClipVfx(grain, "c", "g", { params: { ghosts: 0.5 } }, null)).toEqual({ ok: false, reason: "invalid" });
  });

  it("updates values, colors, seed and visibility, and writes a key at the moment when the value is animated", () => {
    const leak = ok(addClipVfx(film(), "c", newVfx("lightLeak", "l", 1)));
    const updated = ok(updateClipVfx(leak, "c", "l", { params: { amount: 0.3 }, colors: { color: "#00ff00" }, seed: 9, hidden: true }, null));
    expect(vfxOf(updated)[0]).toMatchObject({ seed: 9, hidden: true, params: { amount: 0.3 }, colors: { color: "#00ff00" } });
    const shown = ok(updateClipVfx(updated, "c", "l", { hidden: false }, null));
    expect(vfxOf(shown)[0].hidden).toBeUndefined();
    const keyed = ok(animateClipVfx(shown, "c", "l", "amount", [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 1, easing: "linear" }]));
    expect(updateClipVfx(keyed, "c", "l", { params: { amount: 0.5 } }, null)).toEqual({ ok: false, reason: "animated" });
    const atMoment = ok(updateClipVfx(keyed, "c", "l", { params: { amount: 0.5 } }, 500));
    expect(vfxOf(atMoment)[0].keyframes?.amount?.map((key) => key.atMs)).toEqual([0, 500, 1000]);
  });

  it("refuses keys on pace parameters and keys outside the clip", () => {
    const sparks = ok(addClipVfx(film(), "c", newVfx("particles", "p", 1)));
    expect(animateClipVfx(sparks, "c", "p", "speed", [{ atMs: 0, value: 1, easing: "linear" }])).toEqual({ ok: false, reason: "paced" });
    expect(animateClipVfx(sparks, "c", "p", "size", [{ atMs: 5000, value: 3, easing: "linear" }])).toEqual({ ok: false, reason: "outside" });
    expect(toggleClipVfxKey(sparks, "c", "p", "speed", 100)).toEqual({ ok: false, reason: "paced" });
    const toggled = ok(toggleClipVfxKey(sparks, "c", "p", "size", 100));
    expect(vfxOf(toggled)[0].keyframes?.size).toEqual([{ atMs: 100, value: 6, easing: "linear" }]);
  });

  it("maps refusals onto the inspector's reasons", () => {
    expect(vfxSelectionEdit({ ok: false, reason: "locked" })).toEqual({ ok: false, reason: "locked" });
    expect(vfxSelectionEdit({ ok: false, reason: "paced" })).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("effect clips", () => {
  it("places a new effect clip above everything on screen at that time", () => {
    const placed = addEffectClip(film(), [newVfx("glitch", "x", 3)], 600, 800);
    if (!placed) throw new Error("not placed");
    const found = findClip(placed.document, placed.clipId)!;
    expect(placed.document.tracks.indexOf(found.track)).toBeGreaterThan(1);
    expect(found.clip).toMatchObject({ type: "effect", startMs: 600, durationMs: 800 });
    expect(documentIssue("video", placed.document)).toBeNull();
  });

  it("keeps an emptied effect clip as an empty list so it stays valid", () => {
    const placed = addEffectClip(film(), [newVfx("glitch", "x", 3)], 0, 1000)!;
    const emptied = ok(removeClipVfx(placed.document, placed.clipId, "x"));
    expect(findClip(emptied, placed.clipId)!.clip.vfx).toEqual([]);
    expect(documentIssue("video", emptied)).toBeNull();
  });
});
