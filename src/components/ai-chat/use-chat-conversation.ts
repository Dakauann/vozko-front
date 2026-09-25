"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createChatThreadAction, getChatMessagesAction } from "@/app/actions/aichat";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { ActionCard, ChatAttachment, ChatChart, ChatThread, ChatView, PendingAction } from "@/lib/aichat/types";

import { forgetActiveThread, readActiveThread, rememberActiveThread } from "@/lib/aichat/active-thread";
import { expireOpen } from "@/lib/aichat/proposal";

import { hydrate, type UIMessage } from "./message-list";
import { finishTool, startTool, type Segment } from "./segments";

interface Options {
  view?: ChatView;
  rememberKey?: string;
  createError: string;
  onThreadCreated?: (thread: ChatThread) => void;
  onTurnFinished?: () => void;
}

export function useChatConversation({ view, rememberKey, createError, onThreadCreated, onTurnFinished }: Options) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const { streaming, send, approve, reject, stop } = useChatStream();

  const patchLastAssistant = useCallback((fn: (m: UIMessage) => UIMessage) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "assistant") {
          next[i] = fn(next[i]);
          break;
        }
      }
      return next;
    });
  }, []);

  const patchSegments = useCallback(
    (fn: (segs: Segment[]) => Segment[]) =>
      patchLastAssistant((m) => ({ ...m, segments: fn(m.segments ?? []) })),
    [patchLastAssistant],
  );

  const finalizeStreaming = useCallback(
    () =>
      patchLastAssistant((m) => ({
        ...m,
        segments: (m.segments ?? []).map((s) => {
          if (s.kind === "thinking" || s.kind === "text") return { ...s, streaming: false };
          if (s.kind === "tool" && s.running) return { ...s, running: false };
          return s;
        }),
      })),
    [patchLastAssistant],
  );

  const streamHandlers = useCallback(
    () => ({
      onReasoning: (text: string) =>
        patchSegments((segs) => {
          const last = segs[segs.length - 1];
          if (last && last.kind === "thinking" && last.streaming) {
            return [...segs.slice(0, -1), { ...last, text: last.text + text }];
          }
          return [...segs, { kind: "thinking", text, streaming: true }];
        }),
      onReasoningDone: () =>
        patchSegments((segs) => {
          const last = segs[segs.length - 1];
          if (last && last.kind === "thinking" && last.streaming) {
            return [...segs.slice(0, -1), { ...last, streaming: false }];
          }
          return segs;
        }),
      onToolStart: (name: string) => patchSegments((segs) => startTool(segs, name)),
      onTool: (name: string, summary: string, ok: boolean) =>
        patchSegments((segs) => finishTool(segs, name, summary, ok)),
      onChart: (chart: ChatChart) => patchSegments((segs) => [...segs, { kind: "chart", chart }]),
      onCard: (card: ActionCard) => patchSegments((segs) => [...segs, { kind: "card", card }]),
      onDelta: (text: string) =>
        patchSegments((segs) => {
          const last = segs[segs.length - 1];
          if (last && last.kind === "text" && last.streaming) {
            return [...segs.slice(0, -1), { ...last, text: last.text + text }];
          }
          return [...segs, { kind: "text", text, streaming: true }];
        }),
      onProposal: (action: PendingAction) => patchLastAssistant((m) => ({ ...m, pending: action })),
      onAwaitingApproval: () => finalizeStreaming(),
      onError: (msg: string) => {
        finalizeStreaming();
        setError(msg);
      },
      onDone: () => {
        finalizeStreaming();
        onTurnFinished?.();
      },
    }),
    [patchSegments, patchLastAssistant, finalizeStreaming, onTurnFinished],
  );

  const reload = useCallback(async (threadId: string) => {
    const { data } = await getChatMessagesAction(threadId);
    if (data) setMessages(data.items.map(hydrate));
  }, []);

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
      setError(null);
      setLoadingThread(true);
      const { data } = await getChatMessagesAction(id);
      setLoadingThread(false);
      if (!data) {
        setActiveId(null);
        setMessages([]);
        remember(null);
        return;
      }
      setMessages(data.items.map(hydrate));
      remember(id);
    },
    [remember],
  );

  const newChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setError(null);
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
      if (!text || streaming || !model) return;
      setError(null);

      let threadId = activeId;
      if (!threadId) {
        const { data, error: createErr } = await createChatThreadAction(model);
        if (!data) {
          setError(createErr ?? createError);
          return;
        }
        threadId = data.id;
        setActiveId(threadId);
        remember(threadId);
        onThreadCreated?.(data);
      }

      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev.map((m) => (m.pending ? { ...m, pending: expireOpen(m.pending) } : m)),
        { id: `u-${now}`, role: "user", content: text, attachments, createdAt: now },
        { id: `a-${now}`, role: "assistant", content: "", model, createdAt: now, segments: [] },
      ]);
      await send(threadId, text, model, streamHandlers(), view, attachments.map((a) => a.mediaId));
    },
    [streaming, activeId, send, streamHandlers, view, createError, onThreadCreated, remember],
  );

  const resolveAction = useCallback(
    async (actionId: string, kind: "approve" | "reject", model: string) => {
      if (!activeId) return;
      const threadId = activeId;
      const status = kind === "approve" ? "approved" : "rejected";
      setMessages((prev) =>
        prev.map((m) => (m.pending?.id === actionId ? { ...m, pending: { ...m.pending, status } } : m)),
      );
      if (kind === "approve") {
        const now = new Date().toISOString();
        setMessages((prev) => [
          ...prev,
          { id: `a-${now}`, role: "assistant", content: "", model, createdAt: now, segments: [] },
        ]);
        await approve(threadId, actionId, streamHandlers());
        return;
      }
      await reject(threadId, actionId, {
        onError: (msg) => setError(msg),
        onDone: () => {
          void reload(threadId);
          onTurnFinished?.();
        },
      });
    },
    [activeId, approve, reject, streamHandlers, reload, onTurnFinished],
  );

  return {
    activeId,
    messages,
    error,
    loadingThread,
    streaming,
    stop,
    ask,
    resolveAction,
    selectThread,
    newChat,
  };
}
