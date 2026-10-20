import type { ThreadMessages } from "./thread-merge";
import type { ConversationMessage } from "./types";

export const THREAD_CACHE_CAPACITY = 10;
export const CACHED_MESSAGE_LIMIT = 150;

export interface CachedThread {
  messages: ConversationMessage[];
  has_more: boolean;
  total?: number;
}

export interface ThreadCache {
  scope: string;
  threads: ReadonlyMap<string, CachedThread>;
}

export const emptyThreadCache: ThreadCache = { scope: "", threads: new Map() };

function inScope(cache: ThreadCache, scope: string): ThreadCache {
  return cache.scope === scope ? cache : { scope, threads: new Map() };
}

function snapshot(thread: ThreadMessages): CachedThread {
  const trimmed = thread.messages.length > CACHED_MESSAGE_LIMIT;
  return {
    messages: trimmed ? thread.messages.slice(-CACHED_MESSAGE_LIMIT) : thread.messages,
    has_more: trimmed || thread.has_more,
    ...(thread.total !== undefined ? { total: thread.total } : {}),
  };
}

export function rememberThread(cache: ThreadCache, scope: string, key: string, thread: ThreadMessages): ThreadCache {
  if (thread.has_after || thread.messages.length === 0) return cache;
  const threads = new Map(inScope(cache, scope).threads);
  threads.delete(key);
  threads.set(key, snapshot(thread));
  while (threads.size > THREAD_CACHE_CAPACITY) {
    const oldest = threads.keys().next().value as string;
    threads.delete(oldest);
  }
  return { scope, threads };
}

export function recallThread(
  cache: ThreadCache,
  scope: string,
  key: string,
): { cache: ThreadCache; thread: CachedThread | null } {
  const thread = cache.scope === scope ? cache.threads.get(key) : undefined;
  if (!thread) return { cache, thread: null };
  const threads = new Map(cache.threads);
  threads.delete(key);
  threads.set(key, thread);
  return { cache: { scope, threads }, thread };
}

export function holdsThread(cache: ThreadCache, scope: string, key: string): boolean {
  return cache.scope === scope && cache.threads.has(key);
}
