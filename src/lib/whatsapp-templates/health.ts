import type { StatusChipTone } from "@/components/elevated-design/status-chip";
import { sendRiskOf, type SendRisk } from "@/lib/whatsapp/send-risk";

import type { TemplateStatus, WhatsAppTemplate } from "./types";

export const TEMPLATE_QUALITIES = ["GREEN", "YELLOW", "RED", "UNKNOWN"] as const;

type TemplateQuality = (typeof TEMPLATE_QUALITIES)[number];

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

const TEMPLATE_STATUS_TONE: Record<TemplateStatus, StatusChipTone> = {
  APPROVED: "healthy",
  PENDING: "warning",
  REJECTED: "fault",
  PAUSED: "muted",
  DISABLED: "muted",
};

export function templateStatusTone(status: string): StatusChipTone {
  return TEMPLATE_STATUS_TONE[status as TemplateStatus] ?? "muted";
}

export function templateSendRisk(template: Pick<WhatsAppTemplate, "status" | "quality">): SendRisk | null {
  return sendRiskOf(templateStatusTone(template.status), qualityTone(template.quality ?? ""));
}
