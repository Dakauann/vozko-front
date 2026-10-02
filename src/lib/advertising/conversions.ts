export interface Pixel {
  metaId: string;
  name: string;
  lastFiredTime?: string;
  creationTime?: string;
  unavailable: boolean;
}

export interface ConversionSettings {
  adAccountId: string;
  datasetId?: string;
  pixelId?: string;
  sendLeads: boolean;
  sendPurchases: boolean;
  enabled: boolean;
  updatedAt?: string;
}

export type ConversionStatus = "sent" | "skipped" | "failed";

export interface ConversionRecord {
  opportunityId: string;
  eventName: string;
  status: ConversionStatus | string;
  reason?: string;
  attempts: number;
  sentAt?: string;
  updatedAt: string;
}

export const SKIP_REASONS = ["not_enabled", "event_off", "no_ad_identity", "too_old", "no_dataset", "value_missing"] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

export function knownReason(reason: string | undefined): SkipReason | null {
  return reason && (SKIP_REASONS as readonly string[]).includes(reason) ? (reason as SkipReason) : null;
}

export type ConversionStatusKey = ConversionStatus | "unknown";

export function conversionStatusKey(status: string): ConversionStatusKey {
  return status === "sent" || status === "skipped" || status === "failed" ? status : "unknown";
}

export type EventKey = "lead" | "purchase" | "other";

export function eventKey(eventName: string): EventKey {
  if (eventName === "LeadSubmitted") return "lead";
  if (eventName === "Purchase") return "purchase";
  return "other";
}

export function emptySettings(adAccountId: string): ConversionSettings {
  return { adAccountId, sendLeads: true, sendPurchases: true, enabled: false };
}

export function settingsForAccount(settings: ConversionSettings | null, adAccountId: string): ConversionSettings {
  if (!settings || !settings.adAccountId) return emptySettings(adAccountId);
  return { ...settings, adAccountId };
}

export type SettingsProblem = "needs_target" | "nothing_to_send";

export function settingsProblems(settings: ConversionSettings): SettingsProblem[] {
  if (!settings.enabled) return [];
  const problems: SettingsProblem[] = [];
  if (!settings.datasetId?.trim() && !settings.pixelId?.trim()) problems.push("needs_target");
  if (!settings.sendLeads && !settings.sendPurchases) problems.push("nothing_to_send");
  return problems;
}

export function sameSettings(a: ConversionSettings, b: ConversionSettings): boolean {
  return (
    a.adAccountId === b.adAccountId &&
    (a.datasetId ?? "") === (b.datasetId ?? "") &&
    (a.pixelId ?? "") === (b.pixelId ?? "") &&
    a.sendLeads === b.sendLeads &&
    a.sendPurchases === b.sendPurchases &&
    a.enabled === b.enabled
  );
}
