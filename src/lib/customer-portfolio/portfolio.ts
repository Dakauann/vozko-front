import type { CodedRefusal } from "@/lib/api/coded-error";
import { isCount, isJson, isText, type Json } from "@/lib/json/guards";
import { formatPhoneForDisplay } from "@/lib/phone/display";

const HELD_BY_OTHER = "customer_portfolio_held_by_other";

export type PortfolioContactChannel = "unofficial_whatsapp" | "telegram" | "instagram" | "facebook" | "webchat" | "mercadolivre" | "tiktok" | "email" | "rcs" | "sms";

export type PortfolioSubject =
  | { kind: "lead"; leadId: string }
  | { kind: "contact"; contactType: PortfolioContactChannel; contactId: string };

export interface PortfolioEntry {
  id: string;
  holderId: string;
  holderName?: string;
  addedBy?: string;
  subject: PortfolioSubject;
  addedAt: string;
  updatedAt: string;
}

export interface PortfolioHolding {
  subject: PortfolioSubject;
  entry: PortfolioEntry | null;
}

export interface PortfolioDisplay {
  channel?: PortfolioContactChannel;
  name?: string;
  handle?: string;
  number?: string;
  avatarUrl?: string;
}

export interface PortfolioRow {
  id: string;
  holderId: string;
  holderName?: string;
  holderReceives: boolean;
  addedBy?: string;
  addedByName?: string;
  subject: PortfolioSubject;
  display: PortfolioDisplay;
  addedAt: string;
  updatedAt: string;
}

export interface PortfolioPage {
  items: PortfolioRow[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export type PortfolioHolderScope = { kind: "mine" } | { kind: "all" } | { kind: "member"; userId: string };

type HoldingState = "free" | "mine" | "other";

interface HeldByOther {
  entryId: string;
  holderId: string;
  holderName: string;
}

const CONTACT_CHANNEL_SET: Record<PortfolioContactChannel, true> = {
  unofficial_whatsapp: true,
  telegram: true,
  instagram: true,
  facebook: true,
  webchat: true,
  mercadolivre: true,
  tiktok: true,
  email: true,
  rcs: true,
  sms: true,
};
const CONTACT_CHANNELS: readonly string[] = Object.keys(CONTACT_CHANNEL_SET);

function isContactChannel(value: unknown): value is PortfolioContactChannel {
  return typeof value === "string" && CONTACT_CHANNELS.includes(value);
}

function texts<K extends string>(value: Json, keys: readonly K[]): Partial<Record<K, string>> {
  const found: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const text = value[key];
    if (isText(text)) found[key] = text;
  }
  return found;
}

function parseSubject(value: unknown): PortfolioSubject | null {
  if (!isJson(value)) return null;
  if (value.kind === "lead" && isText(value.leadId)) return { kind: "lead", leadId: value.leadId };
  if (value.kind === "contact" && isContactChannel(value.contactType) && isText(value.contactId)) {
    return { kind: "contact", contactType: value.contactType, contactId: value.contactId };
  }
  return null;
}

function parseEntry(value: unknown): PortfolioEntry | null {
  if (!isJson(value) || !isText(value.id) || !isText(value.holderId) || !isText(value.addedAt) || !isText(value.updatedAt)) return null;
  const subject = parseSubject(value.subject);
  if (!subject) return null;
  return {
    id: value.id,
    holderId: value.holderId,
    subject,
    addedAt: value.addedAt,
    updatedAt: value.updatedAt,
    ...texts(value, ["holderName", "addedBy"] as const),
  };
}

export function parsePortfolioHolding(value: unknown): PortfolioHolding | null {
  if (!isJson(value) || !("entry" in value)) return null;
  const subject = parseSubject(value.subject);
  if (!subject) return null;
  if (value.entry === null) return { subject, entry: null };
  const entry = parseEntry(value.entry);
  return entry ? { subject, entry } : null;
}

function parseDisplay(value: unknown): PortfolioDisplay | null {
  if (!isJson(value)) return null;
  return {
    ...(isContactChannel(value.channel) ? { channel: value.channel } : {}),
    ...texts(value, ["name", "handle", "number", "avatarUrl"] as const),
  };
}

function parseRow(value: unknown): PortfolioRow | null {
  if (!isJson(value) || !isText(value.id) || !isText(value.holderId) || typeof value.holderReceives !== "boolean") return null;
  if (!isText(value.addedAt) || !isText(value.updatedAt)) return null;
  const subject = parseSubject(value.subject);
  const display = parseDisplay(value.display);
  if (!subject || !display) return null;
  return {
    id: value.id,
    holderId: value.holderId,
    holderReceives: value.holderReceives,
    subject,
    display,
    addedAt: value.addedAt,
    updatedAt: value.updatedAt,
    ...texts(value, ["holderName", "addedBy", "addedByName"] as const),
  };
}

export function parsePortfolioPage(value: unknown): PortfolioPage | null {
  if (!isJson(value) || !Array.isArray(value.data) || !isJson(value.meta)) return null;
  const items = value.data.map(parseRow);
  if (items.some((item) => item === null)) return null;
  const { page, pageSize, totalPages, totalItems } = value.meta;
  if (!isCount(page) || !isCount(pageSize) || !isCount(totalPages) || !isCount(totalItems)) return null;
  return { items: items as PortfolioRow[], page, pageSize, totalPages, totalItems };
}

export function holdingState(holding: PortfolioHolding, userId: string): HoldingState {
  if (!holding.entry) return "free";
  return holding.entry.holderId === userId ? "mine" : "other";
}

export function heldByOther(error: CodedRefusal): HeldByOther | null {
  const expected = error.expected;
  if (error.code !== HELD_BY_OTHER || !expected || !isText(expected.entryId) || !isText(expected.holderId)) return null;
  return { entryId: expected.entryId, holderId: expected.holderId, holderName: expected.holderName ?? "" };
}

export function holderParam(scope: PortfolioHolderScope): string | null {
  switch (scope.kind) {
    case "mine":
      return null;
    case "all":
      return "all";
    case "member":
      return scope.userId;
  }
}

export function customerLines(row: Pick<PortfolioRow, "display">): { primary: string; secondary: string } {
  const { name, handle, number } = row.display;
  const phone = number ? formatPhoneForDisplay(number) : "";
  const tag = handle ? `@${handle}` : "";
  if (name) return { primary: name, secondary: [tag, phone].filter(Boolean).join(" · ") };
  if (tag) return { primary: tag, secondary: phone };
  return { primary: phone, secondary: "" };
}
