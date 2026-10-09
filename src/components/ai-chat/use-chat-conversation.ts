"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { createChatThreadAction } from "@/app/actions/aichat";
import { chatStreams } from "@/lib/aichat/chat-stream";
import type { Approval, ChatAttachment, ChatMode, ChatThread, ChatView } from "@/lib/aichat/types";
import { forgetActiveThread, readActiveThread, rememberActiveThread } from "@/lib/aichat/active-thread";
import { expireOpen } from "@/lib/aichat/proposal";
import { chatTurns, IDLE_TURN } from "@/lib/aichat/turn-store";
import type { UIMessage } from "@/lib/aichat/ui-message";

import { openThread, refreshThread, startTurn, stopTurn } from "./chat-turns";
import { useScreenStop } from "./screen-bridge";

interface Options {
  view?: ChatView;
  mode?: ChatMode;
  rememberKey?: string;
  createError: string;
  onThreadCreated?: (thread: ChatThread) => void;
  onTurnFinished?: () => void;
}

function emptyReply(model: string, createdAt: string): UIMessage {
  return { id: `a-${createdAt}`, role: "assistant", content: "", model, createdAt, segments: [] };
}

function useTurnFinished(activeId: string | null, streaming: boolean, onTurnFinished?: () => void) {
  const latest = useRef(onTurnFinished);
  const previous = useRef({ activeId, streaming });

  useEffect(() => {
    latest.current = onTurnFinished;
  }, [onTurnFinished]);

  useEffect(() => {
    const before = previous.current;
    previous.current = { activeId, streaming };
    if (before.activeId === activeId && before.streaming && !streaming) latest.current?.();
  }, [activeId, streaming]);
}

export function useChatConversation({ view, mode, rememberKey, createError, onThreadCreated, onTurnFinished }: Options) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const turn = useSyncExternalStore(
    chatTurns.subscribe,
    () => chatTurns.snapshot(activeId),
    () => IDLE_TURN,
  );
  const { messages, streaming } = turn;

  const stop = useCallback(() => {
    if (activeId) void stopTurn(activeId);
  }, [activeId]);
  useScreenStop(stop, streaming);
  useTurnFinished(activeId, streaming, onTurnFinished);

  const remember = useCallback(
    (id: string | null) => {
      if (!rememberKey) return;
      if (id) rememberActiveThread(rememberKey, id);
      else forgetActiveThread(rememberKey);
    },
    [rememberKey],
  );

  const selectThread = useCallback(
    async (id: string) => {
      setActiveId(id);
      setLocalError(null);
      setLoadingThread(true);
      const opened = await openThread(id);
      setLoadingThread(false);
      if (opened === "missing") {
        setActiveId(null);
        remember(null);
        return;
      }
      remember(id);
    },
    [remember],
  );

  const newChat = useCallback(() => {
    setActiveId(null);
    setLocalError(null);
    remember(null);
  }, [remember]);

  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (!rememberKey || restored.current === rememberKey) return;
    restored.current = rememberKey;
    const stored = readActiveThread(rememberKey);
    if (stored) queueMicrotask(() => void selectThread(stored));
  }, [rememberKey, selectThread]);

  const ask = useCallback(
    async (content: string, model: string, attachments: ChatAttachment[] = []) => {
      const text = content.trim();
      if (!text || !model) return;
      if (activeId && chatTurns.isStreaming(activeId)) return;
      setLocalError(null);

      let threadId = activeId;
      if (!threadId) {
        const { data, error: createErr } = await createChatThreadAction(model);
        if (!data) {
          setLocalError(createErr ?? createError);
          return;
        }
        threadId = data.id;
        setActiveId(threadId);
        remember(threadId);
        onThreadCreated?.(data);
      }

      const now = new Date().toISOString();
      await startTurn(threadId, {
        request: chatStreams.send(threadId, { content: text, model, view, attachments: attachments.map((a) => a.mediaId), mode }),
        open: (prev) => [
          ...prev.map((m) => (m.pending ? { ...m, pending: expireOpen(m.pending) } : m)),
          { id: `u-${now}`, role: "user", content: text, attachments, createdAt: now },
          emptyReply(model, now),
        ],
      });
    },
    [activeId, view, mode, createError, onThreadCreated, remember],
  );

  const resolveAction = useCallback(
    async (actionId: string, kind: "approve" | "reject", model: string, approval?: Approval) => {
      if (!activeId || chatTurns.isStreaming(activeId)) return;
      const threadId = activeId;
      const status = kind === "approve" ? "approved" : "rejected";
      const approved = chatTurns.snapshot(threadId).messages.find((m) => m.pending?.id === actionId)?.pending ?? undefined;
      chatTurns.update(threadId, (prev) => prev.map((m) => (m.pending?.id === actionId ? { ...m, pending: { ...m.pending, status } } : m)));
      if (kind === "approve") {
        const now = new Date().toISOString();
        await startTurn(threadId, {
          request: chatStreams.approve(threadId, actionId, { ...approval, view, mode }),
          open: (prev) => [...prev, emptyReply(model, now)],
          approved,
        });
        return;
      }
      await startTurn(threadId, { request: chatStreams.reject(threadId, actionId), open: (prev) => prev });
      await refreshThread(threadId);
    },
    [activeId, view, mode],
  );

  return {
    activeId,
    messages,
    error: localError ?? turn.error,
    loadingThread,
    streaming,
    stop,
    ask,
    resolveAction,
    selectThread,
    newChat,
  };
}
