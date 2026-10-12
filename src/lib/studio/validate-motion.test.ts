import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import { documentIssue } from "./validate";

function film(clip: Partial<Clip>, kind: "visual" | "audio" = "visual"): VideoDocument {
  const doc = emptyVideoDocument("story");
  const base = newMediaClip(kind === "audio" ? "audio" : "image", "m-1", 0, 2000);
  doc.tracks = [{ id: "t", kind, clips: [{ ...base, id: "c", ...clip }] }];
  doc.durationMs = 2000;
  return doc;
}

describe("the motion contract shared with the backend", () => {
  it("accepts the fixture the backend accepts", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_motion.json"), "utf8"));
    expect(documentIssue("video", raw)).toBeNull();
  });

  it("accepts anchors, flips and orientation on visual clips", () => {
    expect(documentIssue("video", film({ anchor: { x: -1, y: 2 }, flipX: true, flipY: true, autoOrient: true }))).toBeNull();
  });

  it("refuses them on sounds and an anchor past the range", () => {
    expect(documentIssue("video", film({ anchor: { x: 2.5, y: 0.5 } }))).toEqual({ field: "document.tracks", code: "out_of_range" });
    for (const extra of [{ anchor: { x: 0, y: 0 } }, { flipX: true }, { autoOrient: true }]) expect(documentIssue("video", film(extra, "audio"))?.code).toBe("invalid");
  });

  it("refuses malformed path keys the way the backend does", () => {
    const keys = (key: Record<string, unknown>) => film({ keyframes: { position: [{ atMs: 0, x: 0.5, y: 0.5, easing: "linear", ...key }] } as Clip["keyframes"] });
    expect(documentIssue("video", keys({ spatial: "bendy" }))?.code).toBe("unknown");
    expect(documentIssue("video", keys({ spatial: "smooth", in: { x: 0, y: 0 } }))?.code).toBe("invalid");
    expect(documentIssue("video", keys({ out: { x: 0.1, y: 0 } }))?.code).toBe("invalid");
    expect(documentIssue("video", keys({ spatial: "free", in: { x: 2.5, y: 0 }, out: { x: 0, y: 0 } }))?.code).toBe("out_of_range");
    expect(documentIssue("video", keys({ x: 2.1 }))?.code).toBe("out_of_range");
    expect(documentIssue("video", keys({ handle: 1 }))?.code).toBe("invalid");
  });

  it("refuses rival lanes", () => {
    const line = [{ atMs: 0, value: 1, easing: "linear" as const }];
    expect(documentIssue("video", film({ keyframes: { scale: line, scaleY: line } }))?.code).toBe("invalid");
    expect(documentIssue("video", film({ keyframes: { position: [{ atMs: 0, x: 0.5, y: 0.5, easing: "linear" }], y: [{ atMs: 0, value: 0.5, easing: "linear" }] } }))?.code).toBe("invalid");
  });
});
