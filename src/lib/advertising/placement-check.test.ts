import { describe, expect, it } from "vitest";

import { creativeImages, libraryMedia, studioSizesFor } from "./placement-check";
import { planPlacementFrames } from "./placement-frames";
import type { MediaChoice } from "./draft";

const photo: MediaChoice = { kind: "image", mediaId: "6a1f0c3e-2b4d-4c8e-9f10-1a2b3c4d5e6f", url: "https://cdn/photo.png" };
const other: MediaChoice = { kind: "image", mediaId: "7b2e1d4f-3c5e-4d9f-8a21-2b3c4d5e6f70", url: "https://cdn/other.png" };
const film: MediaChoice = { kind: "video", mediaId: "8c3f2e5a-4d6f-4ea0-9b32-3c4d5e6f7081", url: "https://cdn/film.mp4" };
const hosted: MediaChoice = { kind: "image", mediaId: "meta:abc123", url: "https://cdn.meta/abc.png" };

const catalog = {
  automaticPlatforms: ["facebook", "instagram"],
  videoOnlyPositions: { facebook: ["instream_video"] },
  placements: { facebook: ["feed", "story", "marketplace", "instream_video"], instagram: ["stream", "story", "reels"] },
};

describe("placement check inputs", () => {
  it("collects every image of the creative once, in order, and leaves videos out", () => {
    const images = creativeImages({ format: "CAROUSEL", media: null, cards: [{ media: photo }, { media: film }, { media: other }, { media: photo }], medias: [] });
    expect(images.map((m) => m.mediaId)).toEqual([photo.mediaId, other.mediaId]);
    expect(creativeImages({ format: "IMAGE", media: photo, cards: [], medias: [] })).toEqual([photo]);
    expect(creativeImages({ format: "FLEXIBLE", media: null, cards: [], medias: [film, other] })).toEqual([other]);
    expect(creativeImages({ format: "VIDEO", media: film, cards: [], medias: [] })).toEqual([]);
  });

  it("gives the studio one artboard per distinct placement size", () => {
    const plan = planPlacementFrames({ automatic: true }, catalog);
    expect(studioSizesFor(plan)).toEqual([
      { width: 1440, height: 1800 },
      { width: 1440, height: 2560 },
      { width: 1080, height: 1080 },
    ]);
  });

  it("only sends library images to the studio", () => {
    expect(libraryMedia(photo)).toBe(true);
    expect(libraryMedia(hosted)).toBe(false);
  });
});
