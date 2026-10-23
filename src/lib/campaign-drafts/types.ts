import type { AudienceCount } from "@/lib/campaign-audience/types";
import type { SendMode } from "@/lib/campaign-wizard/steps";
import type { CampaignEstimateDraft } from "@/lib/unofficial-whatsapp-campaigns/types";

export type DraftChannel = "whatsapp" | "unofficial_whatsapp";

export const DRAFT_CHANNELS: readonly DraftChannel[] = ["whatsapp", "unofficial_whatsapp"];

export interface DraftPayload<R = unknown, S = unknown> {
  request?: R;
  state?: S;
}

export interface CampaignDraft<R = unknown, S = unknown> {
  id: string;
  channel: DraftChannel;
  name: string;
  payload: DraftPayload<R, S>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DraftSaveRequest<R = unknown, S = unknown> {
  name: string;
  payload: DraftPayload<R, S>;
}

export interface DraftList<R = unknown, S = unknown> {
  items: CampaignDraft<R, S>[];
}

export type LaunchFindingLevel = "block" | "confirm" | "advice";

export interface LaunchFinding {
  code: string;
  level: LaunchFindingLevel;
  observed?: number;
  limit?: number;
}

export interface LaunchReport {
  findings: LaunchFinding[];
  fingerprint: string;
  blocks: boolean;
  needsConfirmation: boolean;
}

export interface SendQuote {
  category: string;
  unitPriceMicros: number;
  eligible: number;
  costMicros: number;
  balanceMicros: number;
  currency: string;
  affordable: boolean;
  unitPriceBrl: number;
  costBrl: number;
  balanceBrl: number;
}

export interface OfficialDraftReview {
  audience: AudienceCount | null;
  quote: SendQuote | null;
  check: LaunchReport;
}

export interface UnofficialDraftReview {
  audience: AudienceCount | null;
  estimate: CampaignEstimateDraft | null;
  check: LaunchReport;
}

export interface DraftReviewOf {
  whatsapp: OfficialDraftReview;
  unofficial_whatsapp: UnofficialDraftReview;
}

export interface DraftLaunchRequest {
  mode: SendMode;
  scheduledStart?: string;
  confirmedFingerprint?: string;
}

export interface DraftLaunchResult<C = unknown> {
  campaign: C;
  started: boolean;
  mode: SendMode;
  warnings: string[];
  startRefusal?: string;
}

export interface LaunchRefusalDetails {
  blocks: string[];
  confirms: string[];
  fingerprint: string;
}

function codes(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item !== "");
  if (typeof value === "string") return value.split(",").filter((item) => item !== "");
  return [];
}

export function launchRefusalOf(details: Record<string, unknown> | undefined): LaunchRefusalDetails {
  return {
    blocks: codes(details?.blocks),
    confirms: codes(details?.confirms),
    fingerprint: typeof details?.fingerprint === "string" ? details.fingerprint : "",
  };
}

export const CAMPAIGN_DRAFT_ERROR_CODES = [
  "campaign_draft_not_found",
  "campaign_draft_invalid",
  "campaign_draft_too_large",
  "campaign_launch_mode_invalid",
  "campaign_launch_schedule_missing",
] as const;
