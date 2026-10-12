import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import { laneTargets, moveGroup, overwriteGroup } from "./edits";
import { findClip } from "./timeline";

function clip(id: string, startMs: number, type: "video" | "image" | "audio" = "image", extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip(type, `m-${id}`, startMs, 1000), id, ...extra };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [clip("a", 0, "video", { linkId: "k1" }), clip("b", 3000)] },
    { id: "v2", kind: "visual", clips: [clip("c", 1000)] },
    { id: "v3", kind: "visual", clips: [] },
    { id: "a1", kind: "audio", clips: [clip("as", 0, "audio", { linkId: "k1" })] },
  ];
  d.durationMs = 4000;
  return d;
}

function trackOf(d: VideoDocument, id: string): string | undefined {
  return findClip(d, id)?.track.id;
}

describe("laneTargets", () => {
  it("moves every selected clip of the dragged kind by the same number of lanes", () => {
    const lanes = laneTargets(doc(), "a", ["a", "c", "as"], "v2");
    expect(Object.fromEntries(lanes)).toEqual({ a: "v2", c: "v3", as: "a1" });
  });

  it("stops at the last lane so no clip leaves the timeline", () => {
    const lanes = laneTargets(doc(), "a", ["a", "c"], "v3");
    expect(Object.fromEntries(lanes)).toEqual({ a: "v2", c: "v3" });
  });

  it("keeps every clip on its lane when the hovered lane cannot take the dragged clip", () => {
    const d = doc();
    d.tracks[1].locked = true;
    expect(Object.fromEntries(laneTargets(d, "a", ["a", "c"], "v2"))).toEqual({ a: "v1", c: "v2" });
    expect(Object.fromEntries(laneTargets(doc(), "a", ["a", "c"], "a1"))).toEqual({ a: "v1", c: "v2" });
  });
});

describe("moving several clips to other lanes", () => {
  it("takes the whole selection up together", () => {
    const next = moveGroup(doc(), "b", ["b", "c"], "v2", 3000);
    expect(trackOf(next, "b")).toBe("v2");
    expect(trackOf(next, "c")).toBe("v3");
  });

  it("keeps the time move when a target lane is busy", () => {
    const d = doc();
    d.tracks[2].clips = [clip("x", 1000)];
    const next = moveGroup(d, "b", ["b", "c"], "v2", 3500);
    expect(trackOf(next, "b")).toBe("v1");
    expect(trackOf(next, "c")).toBe("v2");
    expect(findClip(next, "b")?.clip.startMs).toBe(3500);
    expect(findClip(next, "c")?.clip.startMs).toBe(1500);
  });

  it("overwrites on every target lane", () => {
    const d = doc();
    d.tracks[2].clips = [clip("x", 1000)];
    const next = overwriteGroup(d, "b", ["b", "c"], "v2", 3000);
    expect(trackOf(next, "c")).toBe("v3");
    expect(findClip(next, "x")).toBeNull();
  });
});
