import { MERCADOLIVRE_BLOCK_SUBSTATUSES } from "@/lib/mercadolivre/window";
import type { EntryType, WindowClosedReason } from "./types";

const WINDOW_CLOSED_REASON_SET: Record<WindowClosedReason, true> = {
  expired: true,
  no_inbound: true,
  contact_blocked: true,
  session_down: true,
  account_restricted: true,
  reply_revoked: true,
  channel_unavailable: true,
  provider_blocked: true,
  budget_exhausted: true,
};

export interface WindowClosedState {
  window_closed_reason: WindowClosedReason | null;
  window_closed_detail: string | null;
}

interface WindowClosedWire {
  window_closed_reason?: unknown;
  window_closed_detail?: unknown;
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export function readWindowClosedReason(value: unknown): WindowClosedReason | null {
  return typeof value === "string" && Object.hasOwn(WINDOW_CLOSED_REASON_SET, value) ? (value as WindowClosedReason) : null;
}

export function readWindowClosed(wire: WindowClosedWire): WindowClosedState {
  return {
    window_closed_reason: readWindowClosedReason(wire.window_closed_reason),
    window_closed_detail: nonEmptyText(wire.window_closed_detail),
  };
}

export function mergeWindowClosed(wire: WindowClosedWire, previous: Partial<WindowClosedState>): WindowClosedState {
  if (nonEmptyText(wire.window_closed_reason) !== null) return readWindowClosed(wire);
  return {
    window_closed_reason: previous.window_closed_reason ?? null,
    window_closed_detail: previous.window_closed_detail ?? null,
  };
}

export const CLOSED_DETAIL_CATALOGS: Partial<Record<EntryType, readonly string[]>> = {
  mercadolivre: MERCADOLIVRE_BLOCK_SUBSTATUSES,
};

export const CHANNEL_UNAVAILABLE_BY_CHANNEL: Partial<Record<EntryType, true>> = {
  whatsapp: true,
  unofficial_whatsapp: true,
  instagram: true,
  facebook: true,
  telegram: true,
  mercadolivre: true,
  tiktok: true,
};

export const CHANNEL_REASON_COPY: Partial<Record<EntryType, readonly WindowClosedReason[]>> = {
  tiktok: ["expired", "budget_exhausted"],
};

function hasChannelReasonCopy(entryType: EntryType, reason: WindowClosedReason): boolean {
  return Object.hasOwn(CHANNEL_REASON_COPY, entryType) && (CHANNEL_REASON_COPY[entryType]?.includes(reason) ?? false);
}

function knownDetail(entryType: EntryType, detail: string | null): string | null {
  if (detail === null || !Object.hasOwn(CLOSED_DETAIL_CATALOGS, entryType)) return null;
  return CLOSED_DETAIL_CATALOGS[entryType]?.includes(detail) ? detail : null;
}

export function windowClosedCopyKey(entryType: EntryType, reason: WindowClosedReason, detail: string | null): string {
  if (reason === "provider_blocked") {
    const known = knownDetail(entryType, detail);
    return known ? `closedDetail.${entryType}.${known}` : "closed.provider_blocked";
  }
  if (reason === "channel_unavailable" && Object.hasOwn(CHANNEL_UNAVAILABLE_BY_CHANNEL, entryType)) {
    return `closedByChannel.${entryType}.channel_unavailable`;
  }
  if (hasChannelReasonCopy(entryType, reason)) {
    return `closedByChannel.${entryType}.${reason}`;
  }
  return `closed.${reason}`;
}
