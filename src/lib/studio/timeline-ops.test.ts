import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import { findClip, insertCaptionTrack, moveClipsBy, moveClipToward, placeClip, placeClips, replaceClipAsset, setClipTrimIn, snapCandidates, splitClip, trimClipEnd, updateClip } from "./timeline";
import { documentIssue } from "./validate";

function clip(id: string, startMs: number, durationMs: number, type: "video" | "image" | "audio" = "video"): Clip {
  return { ...newMediaClip(type, `m-${id}`, startMs, durationMs), id };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [clip("a", 0, 2000), clip("b", 3000, 2000)] },
    { id: "v2", kind: "visual", clips: [] },
    { id: "au", kind: "audio", clips: [clip("m", 0, 5000, "audio")] },
  ];
  d.durationMs = 5000;
  return d;
}

describe("placeClip", () => {
  it("puts media on the lowest free compatible track", () => {
    const placed = placeClip(doc(), clip("n", 500, 1000));
    expect(placed.trackId).toBe("v2");
    expect(findClip(placed.document, "n")?.clip.startMs).toBe(500);
    expect(documentIssue("video", placed.document)).toBeNull();
  });

  it("puts overlays on the top free visual track", () => {
    const overlay = { ...newOverlayClip(newTextLayer("Oi"), 0, 1000), id: "o" };
    const d = doc();
    d.tracks[1].clips = [clip("z", 4000, 500)];
    expect(placeClip(d, overlay).trackId).toBe("v2");
  });

  it("prefers the requested track when it is free", () => {
    expect(placeClip(doc(), clip("n", 2000, 1000), { preferTrackId: "v1" }).trackId).toBe("v1");
    expect(placeClip(doc(), clip("n", 2000, 1000)).trackId).toBe("v1");
  });

  it("adds a track when every compatible track is busy", () => {
    const placed = placeClip(doc(), clip("x", 1000, 1000, "audio"));
    expect(placed.trackId).not.toBeNull();
    expect(placed.document.tracks).toHaveLength(4);
    expect(placed.document.tracks[3]).toMatchObject({ kind: "audio", clips: [{ id: "x" }] });
  });

  it("shortens a clip that would pass the limit and refuses one too short", () => {
    const placed = placeClip(doc(), clip("n", STUDIO_LIMITS.maxVideoMs - 1000, 5000));
    expect(findClip(placed.document, "n")?.clip.durationMs).toBe(1000);
    const refused = placeClip(doc(), clip("t", STUDIO_LIMITS.maxVideoMs - 50, 5000));
    expect(refused.clipId).toBeNull();
  });

  it("opens a new track when every track is locked, however many there are", () => {
    const d = doc();
    d.tracks[0].locked = true;
    d.tracks[1].locked = true;
    for (let i = 0; i < 30; i++) d.tracks.push({ id: `t${i}`, kind: "visual", locked: true, clips: [] });
    const placed = placeClip(d, clip("n", 0, 1000));
    expect(placed.clipId).not.toBeNull();
    expect(placed.document.tracks.length).toBe(d.tracks.length + 1);
    expect(documentIssue("video", placed.document)).toBeNull();
  });
});

describe("placeClips", () => {
  it("places linked clips together or not at all", () => {
    const placed = placeClips(doc(), [clip("v", 6000, 1000), clip("s", 6000, 1000, "audio")], "v1");
    expect(placed?.ids).toEqual(["v", "s"]);
    expect(findClip(placed!.document, "v")?.track.id).toBe("v1");
    expect(findClip(placed!.document, "s")?.track.id).toBe("au");
    expect(placeClips(doc(), [clip("v", 6000, 1000), clip("tiny", STUDIO_LIMITS.maxVideoMs - 10, 1000, "audio")])).toBeNull();
  });
});

describe("moveClipsBy", () => {
  it("moves every selected clip by the same delta", () => {
    const moved = moveClipsBy(doc(), ["b", "m"], 1000);
    expect(findClip(moved, "b")?.clip.startMs).toBe(4000);
    expect(findClip(moved, "m")?.clip.startMs).toBe(1000);
    expect(moved.durationMs).toBe(6000);
  });

  it("clamps at zero and refuses collisions", () => {
    const d = doc();
    expect(moveClipsBy(d, ["a", "b"], -500)).toBe(d);
    expect(findClip(moveClipsBy(d, ["b"], -1000), "b")?.clip.startMs).toBe(2000);
    expect(moveClipsBy(d, ["a"], 1500)).toBe(d);
    expect(moveClipsBy(d, ["b"], -9000)).toBe(d);
  });

  it("refuses locked tracks", () => {
    const d = doc();
    d.tracks[0].locked = true;
    expect(moveClipsBy(d, ["b"], 500)).toBe(d);
  });
});

describe("setClipTrimIn", () => {
  it("moves the source window within the source length", () => {
    const d = doc();
    expect(findClip(setClipTrimIn(d, "a", 800, 10_000), "a")?.clip.trimInMs).toBe(800);
    expect(findClip(setClipTrimIn(d, "a", 9500, 10_000), "a")?.clip.trimInMs).toBe(8000);
    expect(setClipTrimIn(d, "a", -5)).toBe(d);
  });

  it("ignores clips without source time", () => {
    const d = doc();
    d.tracks[1].clips = [clip("i", 0, 1000, "image")];
    expect(setClipTrimIn(d, "i", 500)).toBe(d);
  });
});

