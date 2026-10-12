import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, NULL_BOX, type Clip, type VideoDocument } from "./document";
import { freshClip } from "./clip-copy";
import { groupClips, groupFamily, ungroupClip } from "./group-edits";
import { commonPath, groupContentMs, groupTimeline, insidePath, isGroupClip, pathMsAt, rootMsAt, timelineAt, validPath, withTimelineAt, type GroupClip } from "./group-scope";
import { clipLookup, worldPlacementAt } from "./parenting";
import { findClip, splitClip, updateClip } from "./timeline";
import { documentIssue } from "./validate";

function media(id: string, startMs: number, durationMs: number, type: "video" | "image" | "audio" = "video", extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip(type, `m-${id}`, startMs, durationMs), id, ...extra };
}

function text(id: string, startMs: number, durationMs: number): Clip {
  return { ...newOverlayClip(newTextLayer("Oi"), startMs, durationMs), id };
}

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [media("a", 0, 2000), media("b", 2000, 2000)] },
    { id: "v2", kind: "visual", clips: [text("t", 500, 1000)] },
    { id: "au", kind: "audio", clips: [media("s", 0, 3000, "audio")] },
  ];
  d.durationMs = 4000;
  return d;
}

function grouped(doc: VideoDocument, ids: string[], name?: string): { document: VideoDocument; group: GroupClip } {
  const result = groupClips(doc, ids, name);
  if (!result.ok) throw new Error(result.reason);
  const found = findClip(result.document, result.groupId)!;
  return { document: result.document, group: found.clip as GroupClip };
}

describe("group clips", () => {
  it("moves the chosen clips into one group that keeps their relative timing", () => {
    const { document, group } = grouped(film(), ["b", "t"], "Abertura");
    expect(documentIssue("video", document)).toBeNull();
    expect(group).toMatchObject({ type: "group", startMs: 500, durationMs: 3500, trimInMs: 0, name: "Abertura" });
    const inner = group.tracks.flatMap((track) => track.clips.map((clip) => [clip.id, clip.startMs]));
    expect(inner).toEqual([["b", 1500], ["t", 0]]);
    expect(findClip(document, "b")).toBeNull();
    expect(findClip(document, "a")).not.toBeNull();
    expect(groupContentMs(group)).toBe(3500);
  });

  it("brings linked partners and parenting families along", () => {
    const d = film();
    d.tracks[0].clips[0].linkId = "k1";
    d.tracks[2].clips[0].linkId = "k1";
    d.tracks[1].clips[0].parentId = "b";
    expect(groupFamily(d, ["a"]).sort()).toEqual(["a", "s"]);
    expect(groupFamily(d, ["t"]).sort()).toEqual(["b", "t"]);
    const { group } = grouped(d, ["a"]);
    expect(group.tracks.map((track) => track.kind)).toEqual(["visual", "audio"]);
  });

  it("refuses a selection whose stacking would change", () => {
    const d = film();
    d.tracks.push({ id: "v3", kind: "visual", clips: [media("top", 0, 4000, "image")] });
    const result = groupClips(d, ["a", "top"]);
    expect(result).toMatchObject({ ok: false, reason: "interleaved", clipIds: ["t"] });
  });

  it("refuses a blended clip that would stop seeing the clips below it", () => {
    const d = film();
    d.tracks[1].clips[0].layer = { ...d.tracks[1].clips[0].layer!, blendMode: "multiply" };
    expect(groupClips(d, ["t"])).toMatchObject({ ok: false, reason: "seesThrough" });
  });

  it("refuses a cut transition that would cross the group edge", () => {
    const d = film();
    d.tracks[0].transitions = [{ id: "tr1", fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 400, alignment: "center", easing: "linear" }];
    expect(groupClips(d, ["b"])).toMatchObject({ ok: false, reason: "transitionCut" });
    const { group, document } = grouped(d, ["a", "b"]);
    expect(group.tracks[0].transitions?.map((transition) => transition.id)).toEqual(["tr1"]);
    expect(documentIssue("video", document)).toBeNull();
  });

  it("refuses ducking that would lose its trigger", () => {
    const d = film();
    d.tracks.push({ id: "vo", kind: "audio", clips: [media("voz", 0, 1000, "audio")] });
    d.tracks[2].ducking = { triggerTrackIds: ["vo"], reduceDb: 12, attackMs: 100, releaseMs: 300, holdMs: 0, sensitivity: 0.5 };
    expect(groupClips(d, ["a", "s"])).toMatchObject({ ok: false, reason: "ducking" });
    const whole = grouped(d, ["a", "s", "voz"]);
    expect(documentIssue("video", whole.document)).toBeNull();
    const ducked = whole.group.tracks.find((track) => track.ducking)!;
    expect(whole.group.tracks.map((track) => track.id)).toContain(ducked.ducking!.triggerTrackIds[0]);
  });

  it("refuses locked clips and a selection with nothing to see", () => {
    const d = film();
    d.tracks[1].locked = true;
    expect(groupClips(d, ["t"])).toMatchObject({ ok: false, reason: "locked" });
    expect(groupClips(film(), ["s"])).toMatchObject({ ok: false, reason: "nothingVisible" });
    expect(groupClips(film(), ["nope"])).toMatchObject({ ok: false, reason: "missing" });
  });
});

