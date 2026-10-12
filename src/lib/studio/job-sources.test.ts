import { describe, expect, it } from "vitest";

import { newImageLayer, newMediaClip, type Track } from "./document";
import { CLIP_JOB_SOURCES, clipJobRequest, generatedClipType, placementTracks } from "./job-sources";

describe("clip processing requests", () => {
  const clip = { ...newMediaClip("audio", "song", 2000, 3000), id: "c1", trimInMs: 500 };

  it("asks for the clip's media and returns the result to the same clip", () => {
    expect(clipJobRequest("denoise", clip)).toEqual({ input: { kind: "denoise", sourceMediaId: "song" }, target: { clipId: "c1" } });
    expect(clipJobRequest("cutout", { ...clip, type: "image", assetId: "img" })).toEqual({ input: { kind: "cutout", sourceMediaId: "img" }, target: { clipId: "c1" } });
  });

  it("aligns captions to the part of the media the clip plays", () => {
    expect(clipJobRequest("captions", clip)).toEqual({ input: { kind: "captions", sourceMediaId: "song" }, target: { clipId: "c1", window: { startMs: 2000, trimInMs: 500, durationMs: 3000 } } });
  });

  it("removes the background of the picture an overlay shows and remembers where it lives", () => {
    const logo = { ...clip, type: "overlay" as const, assetId: undefined, layer: { ...newImageLayer("logo"), id: "l" } };
    expect(CLIP_JOB_SOURCES.cutout(logo, { id: "v", kind: "visual", clips: [] })).toBe(true);
    expect(clipJobRequest("cutout", logo)).toEqual({ input: { kind: "cutout", sourceMediaId: "logo" }, target: { clipId: "c1", slot: "asset" } });
  });

  it("refuses a clip without media", () => {
    expect(clipJobRequest("denoise", { ...clip, assetId: undefined })).toBeNull();
  });
});

describe("generated media placement", () => {
  it("puts music and voice on audio tracks and images on visual ones", () => {
    expect(generatedClipType("music")).toBe("audio");
    expect(generatedClipType("voice")).toBe("audio");
    expect(generatedClipType("image")).toBe("image");
  });

  it("offers only the unlocked tracks that take the generated media", () => {
    const tracks: Track[] = [
      { id: "v1", kind: "visual", clips: [] },
      { id: "v2", kind: "visual", locked: true, clips: [] },
      { id: "a1", kind: "audio", clips: [] },
    ];
    expect(placementTracks(tracks, "image").map((t) => t.id)).toEqual(["v1"]);
    expect(placementTracks(tracks, "voice").map((t) => t.id)).toEqual(["a1"]);
  });
});
