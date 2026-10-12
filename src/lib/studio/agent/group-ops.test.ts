import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "../document";
import { isGroupClip, timelineAt } from "../group-scope";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { videoOutline, type OutlineContext } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "m-a", 0, 2000), id: "a", linkId: "k1" }, { ...newMediaClip("image", "m-b", 2000, 2000), id: "b" }] },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "m-s", 0, 2000), id: "s", linkId: "k1" }] },
  ];
  d.durationMs = 4000;
  return d;
}

const ctx: VideoOpContext = {
  playheadMs: 2500,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => 10_000,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
};

function run(ops: VideoOperation[], base: VideoDocument = doc()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS, videoIds);
}

const outlineCtx: OutlineContext = { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] };

describe("group operations for Elo", () => {
  it("groups by ref, edits inside by group_id and by inner ids, and reads the nested outline", () => {
    const plan = run([
      { op: "group_clips", ref: "g", clip_ids: ["a", "b"], name: "Abertura" },
      { op: "update_clip", group_id: "@g", clip_id: "b", volume: 0.5 },
      { op: "move_clip", clip_id: "b", start_ms: 2500 },
      { op: "update_clip", clip_id: "@g", blur: 4 },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(documentIssue("video", plan.final)).toBeNull();
    const groupId = plan.created.g[0];
    const group = findClip(plan.final, groupId)!.clip;
    expect(isGroupClip(group) && group.name).toBe("Abertura");
    expect(group.blur).toBe(4);
    const inner = timelineAt(plan.final, [groupId])!;
    expect(findClip(inner, "b")?.clip).toMatchObject({ volume: 0.5, startMs: 2500 });
    expect(findClip(inner, "s")).not.toBeNull();
    expect(plan.notes.some((note) => note.includes("s"))).toBe(true);
    const outline = videoOutline(plan.final, outlineCtx);
    const shown = outline.tracks.flatMap((track) => track.clips).find((clip) => clip.id === groupId)!;
    expect(shown.group?.name).toBe("Abertura");
    expect(shown.group?.tracks.flatMap((track) => track.clips.map((clip) => clip.id)).sort()).toEqual(["a", "b", "s"]);
  });

  it("refuses ids from two timelines, unknown groups and a refused grouping with the reason", () => {
    const grouped = run([{ op: "group_clips", clip_ids: ["b"] }]);
    if (!grouped.ok) throw new Error(grouped.reason);
    const mixed = run([{ op: "link_clips", clip_ids: ["a", "b"] }], grouped.final);
    expect(mixed.ok).toBe(false);
    if (!mixed.ok) expect(mixed.reason).toContain("linhas do tempo diferentes");
    const unknown = run([{ op: "update_clip", group_id: "nope", clip_id: "b", volume: 1 }], grouped.final);
    expect(unknown.ok).toBe(false);
    const locked = doc();
    locked.tracks[0].locked = true;
    const refused = run([{ op: "group_clips", clip_ids: ["b"] }], locked);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toContain("travadas");
  });

  it("ungroups back and names what it cannot carry", () => {
    const plan = run([{ op: "group_clips", ref: "g", clip_ids: ["b"] }, { op: "update_clip", clip_id: "@g", fade_in_ms: 300 }, { op: "ungroup_clips", clip_id: "@g" }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("os fades");
    const back = run([{ op: "group_clips", ref: "g", clip_ids: ["b"] }, { op: "ungroup_clips", clip_id: "@g" }]);
    expect(back.ok).toBe(true);
    if (back.ok) expect(findClip(back.final, "b")!.clip.startMs).toBe(2000);
  });
});
