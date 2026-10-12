import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import { findClip } from "./timeline";
import { moveToPlayhead, playheadTargets, sequenceClips, staggerClips, trimToPlayhead } from "./timing-edits";
import { documentIssue } from "./validate";

function clip(id: string, startMs: number, durationMs: number, type: "video" | "image" | "audio" = "image", extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip(type, `m-${id}`, startMs, durationMs), id, ...extra };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [clip("a", 0, 1000, "video", { linkId: "k1" }), clip("b", 5000, 1000)] },
    { id: "v2", kind: "visual", clips: [clip("c", 200, 2000)] },
    { id: "v3", kind: "visual", clips: [clip("d", 0, 500)] },
    { id: "a1", kind: "audio", clips: [clip("as", 0, 1000, "audio", { linkId: "k1" })] },
  ];
  d.durationMs = 6000;
  return d;
}

function starts(d: VideoDocument, ...ids: string[]): (number | undefined)[] {
  return ids.map((id) => findClip(d, id)?.clip.startMs);
}

function placed(result: { ok: boolean; document?: VideoDocument }): VideoDocument {
  if (!result.ok || !result.document) throw new Error(`refused: ${JSON.stringify(result)}`);
  expect(documentIssue("video", result.document)).toBeNull();
  return result.document;
}

describe("sequenceClips", () => {
  it("places the clips end to end in the given order, linked sound along", () => {
    const next = placed(sequenceClips(doc(), ["a", "c", "d"], {}));
    expect(starts(next, "a", "as", "c", "d")).toEqual([0, 0, 1000, 3000]);
  });

  it("leaves a gap or overlaps clips on different tracks", () => {
    expect(starts(placed(sequenceClips(doc(), ["d", "c"], { gapMs: 300 })), "d", "c")).toEqual([0, 800]);
    expect(starts(placed(sequenceClips(doc(), ["c", "d"], { gapMs: -500 })), "c", "d")).toEqual([200, 1700]);
  });

  it("refuses an overlap on one track and names the clip in the way", () => {
    expect(sequenceClips(doc(), ["b", "a"], { gapMs: -200 })).toEqual({ ok: false, reason: "blocked", clipId: "a", blockerId: "b" });
    const d = doc();
    d.tracks[1].clips.push(clip("x", 2500, 500));
    expect(sequenceClips(d, ["a", "c"], {})).toEqual({ ok: false, reason: "blocked", clipId: "c", blockerId: "x" });
  });

  it("adds a transition on each new cut between touching clips of one track", () => {
    const d = doc();
    d.tracks[0].clips[1] = clip("b", 4000, 1000);
    const result = sequenceClips(d, ["a", "b"], { transition: { kind: "dissolve", durationMs: 400 } });
    const next = placed(result);
    expect(starts(next, "b")).toEqual([1000]);
    expect(next.tracks[0].transitions).toHaveLength(1);
    expect(next.tracks[0].transitions![0]).toMatchObject({ fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 400 });
    expect(result.ok && result.transitions).toHaveLength(1);
    expect(sequenceClips(doc(), ["c", "d"], { transition: { kind: "dissolve" } })).toEqual({ ok: false, reason: "apart" });
  });

  it("needs two clips, unlocked tracks and a start inside the film", () => {
    expect(sequenceClips(doc(), ["a"], {})).toEqual({ ok: false, reason: "tooFew" });
    const d = doc();
    d.tracks[1].locked = true;
    expect(sequenceClips(d, ["a", "c"], {})).toEqual({ ok: false, reason: "locked", clipId: "c" });
    expect(sequenceClips(doc(), ["a", "zz"], {})).toEqual({ ok: false, reason: "missing", clipId: "zz" });
    expect(sequenceClips(doc(), ["d", "c"], { gapMs: -2000 })).toEqual({ ok: false, reason: "range", clipId: "c" });
  });
});

describe("staggerClips", () => {
  it("starts each clip one step after the previous, from the first one", () => {
    const d = doc();
    d.tracks[2].clips.push(clip("e", 3000, 500));
    const next = placed(staggerClips(d, ["d", "c", "e"], 250));
    expect(starts(next, "d", "c", "e")).toEqual([0, 250, 500]);
  });

  it("refuses when a step makes clips meet on one track", () => {
    expect(staggerClips(doc(), ["a", "b"], 300)).toEqual({ ok: false, reason: "blocked", clipId: "b", blockerId: "a" });
  });
});

describe("playheadTargets", () => {
  it("uses the selected clips under the playhead, or every clip under it when nothing is selected", () => {
    expect(playheadTargets(doc(), ["a", "c", "b"], 600)).toEqual(["a", "c"]);
    expect(playheadTargets(doc(), [], 300)).toEqual(["a", "c", "d", "as"]);
    const d = doc();
    d.tracks[2].locked = true;
    expect(playheadTargets(d, [], 300)).toEqual(["a", "c", "as"]);
  });
});

describe("trimToPlayhead", () => {
  const source = () => 10_000;

  it("trims the start or the end of each clip to the playhead, with its linked sound", () => {
    const next = placed(trimToPlayhead(doc(), ["a", "c"], "start", 600, source, { ripple: false, linked: true }));
    expect(starts(next, "a", "as", "c")).toEqual([600, 600, 600]);
    const ended = placed(trimToPlayhead(doc(), ["c"], "end", 1200, source, { ripple: false, linked: true }));
    expect(findClip(ended, "c")?.clip.durationMs).toBe(1000);
  });

  it("closes the gap when rippling", () => {
    const next = placed(trimToPlayhead(doc(), ["a"], "start", 400, source, { ripple: true, linked: true }));
    expect(findClip(next, "a")?.clip).toMatchObject({ startMs: 0, durationMs: 600 });
  });

  it("refuses when no clip sits under the playhead", () => {
    expect(trimToPlayhead(doc(), ["b"], "start", 600, source, { ripple: false, linked: true })).toEqual({ ok: false, reason: "noClip" });
  });
});

describe("moveToPlayhead", () => {
  it("moves the start or the end of each clip to the playhead", () => {
    expect(starts(placed(moveToPlayhead(doc(), ["b"], "start", 3000)), "b")).toEqual([3000]);
    expect(starts(placed(moveToPlayhead(doc(), ["a"], "end", 2500)), "a", "as")).toEqual([1500, 1500]);
  });

  it("refuses a move that would leave the film or hit a clip", () => {
    expect(moveToPlayhead(doc(), ["c"], "end", 1000)).toEqual({ ok: false, reason: "range", clipId: "c" });
    expect(moveToPlayhead(doc(), ["b"], "start", 500)).toEqual({ ok: false, reason: "blocked", clipId: "b", blockerId: "a" });
  });
});
