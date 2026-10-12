import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { LEGIBLE_TEXT_PX, PLACEMENT_FRAMES, frameById, frameLayout, planPlacementFrames, safeZoneOf, type FrameLayout, type PlacementFrame, type PlacementPosition } from "./placement-frames";
import type { AdPlacements } from "./draft-types";

const FIXTURE = resolve(__dirname, "../../../../vozko-back/domain/advertising/testdata/placement_frames.json");

interface Fixture {
  legibleTextPx: number;
  frames: PlacementFrame[];
  layouts: { frame: string; width: number; height: number; expect: Omit<FrameLayout, "frame"> }[];
  plans: { placements: AdPlacements; frames: { id: string; positions: PlacementPosition[] }[]; videoOnly: PlacementPosition[] }[];
}

const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as Fixture;
const AUTOMATIC_PLATFORMS = ["facebook", "instagram"];
const VIDEO_ONLY = { facebook: ["instream_video"], audience_network: ["rewarded_video"] };
const PLATFORM_POSITIONS = {
  facebook: ["feed", "right_hand_column", "marketplace", "story", "search", "instream_video", "facebook_reels", "facebook_reels_overlay", "profile_feed", "notification"],
  instagram: ["stream", "story", "explore_home", "reels", "profile_feed", "ig_search", "profile_reels"],
  messenger: ["sponsored_messages"],
  audience_network: ["classic", "rewarded_video"],
  threads: ["threads_stream"],
};
const catalog = { automaticPlatforms: AUTOMATIC_PLATFORMS, videoOnlyPositions: VIDEO_ONLY, placements: PLATFORM_POSITIONS };

describe("placement frames", () => {
  it("mirrors the frame table the server uses", () => {
    expect(LEGIBLE_TEXT_PX).toBe(fixture.legibleTextPx);
    expect(PLACEMENT_FRAMES).toEqual(fixture.frames);
  });

  it("lays every fixture image out exactly like the server", () => {
    for (const c of fixture.layouts) {
      expect(frameLayout(frameById(c.frame)!, c.width, c.height), `${c.frame} ${c.width}x${c.height}`).toEqual({ frame: c.frame, ...c.expect });
    }
  });

  it("refuses an image without a size", () => {
    expect(frameLayout(frameById("feed")!, 0, 100)).toBeNull();
    expect(frameLayout(frameById("feed")!, 100, Number.NaN)).toBeNull();
  });

  it("plans the same frames for the same placements", () => {
    for (const c of fixture.plans) {
      const plan = planPlacementFrames(c.placements, catalog);
      expect(plan.frames.map((f) => ({ id: f.frame.id, positions: f.positions }))).toEqual(c.frames);
      expect(plan.videoOnly).toEqual(c.videoOnly);
    }
  });

  it("gives the story zone to whoever draws the 9:16 overlay", () => {
    expect(safeZoneOf("vertical")).toEqual({ top: 0.14, bottom: 0.35, side: 0.06 });
    expect(safeZoneOf("feed")).toBeNull();
  });
});
