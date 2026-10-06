import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "./document";
import { linkGroup, moveGroup, placeGroup } from "./edits";
import {
  blade,
  bladeTargets,
  closeGap,
  copyClips,
  extractRange,
  gapAt,
  liftRange,
  nudgeClips,
  pasteClips,
  relinkClips,
  rollEdit,
  selectForward,
  selectFromPlayhead,
  slideClip,
  slipClip,
  toggleDisabled,
} from "./tools";
import { findClip } from "./timeline";
import { documentIssue } from "./validate";

function clip(id: string, startMs: number, durationMs: number, type: "video" | "image" | "audio" = "video", extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip(type, `m-${id}`, startMs, durationMs), id, ...extra };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "main", kind: "visual", clips: [clip("a", 0, 2000, "video", { linkId: "pa", trimInMs: 1000 }), clip("b", 2000, 2000), clip("c", 5000, 1000, "image")] },
    { id: "top", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 3000, 1000), id: "o" }] },
    { id: "sound", kind: "audio", clips: [clip("as", 0, 2000, "audio", { linkId: "pa", trimInMs: 1000 })] },
  ];
  d.durationMs = 6000;
  return d;
}

function at(d: VideoDocument, id: string) {
  const found = findClip(d, id);
  return found ? { track: found.track.id, start: found.clip.startMs, duration: found.clip.durationMs, trimIn: found.clip.trimInMs } : null;
}

describe("selection tools", () => {
  it("selects forward on one track or all tracks", () => {
    expect(selectForward(doc(), "b", false)).toEqual(["b", "c"]);
    expect(selectForward(doc(), "b", true).sort()).toEqual(["b", "c", "o"]);
  });

  it("selects by playhead", () => {
    expect(selectFromPlayhead(doc(), 3500, "after").sort()).toEqual(["b", "c", "o"]);
    expect(selectFromPlayhead(doc(), 2500, "before", ["main"]).sort()).toEqual(["a", "b"]);
  });

  it("moves a whole section to the right as one block", () => {
    const d = doc();
    const section = selectForward(d, "b", true);
    const moved = moveGroup(d, "b", section, null, 3000);
    expect([at(moved, "b")?.start, at(moved, "c")?.start, at(moved, "o")?.start]).toEqual([3000, 6000, 4000]);
    expect(documentIssue("video", moved)).toBeNull();
  });

  it("refuses a section move into a collision and inserts it instead", () => {
    const d = doc();
    expect(moveGroup(d, "b", ["b", "c"], null, 1000)).toBe(d);
    const inserted = placeGroup(d, "insert", "c", ["c"], "main", 2000);
    expect([at(inserted, "c")?.start, at(inserted, "b")?.start]).toEqual([2000, 3000]);
  });
});

describe("blade", () => {
  it("resolves the clip under the pointer and its linked partner", () => {
    expect(bladeTargets(doc(), "main", 1000, { allTracks: false, linked: false })).toEqual(["a"]);
    expect(bladeTargets(doc(), "main", 1000, { allTracks: false, linked: true }).sort()).toEqual(["a", "as"]);
    expect(bladeTargets(doc(), "main", 3500, { allTracks: true, linked: false }).sort()).toEqual(["b", "o"]);
    expect(bladeTargets(doc(), "main", 4500, { allTracks: false, linked: false })).toEqual([]);
    expect(bladeTargets(doc(), "main", 2050, { allTracks: false, linked: false })).toEqual([]);
  });

  it("cuts and keeps the cut pieces linked in pairs", () => {
    const cut = blade(doc(), "main", 1000, { allTracks: false, linked: true });
    expect(cut.tracks[0].clips.map((c) => [c.startMs, c.durationMs])).toEqual([
      [0, 1000],
      [1000, 1000],
      [2000, 2000],
      [5000, 1000],
    ]);
    expect(linkGroup(cut, "a").sort()).toEqual(["a", "as"]);
    expect(documentIssue("video", cut)).toBeNull();
  });
});

describe("gaps", () => {
  it("finds the gap under the pointer, but not past the last clip", () => {
    expect(gapAt(doc(), "main", 4500)).toEqual({ trackId: "main", fromMs: 4000, toMs: 5000 });
    expect(gapAt(doc(), "top", 1000)).toEqual({ trackId: "top", fromMs: 0, toMs: 3000 });
    expect(gapAt(doc(), "main", 1000)).toBeNull();
    expect(gapAt(doc(), "main", 9000)).toBeNull();
  });

  it("closes a gap by pulling what follows with its links", () => {
    const closed = closeGap(doc(), { trackId: "main", fromMs: 4000, toMs: 5000 });
    expect(at(closed, "c")?.start).toBe(4000);
    expect(at(closed, "o")?.start).toBe(3000);
  });
});

