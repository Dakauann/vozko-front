import { describe, expect, it } from "vitest";

import { headroomMs, sourceAt, sourceSpanMs, speedIssue, splitTrimIns, tailroomMs, trimInAfterEdge } from "./clip-time";
import { newMediaClip, newOverlayClip, newTextLayer, type Clip } from "./document";

const video = (extra: Partial<Clip> = {}): Clip => ({ ...newMediaClip("video", "v", 0, 2000), trimInMs: 1000, ...extra });

describe("source time of a clip", () => {
  it("reads the source window at the clip speed", () => {
    expect(sourceSpanMs(video())).toBe(2000);
    expect(sourceSpanMs(video({ speed: 0.5 }))).toBe(1000);
    expect(sourceSpanMs(video({ speed: 2 }))).toBe(4000);
    expect(sourceSpanMs(video({ freeze: true }))).toBe(0);
    expect(sourceAt(video({ speed: 2 }), 500)).toBe(2000);
    expect(sourceAt(video({ freeze: true }), 1500)).toBe(1000);
  });

  it("plays a reversed clip from the end of its window back to its start", () => {
    const reversed = video({ reverse: true, speed: 2 });
    expect(sourceAt(reversed, 0)).toBe(4998);
    expect(sourceAt(reversed, 1000)).toBe(2998);
    expect(sourceAt(reversed, 2000)).toBe(1000);
  });

  it("knows how far each edge can grow before the media runs out", () => {
    expect(headroomMs(video({ speed: 2 }), 10_000)).toBe(500);
    expect(tailroomMs(video({ speed: 2 }), 10_000)).toBe(2500);
    expect(headroomMs(video({ reverse: true, speed: 2 }), 10_000)).toBe(2500);
    expect(tailroomMs(video({ reverse: true, speed: 2 }), 10_000)).toBe(500);
    expect(tailroomMs(video(), undefined)).toBe(Infinity);
    expect(headroomMs(video({ freeze: true }), 10_000)).toBe(Infinity);
    expect(headroomMs({ ...newOverlayClip(newTextLayer("Oi"), 0, 1000) }, undefined)).toBe(Infinity);
  });

  it("moves the start of the window when the edge that shows it moves", () => {
    expect(trimInAfterEdge(video({ speed: 2 }), "start", 250)).toBe(1500);
    expect(trimInAfterEdge(video({ speed: 2 }), "end", 250)).toBe(1000);
    expect(trimInAfterEdge(video({ reverse: true, speed: 2 }), "start", 250)).toBe(1000);
    expect(trimInAfterEdge(video({ reverse: true, speed: 2 }), "end", 250)).toBe(1500);
    expect(trimInAfterEdge(video({ reverse: true, speed: 2 }), "end", -250)).toBe(500);
  });

  it("splits the window so both pieces keep playing the same frames", () => {
    expect(splitTrimIns(video({ speed: 2 }), 500)).toEqual({ left: 1000, right: 2000 });
    expect(splitTrimIns(video({ reverse: true, speed: 2 }), 500)).toEqual({ left: 4000, right: 1000 });
  });

  it("accepts speed only where the media has time", () => {
    expect(speedIssue(video({ speed: 0.25, reverse: true }))).toBeNull();
    expect(speedIssue(video({ freeze: true }))).toBeNull();
    expect(speedIssue(video({ speed: 20 }))).toBe("out_of_range");
    expect(speedIssue(video({ speed: 0 }))).toBe("out_of_range");
    expect(speedIssue(video({ freeze: true, speed: 2 }))).toBe("invalid");
    expect(speedIssue({ ...newMediaClip("audio", "a", 0, 1000), freeze: true })).toBe("invalid");
    expect(speedIssue({ ...newMediaClip("image", "i", 0, 1000), speed: 2 })).toBe("invalid");
    expect(speedIssue({ ...newMediaClip("audio", "a", 0, 1000), speed: 2, preservePitch: false })).toBeNull();
  });
});
