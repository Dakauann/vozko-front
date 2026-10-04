import { describe, expect, it } from "vitest";

import { videoOnlyPlacementsSkipped } from "./video-placements";

const catalog = {
  videoOnlyPositions: { facebook: ["instream_video"], audience_network: ["rewarded_video"] },
  automaticPlatforms: ["facebook", "instagram"],
};

const image = { format: "IMAGE" as const, media: { kind: "image" as const, mediaId: "m", url: "u" }, medias: [], cards: [] };

describe("videoOnlyPlacementsSkipped", () => {
  it("warns about Facebook in-stream reels for an image ad on automatic placements, like Meta", () => {
    expect(videoOnlyPlacementsSkipped({ automatic: true }, image, catalog)).toEqual([{ platform: "facebook", position: "instream_video" }]);
  });

  it("says nothing once the ad has a video", () => {
    expect(videoOnlyPlacementsSkipped({ automatic: true }, { ...image, format: "VIDEO" }, catalog)).toEqual([]);
    const carousel = { format: "CAROUSEL" as const, media: null, medias: [], cards: [{ media: { kind: "video" as const, mediaId: "v", url: "u" } }] };
    expect(videoOnlyPlacementsSkipped({ automatic: true }, carousel, catalog)).toEqual([]);
  });

  it("checks only the platforms and positions chosen by hand", () => {
    expect(videoOnlyPlacementsSkipped({ automatic: false, platforms: ["instagram"] }, image, catalog)).toEqual([]);
    expect(
      videoOnlyPlacementsSkipped({ automatic: false, platforms: ["facebook", "audience_network"], positions: { facebook: ["feed"] } }, image, catalog),
    ).toEqual([{ platform: "audience_network", position: "rewarded_video" }]);
  });

  it("stays quiet when it cannot know whether the creative is a video", () => {
    expect(videoOnlyPlacementsSkipped({ automatic: true }, { ...image, format: "EXISTING_POST" }, catalog)).toEqual([]);
    expect(videoOnlyPlacementsSkipped({ automatic: true }, image, { videoOnlyPositions: undefined, automaticPlatforms: undefined })).toEqual([]);
  });
});