describe("trim tools", () => {
  it("rolls the cut between two neighbours keeping the total", () => {
    const rolled = rollEdit(doc(), "a", "b", 2600);
    expect(at(rolled, "a")?.duration).toBe(2600);
    expect(at(rolled, "b")).toMatchObject({ start: 2600, duration: 1400, trimIn: 600 });
    const d = doc();
    d.tracks[0].clips[1] = clip("b", 2000, 2000, "video", { trimInMs: 300 });
    const left = rollEdit(d, "a", "b", 1500);
    expect(at(left, "b")).toMatchObject({ start: 1700, duration: 2300, trimIn: 0 });
    expect(at(left, "a")?.duration).toBe(1700);
    const fixed = doc();
    expect(rollEdit(fixed, "a", "b", 2600, () => 2500)).toBe(fixed);
  });

  it("slips the source window without moving the clip", () => {
    const slipped = slipClip(doc(), "a", -400, 10_000);
    expect(at(slipped, "a")).toMatchObject({ start: 0, duration: 2000, trimIn: 600 });
    expect(at(slipClip(doc(), "a", -5000), "a")?.trimIn).toBe(0);
  });

  it("slides a clip between its neighbours", () => {
    const d = doc();
    d.tracks[0].clips[2] = clip("c", 4000, 1000, "image");
    const slid = slideClip(d, "b", 300);
    expect(at(slid, "a")?.duration).toBe(2300);
    expect(at(slid, "b")?.start).toBe(2300);
    expect(at(slid, "c")).toMatchObject({ start: 4300, duration: 700 });
    expect(documentIssue("video", slid)).toBeNull();
  });
});

describe("ranges", () => {
  it("lifts a range and leaves a gap", () => {
    const lifted = liftRange(doc(), { inMs: 1000, outMs: 3000 });
    expect(at(lifted, "a")?.duration).toBe(1000);
    expect(at(lifted, "b")).toMatchObject({ start: 3000, duration: 1000 });
    expect(at(lifted, "c")?.start).toBe(5000);
  });

  it("extracts a range and ripples the rest", () => {
    const extracted = extractRange(doc(), { inMs: 1000, outMs: 3000 });
    expect(at(extracted, "b")).toMatchObject({ start: 1000, duration: 1000 });
    expect(at(extracted, "c")?.start).toBe(3000);
    expect(at(extracted, "o")?.start).toBe(1000);
    expect(documentIssue("video", extracted)).toBeNull();
  });
});

describe("clipboard", () => {
  it("pastes at the playhead overwriting what is there", () => {
    const payload = copyClips(doc(), ["c"])!;
    const pasted = pasteClips(doc(), payload, 1500, "overwrite")!;
    expect(at(pasted.document, pasted.ids[0])).toMatchObject({ track: "main", start: 1500 });
    expect(at(pasted.document, "a")?.duration).toBe(1500);
  });

  it("pastes as insert and ripples the following clips", () => {
    const payload = copyClips(doc(), ["c"])!;
    const pasted = pasteClips(doc(), payload, 2000, "insert")!;
    expect(at(pasted.document, "b")?.start).toBe(3000);
    expect(at(pasted.document, "c")?.start).toBe(6000);
    expect(documentIssue("video", pasted.document)).toBeNull();
  });

  it("pastes a linked pair with a fresh link", () => {
    const payload = copyClips(doc(), ["a", "as"])!;
    const pasted = pasteClips(doc(), payload, 6000, "overwrite")!;
    const [first, second] = pasted.ids.map((id) => findClip(pasted.document, id)!.clip);
    expect(first.linkId).toBe(second.linkId);
    expect(first.linkId).not.toBe("pa");
  });
});

describe("nudge, relink and disable", () => {
  it("nudges by frames", () => {
    expect(at(nudgeClips(doc(), ["c"], 1), "c")?.start).toBe(5033);
    expect(at(nudgeClips(doc(), ["c"], -10), "c")?.start).toBe(4667);
  });

  it("relinks clips that share the asset and the start", () => {
    const d = doc();
    d.tracks[2].clips[0] = clip("as", 0, 2000, "audio", { assetId: "m-a" });
    d.tracks[0].clips[0] = clip("a", 0, 2000, "video");
    const relinked = relinkClips(d, ["a"]);
    expect(linkGroup(relinked, "a").sort()).toEqual(["a", "as"]);
  });

  it("toggles clips off and on", () => {
    const off = toggleDisabled(doc(), ["b", "c"]);
    expect(findClip(off, "b")?.clip.disabled).toBe(true);
    expect(documentIssue("video", off)).toBeNull();
    expect(findClip(toggleDisabled(off, ["b"]), "b")?.clip.disabled).toBeUndefined();
  });
});
