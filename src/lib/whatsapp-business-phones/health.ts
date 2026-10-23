import type { StatusChipTone } from "@/components/elevated-design/status-chip";
import { sendRiskOf, type SendRisk } from "@/lib/whatsapp/send-risk";

import type { BusinessPhoneStatus, QualityRating, WhatsAppBusinessPhone } from "./types";

const PHONE_STATUS_TONE: Record<BusinessPhoneStatus, StatusChipTone> = {
  PENDING: "warning",
  VERIFYING: "muted",
  CONNECTED: "healthy",
  DISCONNECTED: "muted",
  BANNED: "fault",
  FLAGGED: "warning",
  RESTRICTED: "warning",
  RATE_LIMITED: "muted",
  UNVERIFIED: "warning",
  ONBOARDING_FAILED: "fault",
  DELETED: "muted",
};

const PHONE_QUALITY_TONE: Record<QualityRating, StatusChipTone> = {
  GREEN: "healthy",
  YELLOW: "warning",
  RED: "fault",
  UNKNOWN: "muted",
  NA: "muted",
};

export function phoneStatusTone(status: string): StatusChipTone {
  return PHONE_STATUS_TONE[status as BusinessPhoneStatus] ?? "muted";
}

export function phoneQuality(rating: string | undefined): QualityRating {
  return rating && rating in PHONE_QUALITY_TONE ? (rating as QualityRating) : "UNKNOWN";
}

export function phoneQualityTone(rating: string | undefined): StatusChipTone {
  return PHONE_QUALITY_TONE[phoneQuality(rating)];
}

export function phoneSendRisk(phone: Pick<WhatsAppBusinessPhone, "status" | "qualityRating">): SendRisk | null {
  return sendRiskOf(phoneStatusTone(phone.status), phoneQualityTone(phone.qualityRating));
}