describe("group scope", () => {
  it("reads and writes the inner timeline, nested at any depth", () => {
    const first = grouped(film(), ["a", "b"]);
    const second = grouped(first.document, [first.group.id, "t"]);
    const path = insidePath(second.document, first.group.id)!;
    expect(path).toEqual([second.group.id, first.group.id]);
    expect(commonPath(second.document, ["a", "b"])).toEqual(path);
    expect(commonPath(second.document, ["a", "t"])).toBeNull();
    const inner = timelineAt(second.document, path)!;
    expect(inner.tracks.flatMap((track) => track.clips.map((clip) => clip.id))).toEqual(["a", "b"]);
    const edited = withTimelineAt(second.document, path, (timeline) => updateClip(timeline, "a", { volume: 0.5 }));
    expect(documentIssue("video", edited)).toBeNull();
    expect(timelineAt(edited, path)!.tracks[0].clips[0].volume).toBe(0.5);
    expect(withTimelineAt(second.document, path, (timeline) => timeline)).toBe(second.document);
    expect(validPath(edited, [second.group.id, "gone"])).toEqual([second.group.id]);
  });

  it("maps time through the group trim and speed", () => {
    const { document, group } = grouped(film(), ["b"]);
    const moved = updateClip(document, group.id, { speed: 2 } as Parameters<typeof updateClip>[2]);
    const placed = findClip(moved, group.id)!.clip as GroupClip;
    expect(pathMsAt(moved, [placed.id], 2500)).toBe(1000);
    expect(rootMsAt(moved, [placed.id], 1000)).toBe(2500);
  });

  it("shows the film markers that fall inside the group and writes edits back", () => {
    const { document, group } = grouped(film(), ["b"]);
    const marked: VideoDocument = { ...document, markers: [{ id: "m1", atMs: 3000 }, { id: "m2", atMs: 100 }] };
    const view = groupTimeline(marked, group);
    expect(view.markers).toEqual([{ id: "m1", atMs: 1000 }]);
    const edited = withTimelineAt(marked, [group.id], (timeline) => ({ ...timeline, markers: [{ id: "m1", atMs: 1500 }, { id: "m3", atMs: 0 }] }));
    expect(edited.markers).toEqual([{ id: "m2", atMs: 100 }, { id: "m3", atMs: 2000 }, { id: "m1", atMs: 3500 }]);
  });

  it("copies a group with fresh ids all the way down", () => {
    const { group } = grouped(film(), ["b", "t"]);
    const copy = freshClip(group);
    const ids = (clip: Clip): string[] => [clip.id, ...(clip.tracks ?? []).flatMap((track) => [track.id, ...track.clips.flatMap(ids)])];
    const before = new Set(ids(group));
    expect(ids(copy).some((id) => before.has(id))).toBe(false);
  });

  it("splits a group into two groups that never share ids", () => {
    const { document, group } = grouped(film(), ["b", "t"]);
    const result = splitClip(document, group.id, 2000);
    expect(result.clipId).not.toBeNull();
    expect(documentIssue("video", result.document)).toBeNull();
    const right = findClip(result.document, result.clipId!)!.clip;
    expect(isGroupClip(right) && right.trimInMs).toBe(1500);
  });
});

describe("group validation", () => {
  it("refuses fields a group does not take and inner duplicates", () => {
    const { document, group } = grouped(film(), ["b"]);
    const withKey = updateClip(document, group.id, { chromaKey: { color: "#00ff00", similarity: 0.4, smoothness: 0.1, spill: 0.1 } });
    expect(documentIssue("video", withKey)).toMatchObject({ code: "invalid" });
    const duplicated = withTimelineAt(document, [group.id], (timeline) => ({ ...timeline, tracks: [{ ...timeline.tracks[0], clips: [{ ...timeline.tracks[0].clips[0], id: "a" }] }] }));
    expect(documentIssue("video", duplicated)).toMatchObject({ code: "invalid" });
    const named = updateClip(film(), "a", { name: "   " });
    expect(documentIssue("video", named)).toMatchObject({ code: "invalid" });
  });

  it("refuses a parent across the group edge", () => {
    const { document, group } = grouped(film(), ["b"]);
    const crossing = withTimelineAt(document, [group.id], (timeline) => updateClip(timeline, "b", { parentId: "a" }));
    expect(crossing).not.toBe(document);
    expect(documentIssue("video", crossing)).toMatchObject({ code: "invalid" });
  });
});

