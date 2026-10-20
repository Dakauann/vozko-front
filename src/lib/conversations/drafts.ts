import type { ConversationMessage, MediaType } from "./types";

export type ReplyTarget = Pick<ConversationMessage, "id" | "sender_name" | "from" | "text" | "media_type">;

export interface DraftAttachment {
  mediaId: string;
  type: MediaType;
  name: string;
  size: number;
}

export interface ConversationDraft {
  text: string;
  reply?: ReplyTarget;
  attachments: DraftAttachment[];
}

export interface DraftScope {
  workspaceId: string;
  userId: string;
}

export type DraftKind = "message" | "note";

export type DraftStoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export type DraftChangeListener = (entryKey: string | null) => void;

export interface DraftStore {
  read: (scope: DraftScope, entryKey: string, kind?: DraftKind) => ConversationDraft | null;
  write: (scope: DraftScope, entryKey: string, draft: ConversationDraft, kind?: DraftKind) => void;
  clear: (scope: DraftScope, entryKey: string, kind?: DraftKind) => void;
  clearUser: (userId: string) => void;
  subscribe: (listener: DraftChangeListener) => () => void;
}

const KEY_PREFIX = "crm-draft:v1";
const MEDIA_TYPES: readonly MediaType[] = ["image", "video", "audio", "document", "sticker"];

function userPrefix(userId: string): string {
  return `${KEY_PREFIX}:${userId}:`;
}

function storageKey(scope: DraftScope, entryKey: string, kind: DraftKind): string {
  const entry = kind === "note" ? `note:${entryKey}` : entryKey;
  return `${userPrefix(scope.userId)}${scope.workspaceId}:${entry}`;
}

export function isEmptyDraft(draft: ConversationDraft): boolean {
  return !draft.text.trim() && !draft.reply && draft.attachments.length === 0;
}

export function draftPreview(draft: ConversationDraft | null): string | null {
  if (!draft) return null;
  const text = draft.text.replace(/\s+/g, " ").trim();
  if (text) return text;
  return draft.attachments[0]?.name ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMediaType(value: unknown): value is MediaType {
  return typeof value === "string" && (MEDIA_TYPES as readonly string[]).includes(value);
}

function parseAttachment(value: unknown): DraftAttachment | null {
  if (!isRecord(value)) return null;
  const { mediaId, type, name, size } = value;
  if (typeof mediaId !== "string" || !mediaId || !isMediaType(type)) return null;
  if (typeof name !== "string" || typeof size !== "number") return null;
  return { mediaId, type, name, size };
}

function parseReply(value: unknown): ReplyTarget | null {
  if (!isRecord(value)) return null;
  const { id, sender_name, from, text, media_type } = value;
  if (typeof id !== "string" || !id) return null;
  if (typeof sender_name !== "string" || typeof from !== "string" || typeof text !== "string") return null;
  if (media_type !== undefined && !isMediaType(media_type)) return null;
  return media_type ? { id, sender_name, from, text, media_type } : { id, sender_name, from, text };
}

function parseDraft(raw: string): ConversationDraft | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.text !== "string" || !Array.isArray(value.attachments)) return null;
  const attachments = value.attachments.map(parseAttachment);
  if (attachments.some((attachment) => attachment === null)) return null;
  const reply = value.reply === undefined ? undefined : parseReply(value.reply);
  if (reply === null) return null;
  const draft: ConversationDraft = { text: value.text, attachments: attachments as DraftAttachment[] };
  if (reply) draft.reply = reply;
  return isEmptyDraft(draft) ? null : draft;
}

function keysWithPrefix(storage: DraftStoragePort, prefix: string): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

export function createDraftStore(storage: DraftStoragePort | null): DraftStore {
  const listeners = new Set<DraftChangeListener>();
  const notify = (entryKey: string | null) => listeners.forEach((listener) => listener(entryKey));

  const read = (scope: DraftScope, entryKey: string, kind: DraftKind = "message"): ConversationDraft | null => {
    try {
      const raw = storage?.getItem(storageKey(scope, entryKey, kind));
      return raw ? parseDraft(raw) : null;
    } catch {
      return null;
    }
  };

  const clear = (scope: DraftScope, entryKey: string, kind: DraftKind = "message") => {
    try {
      storage?.removeItem(storageKey(scope, entryKey, kind));
    } catch {
      return;
    }
    notify(entryKey);
  };

  const write = (scope: DraftScope, entryKey: string, draft: ConversationDraft, kind: DraftKind = "message") => {
    if (isEmptyDraft(draft)) {
      clear(scope, entryKey, kind);
      return;
    }
    try {
      storage?.setItem(storageKey(scope, entryKey, kind), JSON.stringify(draft));
    } catch {
      return;
    }
    notify(entryKey);
  };

  const clearUser = (userId: string) => {
    try {
      if (!storage) return;
      keysWithPrefix(storage, userPrefix(userId)).forEach((key) => storage.removeItem(key));
    } catch {
      return;
    }
    notify(null);
  };

  const subscribe = (listener: DraftChangeListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { read, write, clear, clearUser, subscribe };
}
