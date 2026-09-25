import type { EntryType } from "./types";

export const CONVERSATION_ENTRY_TYPES: readonly EntryType[] = ["whatsapp", "instagram", "telegram", "unofficial_whatsapp"];

const ENTRY_ID = /^[A-Za-z0-9_-]{1,64}$/;

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
  const params = new URLSearchParams({ entry: entryId, type: entryType });
  return `/dashboard/live-chat?${params.toString()}`;
}

export function readConversationDeepLink(search: string): ConversationDeepLink | null {
  const params = new URLSearchParams(search);
  const entryId = params.get("entry") ?? "";
  const entryType = params.get("type") ?? "whatsapp";
  if (!isEntryId(entryId) || !isEntryType(entryType)) return null;
  return { entryId, entryType };
}
