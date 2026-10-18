import type { StatusChipTone } from "@/components/elevated-design/status-chip";

export const TEMPLATE_QUALITIES = ["GREEN", "YELLOW", "RED", "UNKNOWN"] as const;

export type TemplateQuality = (typeof TEMPLATE_QUALITIES)[number];

export type TemplateHealthChange = {
  signal: "quality" | "status" | "category";
  event?: string;
  previous?: string;
  current: string;
  occurredAt: string;
};

export type TemplateHealth = {
  templateId: string;
  status: string;
  category: string;
  quality: string;
  qualityAt?: string;
  flagged: boolean;
  changes: TemplateHealthChange[];
};

const QUALITY_TONE: Record<TemplateQuality, StatusChipTone> = {
  GREEN: "healthy",
  YELLOW: "warning",
  RED: "fault",
  UNKNOWN: "muted",
};

export function knownQuality(quality: string): TemplateQuality {
  return (TEMPLATE_QUALITIES as readonly string[]).includes(quality) ? (quality as TemplateQuality) : "UNKNOWN";
}

export function qualityTone(quality: string): StatusChipTone {
  return QUALITY_TONE[knownQuality(quality)];
}