describe("ungroup", () => {
  it("puts the content back at the same moments and on the same stacking", () => {
    const original = film();
    const { document, group } = grouped(original, ["b", "t"]);
    const result = ungroupClip(document, group.id);
    if (!result.ok) throw new Error(result.reason);
    expect(documentIssue("video", result.document)).toBeNull();
    expect(result.nullId).toBeNull();
    expect(findClip(result.document, "b")!.clip.startMs).toBe(2000);
    expect(findClip(result.document, "t")!.clip.startMs).toBe(500);
    const order = result.document.tracks.map((track) => track.clips.map((clip) => clip.id));
    expect(order.findIndex((ids) => ids.includes("t"))).toBeGreaterThan(order.findIndex((ids) => ids.includes("b")));
  });

  it("cuts the content to the trimmed window", () => {
    const { document, group } = grouped(film(), ["b", "t"]);
    const trimmed = updateClip(document, group.id, {});
    const windowed = withTimelineAt(trimmed, [], (timeline) => ({ ...timeline, tracks: timeline.tracks.map((track) => ({ ...track, clips: track.clips.map((clip) => (clip.id === group.id ? { ...clip, startMs: 1000, trimInMs: 500, durationMs: 1500 } : clip)) })) }));
    const result = ungroupClip(windowed, group.id);
    if (!result.ok) throw new Error(result.reason);
    const t = findClip(result.document, "t")!.clip;
    expect([t.startMs, t.durationMs]).toEqual([1000, 500]);
    const b = findClip(result.document, "b")!.clip;
    expect([b.startMs, b.durationMs]).toEqual([2000, 500]);
  });

  it("hands the group motion to a null so every child lands on the same pixels", () => {
    const { document, group } = grouped(film(), ["b", "t"]);
    const moved = updateClip(document, group.id, { transform: { x: 0.4, y: 0.6, w: 0.5, h: 0.5, rotation: 30, opacity: 1 }, keyframes: { rotation: [{ atMs: 0, value: 30, easing: "linear" }, { atMs: 3000, value: 90, easing: "linear" }] } });
    const result = ungroupClip(moved, group.id);
    if (!result.ok) throw new Error(result.reason);
    expect(documentIssue("video", result.document)).toBeNull();
    const holder = findClip(result.document, result.nullId!)!.clip;
    expect(holder.transform.w).toBeCloseTo(0.5 * NULL_BOX);
    const t = findClip(result.document, "t")!.clip;
    expect(t.parentId).toBe(holder.id);
    const lookup = clipLookup(result.document);
    const world = worldPlacementAt(lookup, t, 500, 9 / 16);
    expect(world.rotation).toBeCloseTo(t.transform.rotation + 40, 6);
    expect(world.w).toBeCloseTo(t.transform.w * 0.5, 9);
  });

  it("refuses what it cannot carry and names it", () => {
    const { document, group } = grouped(film(), ["b"]);
    const faded = updateClip(document, group.id, { fadeInMs: 200, masks: [], blendMode: "screen", transform: { ...group.transform, opacity: 0.5 } });
    expect(ungroupClip(faded, group.id)).toMatchObject({ ok: false, reason: "keeps", properties: ["opacity", "fades", "blend"] });
    const fast = updateClip(document, group.id, { speed: 2 } as Parameters<typeof updateClip>[2]);
    expect(ungroupClip(fast, group.id)).toMatchObject({ ok: false, reason: "keeps", properties: ["speed"] });
  });

  it("round trips group then ungroup to the same film", () => {
    const original = film();
    const { document, group } = grouped(original, ["a", "b", "t", "s"]);
    const result = ungroupClip(document, group.id);
    if (!result.ok) throw new Error(result.reason);
    const timing = (d: VideoDocument) => d.tracks.flatMap((track) => track.clips.map((clip) => [clip.id, track.kind, clip.startMs, clip.durationMs])).sort();
    expect(timing(result.document)).toEqual(timing(original));
  });
});

describe("the group contract", () => {
  it("accepts the shared fixture", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_group.json"), "utf8")) as VideoDocument;
    expect(documentIssue("video", raw)).toBeNull();
    const nested = timelineAt(raw, ["intro", "logo"])!;
    expect(nested.tracks[0].clips[0].id).toBe("logo-mark");
  });

  it("refuses the shared fixture once a group breaks a rule", () => {
    const raw = (): VideoDocument => JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_group.json"), "utf8"));
    const intro = (doc: VideoDocument) => doc.tracks[1].clips[0];
    const cases: ((doc: VideoDocument) => void)[] = [
      (doc) => void (intro(doc).reverse = true),
      (doc) => void (intro(doc).preservePitch = false),
      (doc) => void (intro(doc).assetId = "m-1"),
      (doc) => void (intro(doc).fit = "cover"),
      (doc) => void (intro(doc).chromaKey = { color: "#00ff00", similarity: 0.4, smoothness: 0.1, spill: 0.1 }),
      (doc) => void (intro(doc).name = " "),
      (doc) => void (intro(doc).tracks![0].clips[0].id = "backdrop"),
      (doc) => void (intro(doc).tracks![2].clips[0].parentId = "rig"),
      (doc) => void (intro(doc).tracks![5].ducking!.triggerTrackIds = ["base"]),
      (doc) => void (doc.tracks[0].clips[0].tracks = intro(doc).tracks),
      (doc) => void doc.tracks.push({ id: "sound", kind: "audio", clips: [{ ...intro(doc), id: "g2" }] }),
    ];
    for (const change of cases) {
      const doc = raw();
      change(doc);
      expect(documentIssue("video", doc), change.toString()).not.toBeNull();
    }
  });
});