describe("replaceClipAsset", () => {
  it("swaps the media of a clip and keeps its timing", () => {
    const replaced = replaceClipAsset(doc(), "m", "clean");
    expect(findClip(replaced, "m")?.clip).toMatchObject({ assetId: "clean", startMs: 0, durationMs: 5000 });
    const d = doc();
    expect(replaceClipAsset(d, "m", " ")).toBe(d);
  });
});

describe("insertCaptionTrack", () => {
  const make = (cue: { text: string }) => newOverlayClip(newTextLayer(cue.text), 0, 1000);

  it("adds a top track with one overlay per cue without overlaps", () => {
    const cues = [
      { startMs: 0, endMs: 1500, text: "Um" },
      { startMs: 1200, endMs: 2500, text: "Dois" },
      { startMs: 2500, endMs: 2550, text: "curto" },
    ];
    const result = insertCaptionTrack(doc(), cues, make, "Legendas");
    expect(result.trackId).not.toBeNull();
    const track = result.document.tracks.at(-1)!;
    expect(track).toMatchObject({ id: result.trackId, kind: "visual", name: "Legendas" });
    expect(track.clips.map((c) => [c.layer?.text, c.startMs, c.durationMs])).toEqual([
      ["Um", 0, 1500],
      ["Dois", 1500, 1000],
    ]);
    expect(documentIssue("video", result.document)).toBeNull();
  });

  it("refuses only when there are no cues, taking as many as the speech has", () => {
    const d = doc();
    expect(insertCaptionTrack(d, [], make).document).toBe(d);
    const many = Array.from({ length: 300 }, (_, i) => ({ startMs: i * 200, endMs: i * 200 + 150, text: `${i}` }));
    const result = insertCaptionTrack(d, many, make);
    expect(result.document.tracks.find((t) => t.id === result.trackId)?.clips).toHaveLength(300);
    expect(documentIssue("video", result.document)).toBeNull();
  });
});

describe("moveClipToward", () => {
  it("moves onto the hovered track when it takes the clip", () => {
    expect(findClip(moveClipToward(doc(), "a", "v2", 300), "a")).toMatchObject({ track: { id: "v2" }, clip: { startMs: 300 } });
  });

  it("stays on its own track over an incompatible or locked lane", () => {
    const d = doc();
    expect(findClip(moveClipToward(d, "b", "au", 6000), "b")).toMatchObject({ track: { id: "v1" }, clip: { startMs: 6000 } });
    const locked = doc();
    locked.tracks[1].locked = true;
    expect(findClip(moveClipToward(locked, "b", "v2", 6000), "b")?.track.id).toBe("v1");
    expect(findClip(moveClipToward(d, "b", null, 6000), "b")?.track.id).toBe("v1");
  });
});

describe("motions follow the clip edits", () => {
  function moving(): VideoDocument {
    const d = doc();
    d.tracks[0].clips[0] = { ...d.tracks[0].clips[0], motionIn: { edge: "left", durationMs: 800 }, motionOut: { edge: "top", durationMs: 800 } };
    return d;
  }

  it("keeps the entrance on the left half and the exit on the right half of a split", () => {
    const { document, clipId } = splitClip(moving(), "a", 1000);
    expect(findClip(document, "a")?.clip).toMatchObject({ motionIn: { edge: "left", durationMs: 800 } });
    expect(findClip(document, "a")?.clip.motionOut).toBeUndefined();
    expect(findClip(document, clipId!)?.clip.motionIn).toBeUndefined();
    expect(findClip(document, clipId!)?.clip.motionOut).toEqual({ edge: "top", durationMs: 800 });
    expect(documentIssue("video", document)).toBeNull();
  });

  it("shortens or drops motions that no longer fit after a trim", () => {
    const trimmed = trimClipEnd(moving(), "a", 1200);
    const clip = findClip(trimmed, "a")!.clip;
    expect(clip.motionIn?.durationMs).toBe(800);
    expect(clip.motionOut?.durationMs).toBe(400);
    expect(documentIssue("video", trimmed)).toBeNull();
    const tiny = trimClipEnd(moving(), "a", 600);
    expect(findClip(tiny, "a")!.clip.motionIn?.durationMs).toBe(600);
    expect(findClip(tiny, "a")!.clip.motionOut).toBeUndefined();
  });

  it("applies motion patches", () => {
    const patched = updateClip(doc(), "a", { motionIn: { edge: "bottom", durationMs: 500 } });
    expect(findClip(patched, "a")?.clip.motionIn).toEqual({ edge: "bottom", durationMs: 500 });
    const cleared = updateClip(patched, "a", { motionIn: undefined });
    expect(findClip(cleared, "a")?.clip.motionIn).toBeUndefined();
  });
});

describe("markers snap", () => {
  it("offers markers as snap points", () => {
    const d = doc();
    d.markers = [{ id: "m1", atMs: 4200 }];
    expect(snapCandidates(d)).toContain(4200);
  });
});
