import { CAMPAIGN_CHANNELS, type CampaignChannel } from "@/lib/carrier-messaging/campaigns";
import { oneOf } from "@/lib/carrier-messaging/parse";
import { isCount, isJson, isText } from "@/lib/json/guards";
import type { RcsContent } from "@/lib/rcs/types";
import type { WorkingHoursDay, WorkingHoursSpec, WorkingHoursWindow } from "@/lib/working-hours/types";

export const ATTRIBUTION_DAYS = { default: 7, max: 90 } as const;

export interface CarrierQuietHours extends WorkingHoursSpec {
  holidays?: string[];
}

export interface CarrierSettings {
  quiet_hours: CarrierQuietHours;
  frequency_cap: { per_day: number; per_week: number };
  attribution_days: number;
}

export interface Suppression {
  phone: string;
  source: string;
  created_at: string;
}

export interface SuppressionPage {
  items: Suppression[];
  total: number;
}

export interface TestSendRequest {
  channel: CampaignChannel;
  sender_id: string;
  phone: string;
  content?: RcsContent;
  text?: string;
  vars?: string[];
}

export interface CarrierMessage {
  id: string;
  channel: CampaignChannel;
  reference: string;
  status: string;
  error_code: string;
  class?: string;
  segments?: number;
}

const DAYS: readonly WorkingHoursDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function parseWindows(value: unknown): WorkingHoursWindow[] | null {
  if (!Array.isArray(value)) return null;
  const windows = value.map((window) => (isJson(window) && isText(window.start) && isText(window.end) ? { start: window.start, end: window.end } : null));
  return windows.some((window) => window === null) ? null : (windows as WorkingHoursWindow[]);
}

export function parseQuietHours(value: unknown): CarrierQuietHours | null {
  if (!isJson(value) || !isText(value.timezone) || !isJson(value.days)) return null;
  const days: CarrierQuietHours["days"] = {};
  for (const [day, windows] of Object.entries(value.days)) {
    if (!oneOf(DAYS, day)) return null;
    const parsed = parseWindows(windows);
    if (!parsed) return null;
    days[day] = parsed;
  }
  const spec: CarrierQuietHours = { timezone: value.timezone, days };
  if (Array.isArray(value.holidays) && value.holidays.every(isText)) spec.holidays = value.holidays as string[];
  return spec;
}

export function parseCarrierSettings(value: unknown): CarrierSettings | null {
  if (!isJson(value) || !isJson(value.frequency_cap) || !isCount(value.attribution_days)) return null;
  const quiet = parseQuietHours(value.quiet_hours);
  const { per_day, per_week } = value.frequency_cap;
  if (!quiet || !isCount(per_day) || !isCount(per_week)) return null;
  return { quiet_hours: quiet, frequency_cap: { per_day, per_week }, attribution_days: value.attribution_days };
}

export function parseSuppressionPage(value: unknown): SuppressionPage | null {
  if (!isJson(value) || !isCount(value.total) || !Array.isArray(value.items)) return null;
  const items = value.items.map((item) => (isJson(item) && isText(item.phone) && typeof item.source === "string" && isText(item.created_at) ? { phone: item.phone, source: item.source, created_at: item.created_at } : null));
  if (items.some((item) => item === null)) return null;
  return { items: items as Suppression[], total: value.total };
}

export function parseCarrierMessage(value: unknown): CarrierMessage | null {
  if (!isJson(value) || !isText(value.id) || !oneOf(CAMPAIGN_CHANNELS, value.channel) || typeof value.reference !== "string") return null;
  if (!isText(value.status) || typeof (value.error_code ?? "") !== "string") return null;
  const message: CarrierMessage = { id: value.id, channel: value.channel, reference: value.reference, status: value.status, error_code: (value.error_code as string | undefined) ?? "" };
  if (isText(value.class)) message.class = value.class;
  if (isCount(value.segments)) message.segments = value.segments;
  return message;
}
