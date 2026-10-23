import type { EntryType } from "./types";

const CONVERSATION_ENTRY_TYPE_SET: Record<EntryType, true> = {
  whatsapp: true,
  instagram: true,
  facebook: true,
  telegram: true,
  unofficial_whatsapp: true,
  webchat: true,
  mercadolivre: true,
  tiktok: true,
  email: true,
  rcs: true,
  sms: true,
};

const CONVERSATION_ENTRY_TYPES = Object.keys(CONVERSATION_ENTRY_TYPE_SET) as readonly EntryType[];

const ENTRY_ID = /^[A-Za-z0-9_-]{1,64}$/;

const ENTRY_PARAM = "entry";
const TYPE_PARAM = "type";

export interface ConversationDeepLink {
  entryId: string;
  entryType: EntryType;
}

export function isEntryType(value: string): value is EntryType {
  return (CONVERSATION_ENTRY_TYPES as readonly string[]).includes(value);
}

export function isEntryId(value: string): boolean {
  return ENTRY_ID.test(value);
}

export function conversationHref(entryId: string, entryType: EntryType): string {
  const params = new URLSearchParams({ [ENTRY_PARAM]: entryId, [TYPE_PARAM]: entryType });
  return `/dashboard/live-chat?${params.toString()}`;
}

export function sameConversation(a: ConversationDeepLink | null, b: ConversationDeepLink | null): boolean {
  if (!a || !b) return a === b;
  return a.entryId === b.entryId && a.entryType === b.entryType;
}

export function withConversationDeepLink(search: string, link: ConversationDeepLink | null): string {
  const params = new URLSearchParams(search);
  params.delete(ENTRY_PARAM);
  params.delete(TYPE_PARAM);
  if (link) {
    params.set(ENTRY_PARAM, link.entryId);
    params.set(TYPE_PARAM, link.entryType);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function readConversationDeepLink(search: string): ConversationDeepLink | null {
  const params = new URLSearchParams(search);
  const entryId = params.get(ENTRY_PARAM) ?? "";
  const entryType = params.get(TYPE_PARAM) ?? "";
  if (!isEntryId(entryId) || !isEntryType(entryType)) return null;
  return { entryId, entryType };
}

export interface ConversationHistoryStep {
  previous: ConversationDeepLink | null;
  current: ConversationDeepLink | null;
  inUrl: ConversationDeepLink | null;
}

export function needsHistoryEntry({ previous, current, inUrl }: ConversationHistoryStep): boolean {
  return !sameConversation(previous, current) && !sameConversation(current, inUrl);
}
