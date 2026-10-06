import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, STUDIO_LIMITS, type VideoDocument } from "./document";
import { documentIssue } from "./validate";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "main", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 3000), id: "v", linkId: "pair-1" }] },
    { id: "text", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 2000), id: "o" }] },
    { id: "sound", kind: "audio", clips: [{ ...newMediaClip("audio", "vid", 0, 3000), id: "a", linkId: "pair-1" }] },
  ];
  d.durationMs = 3000;
  return d;
}

describe("links, markers and motions", () => {
  it("accepts what the backend accepts", () => {
    const d = doc();
    d.tracks[1].clips[0].motionIn = { edge: "bottom", durationMs: 400 };
    d.tracks[1].clips[0].motionOut = { edge: "top", durationMs: 300 };
    d.markers = [
      { id: "m1", atMs: 1500, label: "Batida" },
      { id: "m2", atMs: 0 },
    ];
    expect(documentIssue("video", d)).toBeNull();
    expect(documentIssue("video", emptyVideoDocument("square"))).toBeNull();
  });

  it.each([
    ["bad link", (d: VideoDocument) => (d.tracks[0].clips[0].linkId = "Pair 1"), { field: "document.tracks", code: "invalid" }],
    ["motion on audio", (d: VideoDocument) => (d.tracks[2].clips[0].motionIn = { edge: "left", durationMs: 500 }), { field: "document.tracks", code: "invalid" }],
    ["unknown edge", (d: VideoDocument) => (d.tracks[1].clips[0].motionIn = { edge: "spin" as "left", durationMs: 500 }), { field: "document.tracks", code: "unknown" }],
    ["motion too long", (d: VideoDocument) => (d.tracks[1].clips[0].motionOut = { edge: "top", durationMs: 2500 }), { field: "document.tracks", code: "out_of_range" }],
    ["marker past limit", (d: VideoDocument) => (d.markers = [{ id: "m1", atMs: STUDIO_LIMITS.maxVideoMs + 1 }]), { field: "document.markers", code: "out_of_range" }],
    ["duplicate marker", (d: VideoDocument) => (d.markers = [{ id: "m1", atMs: 0 }, { id: "m1", atMs: 10 }]), { field: "document.markers", code: "duplicate" }],
    ["bad marker id", (d: VideoDocument) => (d.markers = [{ id: "M 1", atMs: 0 }]), { field: "document.markers", code: "invalid" }],
    ["long label", (d: VideoDocument) => (d.markers = [{ id: "m1", atMs: 0, label: "a".repeat(STUDIO_LIMITS.maxMarkerLabelRunes + 1) }]), { field: "document.markers", code: "too_large" }],
    ["too many markers", (d: VideoDocument) => (d.markers = Array.from({ length: STUDIO_LIMITS.maxMarkers + 1 }, (_, i) => ({ id: `m${i}`, atMs: i }))), { field: "document.markers", code: "too_many" }],
    ["unknown motion field", (d: VideoDocument) => (d.tracks[1].clips[0].motionIn = { edge: "top", durationMs: 500, ease: "x" } as never), { field: "document", code: "invalid" }],
  ])("refuses %s like the backend", (_, change, expected) => {
    const d = doc();
    change(d);
    expect(documentIssue("video", d)).toEqual(expected);
  });
});

describe("disabled clips in the document", () => {
  it("accept the flag and refuse a wrong type like the backend", () => {
    const d = doc();
    d.tracks[0].clips[0].disabled = true;
    expect(documentIssue("video", d)).toBeNull();
    const wrong = doc();
    (wrong.tracks[0].clips[0] as unknown as { disabled: string }).disabled = "yes";
    expect(documentIssue("video", wrong)).toEqual({ field: "document", code: "invalid" });
  });
});
