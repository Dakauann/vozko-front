export const LABEL_COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

export function isLabelColor(value: unknown): value is LabelColor {
  return typeof value === "string" && (LABEL_COLORS as readonly string[]).includes(value);
}

export const CLIP_TAG_FIELDS = ["name", "labelColor", "markers"] as const;

export const GUIDE_FIELD = "guide";
