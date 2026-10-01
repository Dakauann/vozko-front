export type FramedMedia = "image" | "video" | "sticker";

export interface MediaDimensions {
  width: number;
  height: number;
}

export interface MediaFrame extends MediaDimensions {
  fit: "contain" | "cover";
}

interface FrameRule {
  maxWidth: number;
  maxHeight: number;
  minSide: number;
  unknown: MediaFrame;
}

const RULES: Record<FramedMedia, FrameRule> = {
  image: { maxWidth: 280, maxHeight: 360, minSide: 96, unknown: { width: 240, height: 240, fit: "cover" } },
  video: { maxWidth: 280, maxHeight: 300, minSide: 96, unknown: { width: 280, height: 158, fit: "cover" } },
  sticker: { maxWidth: 160, maxHeight: 160, minSide: 64, unknown: { width: 160, height: 160, fit: "contain" } },
};

export function mediaFrame(kind: FramedMedia, dimensions?: Partial<MediaDimensions> | null): MediaFrame {
  const rule = RULES[kind];
  const width = dimensions?.width ?? 0;
  const height = dimensions?.height ?? 0;
  if (!(width > 0 && height > 0)) {
    return rule.unknown;
  }
  const scale = Math.min(1, rule.maxWidth / width, rule.maxHeight / height);
  const scaledWidth = Math.round(width * scale);
  const scaledHeight = Math.round(height * scale);
  const cropped = scaledWidth < rule.minSide || scaledHeight < rule.minSide;
  return {
    width: Math.max(scaledWidth, rule.minSide),
    height: Math.max(scaledHeight, rule.minSide),
    fit: cropped ? "cover" : "contain",
  };
}
