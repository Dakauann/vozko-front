import { screenPaths } from "@/lib/navigation/routes";

import { isNewerVersion } from "./version";
import type { LeadAddress, LeadArea, LeadBlockOutcome, LeadDetail, LeadRecord } from "./types";

export function withRecord(detail: LeadDetail, record: LeadRecord): LeadDetail {
  if (isNewerVersion(detail.version, record.version)) return detail;
  const sameOwner = !!record.owner && record.owner === detail.owner;
  return {
    ...record,
    ...(sameOwner && detail.ownerName ? { ownerName: detail.ownerName } : {}),
    whatsappCampaigns: detail.whatsappCampaigns,
    totalCampaigns: detail.totalCampaigns,
    lastActivityAt: detail.lastActivityAt,
    whatsappWindowOpen: detail.whatsappWindowOpen,
    windowExpiresAt: detail.windowExpiresAt,
    campaigns: detail.campaigns,
  };
}

export function withBlockOutcome(detail: LeadDetail, outcome: LeadBlockOutcome): LeadDetail {
  if (isNewerVersion(detail.version, outcome.version)) return detail;
  return { ...detail, blocked: outcome.blocked, version: outcome.version };
}

export function leadDetailHref(leadId: string): string {
  return `${screenPaths.leads}/${encodeURIComponent(leadId)}`;
}

export function primaryAddress(addresses: readonly LeadAddress[] | undefined): LeadAddress | undefined {
  return addresses?.find((address) => address.primary);
}

function present(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function areaParts(area: LeadArea | undefined): string[] {
  if (!area) return [];
  const city = present(area.city);
  const state = present(area.state);
  const place = city && state ? `${city}/${state}` : city || state;
  return [present(area.district), place].filter(Boolean);
}

export const AREA_SEPARATOR = " · ";

export function areaLine(area: LeadArea | undefined): string {
  return areaParts(area).join(AREA_SEPARATOR);
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function calendarDateOf(value: string): Date | null {
  const match = CALENDAR_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const sameDay = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return sameDay ? date : null;
}

export function instantOf(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function streetLine(address: Pick<LeadAddress, "street" | "number" | "complement">): string {
  return [address.street, address.number, address.complement].map(present).filter(Boolean).join(", ");
}
