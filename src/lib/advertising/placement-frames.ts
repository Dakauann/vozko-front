import type { AdPlacements, AdsOptions } from "./draft-types";

export type FrameFit = "crop" | "fill";

export type PlacementFrameId = "feed" | "vertical" | "square" | "right_column" | "search" | "messenger" | "audience_network" | "thumbnail";

export interface PixelSize {
  width: number;
  height: number;
}

export interface SafeInsets {
  top: number;
  bottom: number;
  side: number;
}

export interface PlacementPosition {
  platform: string;
  position: string;
}

export interface PlacementFrame {
  id: PlacementFrameId;
  fit: FrameFit;
  minRatio: number;
  maxRatio: number;
  tolerance: number;
  displayWidth: number;
  recommended: PixelSize;
  minimum: PixelSize;
  safe: SafeInsets | null;
  positions: PlacementPosition[];
}

export interface FrameRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface FrameLayout {
  frame: string;
  ratio: number;
  crop: FrameRect;
  image: FrameRect;
  safe: FrameRect;
  cropLoss: number;
  background: number;
  visible: PixelSize;
  minTextPx: number;
  belowMinimum: boolean;
}

export interface PlannedFrame {
  frame: PlacementFrame;
  positions: PlacementPosition[];
}

export interface PlacementPlan {
  frames: PlannedFrame[];
  videoOnly: PlacementPosition[];
}

export type PlacementCatalog = Pick<AdsOptions, "automaticPlatforms" | "videoOnlyPositions" | "placements">;

export const LEGIBLE_TEXT_PX = 12;

export const VERTICAL_SAFE_ZONE: SafeInsets = { top: 0.14, bottom: 0.35, side: 0.06 };

const PRECISION = 10_000;
const WHOLE: FrameRect = { x0: 0, y0: 0, x1: 1, y1: 1 };

function at(platform: string, ...positions: string[]): PlacementPosition[] {
  return positions.map((position) => ({ platform, position }));
}

export const PLACEMENT_FRAMES: readonly PlacementFrame[] = [
  { id: "feed", fit: "crop", minRatio: 0.8, maxRatio: 1.91, tolerance: 0.01, displayWidth: 390, recommended: { width: 1440, height: 1800 }, minimum: { width: 600, height: 0 }, safe: null,
    positions: [...at("facebook", "feed", "profile_feed"), ...at("instagram", "stream", "profile_feed", "explore_home", "ig_search"), ...at("threads", "threads_stream")] },
  { id: "vertical", fit: "fill", minRatio: 0.5625, maxRatio: 0.5625, tolerance: 0.01, displayWidth: 390, recommended: { width: 1440, height: 2560 }, minimum: { width: 500, height: 0 }, safe: VERTICAL_SAFE_ZONE,
    positions: [...at("facebook", "story", "facebook_reels"), ...at("instagram", "story", "reels", "profile_reels")] },
  { id: "square", fit: "crop", minRatio: 1, maxRatio: 1, tolerance: 0.01, displayWidth: 180, recommended: { width: 1080, height: 1080 }, minimum: { width: 0, height: 0 }, safe: null, positions: at("facebook", "marketplace") },
  { id: "right_column", fit: "crop", minRatio: 1, maxRatio: 1, tolerance: 0.01, displayWidth: 254, recommended: { width: 1080, height: 1080 }, minimum: { width: 254, height: 133 }, safe: null, positions: at("facebook", "right_hand_column") },
  { id: "search", fit: "crop", minRatio: 1, maxRatio: 1.91, tolerance: 0.03, displayWidth: 390, recommended: { width: 1080, height: 1080 }, minimum: { width: 600, height: 600 }, safe: null, positions: at("facebook", "search") },
  { id: "messenger", fit: "crop", minRatio: 1, maxRatio: 1.91, tolerance: 0.03, displayWidth: 260, recommended: { width: 1200, height: 628 }, minimum: { width: 0, height: 0 }, safe: null, positions: at("messenger", "sponsored_messages") },
  { id: "audience_network", fit: "crop", minRatio: 1, maxRatio: 1.91, tolerance: 0.03, displayWidth: 320, recommended: { width: 1200, height: 628 }, minimum: { width: 398, height: 208 }, safe: null, positions: at("audience_network", "classic") },
  { id: "thumbnail", fit: "crop", minRatio: 1, maxRatio: 1, tolerance: 0.01, displayWidth: 96, recommended: { width: 1080, height: 1080 }, minimum: { width: 0, height: 0 }, safe: null, positions: at("facebook", "notification", "facebook_reels_overlay") },
];

