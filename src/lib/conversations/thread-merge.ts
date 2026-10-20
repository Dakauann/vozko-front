import type { ConversationMessage, HistoryDirection } from "./types";

export interface ThreadMessages {
  messages: ConversationMessage[];
  has_more: boolean;
  has_after?: boolean;
  total?: number;
  held_live?: ConversationMessage[];
}

export interface HistoryPage {
  direction: HistoryDirection;
  messages: ConversationMessage[];
  has_more: boolean;
  has_after: boolean;
  total?: number;
}

type DeliveryStatus = NonNullable<ConversationMessage["delivery_status"]>;

const DELIVERY_RANK: Record<DeliveryStatus, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

function timeOf(message: ConversationMessage): number {
  const time = Date.parse(message.created_at);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function oldestAt(messages: readonly ConversationMessage[]): number {
  return messages.reduce((oldest, message) => Math.min(oldest, timeOf(message)), Number.POSITIVE_INFINITY);
}

function newestAt(messages: readonly ConversationMessage[]): number {
  return messages.reduce((newest, message) => Math.max(newest, timeOf(message)), Number.NEGATIVE_INFINITY);
}

function laterStatus(held?: DeliveryStatus, incoming?: DeliveryStatus): DeliveryStatus | undefined {
  if (!held) return incoming;
  if (!incoming) return held;
  return DELIVERY_RANK[incoming] >= DELIVERY_RANK[held] ? incoming : held;
}

function freshest(held: ConversationMessage | undefined, incoming: ConversationMessage): ConversationMessage {
  if (!held) return incoming;
  const read = held.read || incoming.read;
  return {
    ...incoming,
    read,
    read_at: incoming.read_at ?? held.read_at,
    delivery_status: laterStatus(held.delivery_status, incoming.delivery_status),
  };
}

export function mergeMessages(
  held: ConversationMessage[],
  incoming: readonly ConversationMessage[],
): ConversationMessage[] {
  if (incoming.length === 0) return held;
  const byId = new Map(held.map((message): [string, ConversationMessage] => [message.id, message]));
  for (const message of incoming) byId.set(message.id, freshest(byId.get(message.id), message));
  return [...byId.values()]
    .map((message, order) => ({ message, order }))
    .sort((a, b) => timeOf(a.message) - timeOf(b.message) || a.order - b.order)
    .map(({ message }) => message);
}

function attach<T extends ThreadMessages>(thread: T): T {
  const { held_live: heldLive, ...rest } = thread;
  return {
    ...rest,
    messages: heldLive ? mergeMessages(thread.messages, heldLive) : thread.messages,
    has_after: false,
  } as T;
}

function park<T extends ThreadMessages>(thread: T, messages: readonly ConversationMessage[]): T {
  return { ...thread, held_live: mergeMessages(thread.held_live ?? [], messages) };
}

function touches(thread: ThreadMessages, page: HistoryPage): boolean {
  return oldestAt(page.messages) <= newestAt(thread.messages);
}

function olderLimit(thread: ThreadMessages, page: HistoryPage): boolean {
  return oldestAt(page.messages) < oldestAt(thread.messages) ? page.has_more : thread.has_more;
}

function replaceWithPresent<T extends ThreadMessages>(thread: T, page: HistoryPage, total?: number): T {
  return attach({ ...thread, messages: page.messages, has_more: page.has_more, total: total ?? thread.total });
}

function applyLatest<T extends ThreadMessages>(thread: T, page: HistoryPage): T {
  const total = page.total ?? thread.total;
  if (thread.messages.length === 0) return replaceWithPresent(thread, page, total);
  if (thread.has_after) return { ...park(thread, page.messages), total };
  if (page.messages.length === 0) return { ...thread, total };
  if (touches(thread, page) || !page.has_more) {
    return { ...thread, messages: mergeMessages(thread.messages, page.messages), has_more: olderLimit(thread, page), total };
  }
  return replaceWithPresent(thread, page, total);
}

function applyBefore<T extends ThreadMessages>(thread: T, page: HistoryPage): T {
  if (thread.messages.length === 0) {
    return { ...thread, messages: page.messages, has_more: page.has_more, has_after: thread.has_after ?? false };
  }
  if (page.messages.length === 0) return { ...thread, has_more: false };
  if (newestAt(page.messages) < oldestAt(thread.messages)) {
    return { ...thread, messages: mergeMessages(thread.messages, page.messages), has_more: page.has_more };
  }
  if (touches(thread, page)) {
    return { ...thread, messages: mergeMessages(thread.messages, page.messages), has_more: olderLimit(thread, page) };
  }
  if (thread.has_after) return park(thread, page.messages);
  return replaceWithPresent(thread, page);
}

function applyAround<T extends ThreadMessages>(thread: T, page: HistoryPage): T {
  const jumped = {
    ...thread,
    messages: page.messages,
    has_more: page.has_more,
    has_after: page.has_after,
    total: page.total ?? thread.total,
  };
  return page.has_after ? jumped : attach(jumped);
}

function applyAfter<T extends ThreadMessages>(thread: T, page: HistoryPage): T {
  if (thread.messages.length > 0 && page.messages.length > 0 && newestAt(page.messages) < oldestAt(thread.messages)) {
    return thread;
  }
  const reachesEnd = newestAt(page.messages) >= newestAt(thread.messages);
  const hasAfter = reachesEnd ? page.has_after : Boolean(thread.has_after);
  const extended = { ...thread, messages: mergeMessages(thread.messages, page.messages), has_after: hasAfter };
  return hasAfter ? extended : attach(extended);
}

export function applyHistoryPage<T extends ThreadMessages>(thread: T, page: HistoryPage): T {
  switch (page.direction) {
    case "latest":
      return applyLatest(thread, page);
    case "before":
      return applyBefore(thread, page);
    case "around":
      return applyAround(thread, page);
    case "after":
      return applyAfter(thread, page);
    default:
      return thread;
  }
}

export function applyLiveMessage<T extends ThreadMessages>(thread: T, message: ConversationMessage): T {
  if (thread.has_after) return park(thread, [message]);
  const messages = mergeMessages(thread.messages, [message]);
  return messages === thread.messages ? thread : { ...thread, messages };
}

function holds(messages: readonly ConversationMessage[] | undefined, id: string): boolean {
  return Boolean(messages?.some((message) => message.id === id));
}

export function applyMessageUpdate<T extends ThreadMessages>(thread: T, message: ConversationMessage): T {
  const inThread = holds(thread.messages, message.id);
  const parked = holds(thread.held_live, message.id);
  if (!inThread && !parked) return thread;
  return {
    ...thread,
    messages: inThread ? mergeMessages(thread.messages, [message]) : thread.messages,
    ...(parked ? { held_live: mergeMessages(thread.held_live ?? [], [message]) } : {}),
  };
}

export function newestMessageAt(thread: ThreadMessages): string | null {
  const newest = thread.messages.reduce<ConversationMessage | null>(
    (latest, message) => (latest === null || timeOf(message) >= timeOf(latest) ? message : latest),
    null,
  );
  return newest?.created_at ?? null;
}

export function foldResent(messages: ConversationMessage[]): ConversationMessage[] {
  const present = new Set(messages.map((message) => message.id));
  const folded = messages.filter((message) => !message.resent_as || !present.has(message.resent_as));
  return folded.length === messages.length ? messages : folded;
}

export function withPendingBubbles(
  messages: ConversationMessage[],
  bubbles: readonly ConversationMessage[],
): ConversationMessage[] {
  if (bubbles.length === 0) return messages;
  const delivered = new Set(messages.map((message) => message.client_request_id).filter(Boolean));
  const waiting = bubbles.filter((bubble) => !delivered.has(bubble.client_request_id));
  return waiting.length === 0 ? messages : [...messages, ...waiting];
}
