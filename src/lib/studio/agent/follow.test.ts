import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "../document";
import { FOLLOW_LEAD_MS, followTime, glidePosition } from "./follow";

function film(): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "a", 4000, 3000), id: "clip" }, { ...newMediaClip("image", "b", 9000, 400), id: "short" }] }];
  doc.durationMs = 10_000;
  return doc;
}

describe("following Elo on the timeline", () => {
  it("goes just inside the clip she works on, unless the playhead is already there", () => {
    expect(followTime({ kind: "clip", clipId: "clip" }, film(), 0)).toBe(4000 + FOLLOW_LEAD_MS);
    expect(followTime({ kind: "clip", clipId: "clip" }, film(), 5000)).toBeNull();
    expect(followTime({ kind: "clip", clipId: "short" }, film(), 0)).toBe(9200);
    expect(followTime({ kind: "clip", clipId: "gone" }, film(), 0)).toBeNull();
  });

  it("goes to the time she points at and ignores places off the timeline", () => {
    expect(followTime({ kind: "time", atMs: 2500 }, film(), 0)).toBe(2500);
    expect(followTime({ kind: "track", trackId: "v1", atMs: 1200 }, film(), 0)).toBe(1200);
    expect(followTime({ kind: "track", trackId: "v1" }, film(), 0)).toBeNull();
    expect(followTime({ kind: "frame", x: 0.5, y: 0.5 }, film(), 0)).toBeNull();
  });

  it("glides fast at first and settles on the target", () => {
    expect(glidePosition(1000, 2000, 0)).toBe(1000);
    expect(glidePosition(1000, 2000, 0.5)).toBeGreaterThan(1500);
    expect(glidePosition(1000, 2000, 1)).toBe(2000);
    expect(glidePosition(1000, 2000, 3)).toBe(2000);
  });
});