export function frameById(id: string): PlacementFrame | undefined {
  return PLACEMENT_FRAMES.find((frame) => frame.id === id);
}

export function safeZoneOf(id: PlacementFrameId): SafeInsets | null {
  return frameById(id)?.safe ?? null;
}

function rounded(value: number): number {
  return Math.round(value * PRECISION) / PRECISION;
}

function roundedRect(r: FrameRect): FrameRect {
  return { x0: rounded(r.x0), y0: rounded(r.y0), x1: rounded(r.x1), y1: rounded(r.y1) };
}

function centered(share: number, horizontal: boolean): FrameRect {
  const lo = (1 - share) / 2;
  const hi = (1 + share) / 2;
  return horizontal ? { x0: lo, y0: 0, x1: hi, y1: 1 } : { x0: 0, y0: lo, x1: 1, y1: hi };
}

function coverCrop(ratio: number, target: number): FrameRect {
  if (target < ratio) return centered(target / ratio, true);
  if (target > ratio) return centered(ratio / target, false);
  return WHOLE;
}

function safeRect(frame: PlacementFrame): FrameRect {
  if (!frame.safe) return WHOLE;
  return { x0: frame.safe.side, y0: frame.safe.top, x1: 1 - frame.safe.side, y1: 1 - frame.safe.bottom };
}

export function frameLayout(frame: PlacementFrame, width: number, height: number): FrameLayout | null {
  if (!(width > 0) || !(height > 0)) return null;
  const ratio = width / height;
  const low = frame.minRatio * (1 - frame.tolerance);
  const high = frame.maxRatio * (1 + frame.tolerance);
  const target = ratio < low ? frame.minRatio : ratio > high ? frame.maxRatio : ratio;
  let crop = coverCrop(ratio, target);
  let image = WHOLE;
  let frameRatio = target;
  let background = 0;
  if (frame.fit === "fill") {
    frameRatio = frame.minRatio;
    if (ratio > high) {
      const share = frame.minRatio / ratio;
      crop = WHOLE;
      image = centered(share, false);
      background = 1 - share;
    }
  }
  const visible = { width: Math.round(width * (crop.x1 - crop.x0)), height: Math.round(height * (crop.y1 - crop.y0)) };
  return {
    frame: frame.id,
    ratio: rounded(frameRatio),
    crop: roundedRect(crop),
    image: roundedRect(image),
    safe: safeRect(frame),
    cropLoss: rounded(1 - (crop.x1 - crop.x0) * (crop.y1 - crop.y0)),
    background: rounded(background),
    visible,
    minTextPx: Math.ceil((LEGIBLE_TEXT_PX * visible.width) / frame.displayWidth - 1e-9),
    belowMinimum: (frame.minimum.width > 0 && visible.width < frame.minimum.width) || (frame.minimum.height > 0 && visible.height < frame.minimum.height),
  };
}

function chosenPositions(placements: AdPlacements, catalog: PlacementCatalog): PlacementPosition[] {
  const platforms = placements.automatic ? catalog.automaticPlatforms : (placements.platforms ?? []);
  return platforms.flatMap((platform) => {
    const picked = placements.automatic ? null : placements.positions?.[platform];
    return at(platform, ...(picked?.length ? picked : (catalog.placements[platform] ?? [])));
  });
}

function samePosition(a: PlacementPosition, b: PlacementPosition): boolean {
  return a.platform === b.platform && a.position === b.position;
}

export function planPlacementFrames(placements: AdPlacements, catalog: PlacementCatalog): PlacementPlan {
  const chosen = chosenPositions(placements, catalog);
  const videoOnly = chosen.filter((p) => (catalog.videoOnlyPositions[p.platform] ?? []).includes(p.position));
  const frames = PLACEMENT_FRAMES.flatMap((frame) => {
    const positions = frame.positions.filter((position) => chosen.some((c) => samePosition(c, position)));
    return positions.length > 0 ? [{ frame, positions }] : [];
  });
  return { frames, videoOnly };
}
