import type { StatusChipTone } from "@/components/elevated-design/status-chip";
import type { TextLimit } from "@/lib/conversations/types";
import { refuseUnhandled } from "@/lib/exhaustive";
import {
  MERCADOLIVRE_ANSWER_SOURCES,
  MERCADOLIVRE_LISTING_STATUSES,
  MERCADOLIVRE_QUESTION_STATUSES,
  type MercadoLivreAnswerSource,
  type MercadoLivreListingStatus,
  type MercadoLivreQuestion,
  type MercadoLivreQuestionStatus,
  type MercadoLivreResponseTime,
} from "@/lib/mercadolivre/types";

export const MERCADOLIVRE_ANSWER_LIMIT: TextLimit = { max: 2000, unit: "characters" };

export const QUESTION_STATUS_FILTERS = ["all", "UNANSWERED", "ANSWERED", "UNDER_REVIEW", "CLOSED_UNANSWERED", "BANNED"] as const satisfies readonly (
  | "all"
  | MercadoLivreQuestionStatus
)[];

export type QuestionStatusFilter = (typeof QUESTION_STATUS_FILTERS)[number];

function knownStatus(raw: string): MercadoLivreQuestionStatus | null {
  return (MERCADOLIVRE_QUESTION_STATUSES as readonly string[]).includes(raw) ? (raw as MercadoLivreQuestionStatus) : null;
}

export function questionStatusKey(raw: string): `status.${MercadoLivreQuestionStatus}` | "status.unknown" {
  const status = knownStatus(raw);
  return status ? `status.${status}` : "status.unknown";
}

export function questionStatusTone(raw: string): StatusChipTone {
  const status = knownStatus(raw);
  if (status === null) return "muted";
  switch (status) {
    case "UNANSWERED":
      return "warning";
    case "ANSWERED":
      return "healthy";
    case "BANNED":
      return "fault";
    case "UNDER_REVIEW":
      return "neutral";
    case "CLOSED_UNANSWERED":
    case "DELETED":
    case "DISABLED":
      return "muted";
    default:
      return refuseUnhandled(status, "muted");
  }
}

export function questionIsOpen(question: MercadoLivreQuestion): boolean {
  return knownStatus(question.status) === "UNANSWERED";
}

export function answeredByKey(raw: string | undefined): `answeredBy.${MercadoLivreAnswerSource}` | null {
  if (!raw || !(MERCADOLIVRE_ANSWER_SOURCES as readonly string[]).includes(raw)) return null;
  return `answeredBy.${raw as MercadoLivreAnswerSource}`;
}

export function listingStatusTone(raw: string): StatusChipTone {
  if (!(MERCADOLIVRE_LISTING_STATUSES as readonly string[]).includes(raw)) return "muted";
  const status = raw as MercadoLivreListingStatus;
  switch (status) {
    case "active":
      return "healthy";
    case "paused":
      return "warning";
    case "closed":
      return "muted";
    default:
      return refuseUnhandled(status, "muted");
  }
}

export function listingStatusKey(raw: string): `listingStatus.${MercadoLivreListingStatus}` | "listingStatus.unknown" {
  return (MERCADOLIVRE_LISTING_STATUSES as readonly string[]).includes(raw)
    ? `listingStatus.${raw as MercadoLivreListingStatus}`
    : "listingStatus.unknown";
}

const RESPONSE_TIME_SLOTS = ["total", "weekdaysWorkingHours", "weekdaysExtraHours", "weekend"] as const;

export type ResponseTimeSlotKey = (typeof RESPONSE_TIME_SLOTS)[number];

export interface ResponseTimeSlotView {
  key: ResponseTimeSlotKey;
  minutes: number;
  salesPercentIncrease: number | undefined;
}

export function responseTimeSlots(responseTime: MercadoLivreResponseTime): ResponseTimeSlotView[] {
  if (!responseTime.available) return [];
  return RESPONSE_TIME_SLOTS.flatMap((key) => {
    const slot = responseTime[key];
    return slot ? [{ key, minutes: slot.minutes, salesPercentIncrease: slot.salesPercentIncrease }] : [];
  });
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function durationParts(total: number): { days: number; hours: number; minutes: number } {
  const whole = Math.max(0, Math.round(total));
  return {
    days: Math.floor(whole / MINUTES_PER_DAY),
    hours: Math.floor((whole % MINUTES_PER_DAY) / MINUTES_PER_HOUR),
    minutes: whole % MINUTES_PER_HOUR,
  };
}
