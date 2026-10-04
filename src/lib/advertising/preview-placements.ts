import type { ClippedText } from "./preview-spec";
import { clipText } from "./preview-spec";

export type PreviewPlatform = "facebook" | "instagram";

export type PreviewGroup = "feeds" | "vertical";

export type PreviewShape = "feed" | "marketplace" | "story" | "reels";

export type PreviewPlacementId =
  | "facebook_feed"
  | "instagram_feed"
  | "facebook_marketplace"
  | "facebook_story"
  | "instagram_story"
  | "facebook_reels"
  | "instagram_reels";

export type PlacementFilter = "all" | PreviewGroup;

export interface PreviewTextLimits {
  primaryText: number;
  headline: number;
}

export interface PreviewPlacementSpec {
  id: PreviewPlacementId;
  platform: PreviewPlatform;
  group: PreviewGroup;
  shape: PreviewShape;
  limits: PreviewTextLimits;
}

export const PLACEMENT_FILTERS: PlacementFilter[] = ["all", "feeds", "vertical"];

export const PREVIEW_PLACEMENTS: PreviewPlacementSpec[] = [
  { id: "facebook_feed", platform: "facebook", group: "feeds", shape: "feed", limits: { primaryText: 200, headline: 40 } },
  { id: "instagram_feed", platform: "instagram", group: "feeds", shape: "feed", limits: { primaryText: 85, headline: 40 } },
  { id: "facebook_story", platform: "facebook", group: "vertical", shape: "story", limits: { primaryText: 70, headline: 30 } },
  { id: "instagram_story", platform: "instagram", group: "vertical", shape: "story", limits: { primaryText: 70, headline: 30 } },
  { id: "facebook_marketplace", platform: "facebook", group: "feeds", shape: "marketplace", limits: { primaryText: 0, headline: 30 } },
  { id: "instagram_reels", platform: "instagram", group: "vertical", shape: "reels", limits: { primaryText: 40, headline: 30 } },
  { id: "facebook_reels", platform: "facebook", group: "vertical", shape: "reels", limits: { primaryText: 40, headline: 30 } },
];

const SHAPES_BY_FORMAT: Partial<Record<string, PreviewShape[]>> = {
  CAROUSEL: ["feed", "story"],
  CATALOG: ["feed", "story"],
  COLLECTION: ["feed"],
  EXISTING_POST: ["feed", "story", "reels"],
};

export function placementsFor(filter: PlacementFilter, format: string | undefined): PreviewPlacementSpec[] {
  const shapes = format ? SHAPES_BY_FORMAT[format] : undefined;
  return PREVIEW_PLACEMENTS.filter((spec) => (filter === "all" || spec.group === filter) && (!shapes || shapes.includes(spec.shape)));
}

export function placementText(spec: PreviewPlacementSpec, text: string | undefined): ClippedText {
  return clipText(text, spec.limits.primaryText);
}
