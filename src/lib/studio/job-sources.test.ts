import { describe, expect, it } from "vitest";

import type { Track } from "./document";
import { generatedClipType, placementTracks } from "./job-sources";

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
