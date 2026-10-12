import type { ChatAttachment } from "./types";
import type { UIMessage } from "./ui-message";

export interface QueuedMessage {
  clientId: string;
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
  id?: string;
}

export function newClientId(): string {
  return crypto.randomUUID();
}

export function addQueued(list: QueuedMessage[], item: QueuedMessage): QueuedMessage[] {
  return list.some((q) => q.clientId === item.clientId) ? list : [...list, item];
}

export function restoreQueued(list: QueuedMessage[], item: QueuedMessage): QueuedMessage[] {
  return [...addQueued(list, item)].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function removeQueued(list: QueuedMessage[], clientId: string): QueuedMessage[] {
  return list.filter((q) => q.clientId !== clientId);
}

export function withoutQueued(list: QueuedMessage[], clientIds: string[]): QueuedMessage[] {
  if (clientIds.length === 0) return list;
  const gone = new Set(clientIds);
  return list.filter((q) => !gone.has(q.clientId));
}

export function queuedAsUser(item: QueuedMessage): UIMessage {
  return {
    id: item.id ?? `q-${item.clientId}`,
    clientId: item.clientId,
    role: "user",
    content: item.content,
    createdAt: item.createdAt,
    ...(item.attachments && item.attachments.length > 0 ? { attachments: item.attachments } : {}),
  };
}

function isAttachment(value: unknown): value is ChatAttachment {
  const a = value as ChatAttachment | null;
  return !!a && typeof a.mediaId === "string" && typeof a.name === "string" && typeof a.kind === "string";
}

export function queuedFromPayload(value: unknown): QueuedMessage | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (typeof p.clientId !== "string" || p.clientId === "") return null;
  const item: QueuedMessage = {
    clientId: p.clientId,
    content: typeof p.content === "string" ? p.content : "",
    createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString(),
  };
  if (typeof p.id === "string" && p.id !== "") item.id = p.id;
  if (Array.isArray(p.attachments)) {
    const attachments = p.attachments.filter(isAttachment);
    if (attachments.length > 0) item.attachments = attachments;
  }
  return item;
}

export function queuedListFrom(value: unknown): QueuedMessage[] {
  if (!Array.isArray(value)) return [];
  return value.map(queuedFromPayload).filter((q): q is QueuedMessage => q !== null);
}

export function deliveredFromPayload(value: unknown): QueuedMessage[] {
  if (!value || typeof value !== "object") return [];
  return queuedListFrom((value as { messages?: unknown }).messages);
}
