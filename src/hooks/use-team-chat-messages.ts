"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { isActionError, type ActionError } from "@/app/actions/action-result";
import {
  deleteTeamChatMessageAction,
  editTeamChatMessageAction,
  listTeamChatMessagesAction,
  markTeamChatReadAction,
  sendTeamChatMessageAction,
} from "@/app/actions/team-chat";
import { subscribeTeamChat, subscribeTeamChatConnection } from "@/lib/team-chat/bus";
import { lastSeq, mergeMessages, missedAfter, pendingAfterDelivery, type PendingMessage } from "@/lib/team-chat/messages";
import type { TeamChatMessage } from "@/lib/team-chat/types";

import { useTeamChatWorkspace } from "./use-team-chat";

const MESSAGE_PAGE = 50;

const CATCH_UP_PAGES = 10;

export interface ThreadMessages {
  messages: TeamChatMessage[];
  pending: PendingMessage[];
  hasOlder: boolean;
  loaded: boolean;
  loadingOlder: boolean;
  failed: boolean;
}

const EMPTY: ThreadMessages = { messages: [], pending: [], hasOlder: false, loaded: false, loadingOlder: false, failed: false };

const store = new Map<string, ThreadMessages>();

const listeners = new Map<string, Set<() => void>>();

const catchingUp = new Set<string>();

function read(key: string): ThreadMessages {
  return store.get(key) ?? EMPTY;
}

function write(key: string, change: (current: ThreadMessages) => ThreadMessages): void {
  const current = read(key);
  const next = change(current);
  if (next === current) return;
  store.set(key, next);
  listeners.get(key)?.forEach((listener) => listener());
}

function arrive(key: string, incoming: TeamChatMessage[]): void {
  write(key, (current) => {
    const messages = mergeMessages(current.messages, incoming);
    return { ...current, messages, pending: pendingAfterDelivery(current.pending, incoming) };
  });
}

function subscribeKey(key: string, listener: () => void): () => void {
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
  };
}

export function forgetTeamChatMessages(): void {
  store.clear();
  catchingUp.clear();
}

async function loadLatest(key: string, threadId: string): Promise<void> {
  const result = await listTeamChatMessagesAction(threadId, { limit: MESSAGE_PAGE });
  if (isActionError(result)) {
    write(key, (current) => ({ ...current, failed: true }));
    return;
  }
  write(key, (current) => ({
    ...current,
    messages: mergeMessages(current.messages, result.data.messages),
    pending: pendingAfterDelivery(current.pending, result.data.messages),
    hasOlder: result.data.has_more,
    loaded: true,
    failed: false,
  }));
}

async function catchUp(key: string, threadId: string): Promise<void> {
  if (catchingUp.has(key)) return;
  catchingUp.add(key);
  try {
    for (let page = 0; page < CATCH_UP_PAGES; page++) {
      const after = lastSeq(read(key).messages);
      const result = await listTeamChatMessagesAction(threadId, { afterSeq: after, limit: MESSAGE_PAGE });
      if (isActionError(result)) return;
      arrive(key, result.data.messages);
      if (!result.data.has_more) return;
    }
  } finally {
    catchingUp.delete(key);
  }
}

export function useTeamChatMessages(threadId: string | null) {
  const workspaceId = useTeamChatWorkspace();
  const key = `${workspaceId}:${threadId ?? ""}`;
  const state = useSyncExternalStore(
    useCallback((listener: () => void) => subscribeKey(key, listener), [key]),
    () => read(key),
    () => EMPTY,
  );

  useEffect(() => {
    if (!threadId || workspaceId === "") return;
    if (read(key).loaded) void catchUp(key, threadId);
    else void loadLatest(key, threadId);
  }, [key, threadId, workspaceId]);

  useEffect(() => {
    if (!threadId) return;
    const leaveEvents = subscribeTeamChat((event) => {
      if (event.payload.thread_id !== threadId) return;
      if (event.type === "team_chat:message") {
        const current = read(key);
        if (!current.loaded) return;
        if (missedAfter(current.messages, event.payload.message) !== null) void catchUp(key, threadId);
        else arrive(key, [event.payload.message]);
      }
      if (event.type === "team_chat:message_updated") arrive(key, [event.payload.message]);
    });
    const leaveConnection = subscribeTeamChatConnection((connected) => {
      if (connected && read(key).loaded) void catchUp(key, threadId);
    });
    return () => {
      leaveEvents();
      leaveConnection();
    };
  }, [key, threadId]);

  const loadOlder = useCallback(async () => {
    const current = read(key);
    if (!threadId || !current.hasOlder || current.loadingOlder || current.messages.length === 0) return;
    write(key, (s) => ({ ...s, loadingOlder: true }));
    const result = await listTeamChatMessagesAction(threadId, { beforeSeq: current.messages[0].seq, limit: MESSAGE_PAGE });
    write(key, (s) =>
      isActionError(result)
        ? { ...s, loadingOlder: false }
        : { ...s, messages: mergeMessages(s.messages, result.data.messages), hasOlder: result.data.has_more, loadingOlder: false },
    );
  }, [key, threadId]);

  const deliver = useCallback(
    async (pending: PendingMessage): Promise<ActionError | null> => {
      if (!threadId) return null;
      const result = await sendTeamChatMessageAction(threadId, {
        body: pending.body,
        mentions: pending.mentions,
        reply_to_id: pending.reply_to_id,
        client_id: pending.client_id,
      });
      if (isActionError(result)) {
        write(key, (s) => ({ ...s, pending: s.pending.map((p) => (p.client_id === pending.client_id ? { ...p, failed: true } : p)) }));
        return result;
      }
      arrive(key, [result.data]);
      return null;
    },
    [key, threadId],
  );

  const send = useCallback(
    (draft: { body: string; mentions: string[]; reply_to_id?: string }) => {
      const pending: PendingMessage = { ...draft, client_id: crypto.randomUUID(), created_at: new Date().toISOString(), failed: false };
      write(key, (s) => ({ ...s, pending: [...s.pending, pending] }));
      return deliver(pending);
    },
    [deliver, key],
  );

  const retry = useCallback(
    (clientId: string) => {
      const pending = read(key).pending.find((p) => p.client_id === clientId);
      if (!pending) return Promise.resolve(null);
      write(key, (s) => ({ ...s, pending: s.pending.map((p) => (p.client_id === clientId ? { ...p, failed: false } : p)) }));
      return deliver(pending);
    },
    [deliver, key],
  );

  const discard = useCallback(
    (clientId: string) => write(key, (s) => ({ ...s, pending: s.pending.filter((p) => p.client_id !== clientId) })),
    [key],
  );

  const edit = useCallback(
    async (messageId: string, body: string): Promise<ActionError | null> => {
      const result = await editTeamChatMessageAction(messageId, body);
      if (isActionError(result)) return result;
      arrive(key, [result.data]);
      return null;
    },
    [key],
  );

  const remove = useCallback(
    async (messageId: string): Promise<ActionError | null> => {
      const result = await deleteTeamChatMessageAction(messageId);
      if (isActionError(result)) return result;
      arrive(key, [result.data]);
      return null;
    },
    [key],
  );

  const markRead = useCallback(
    (seq: number) => {
      if (threadId && seq > 0) void markTeamChatReadAction(threadId, seq);
    },
    [threadId],
  );

  return { ...state, loadOlder, send, retry, discard, edit, remove, markRead };
}
