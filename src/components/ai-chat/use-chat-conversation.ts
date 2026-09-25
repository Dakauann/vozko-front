"use client";

import { useCallback, useState } from "react";

import { createChatThreadAction, getChatMessagesAction } from "@/app/actions/aichat";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { ChatChart, ChatThread, ChatView, PendingAction } from "@/lib/aichat/types";

import { hydrate, type Segment, type UIMessage } from "./message-list";

interface Options {
  view?: ChatView;
  createError: string;
  onThreadCreated?: (thread: ChatThread) => void;
  onTurnFinished?: () => void;
}

export function useChatConversation({ view, createError, onThreadCreated, onTurnFinished }: Options) {
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
        segments: (m.segments ?? []).map((s) =>
          s.kind === "thinking" || s.kind === "text" ? { ...s, streaming: false } : s,
        ),
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
      onTool: (name: string, summary: string, ok: boolean) =>
        patchSegments((segs) => [...segs, { kind: "tool", name, summary, ok }]),
      onChart: (chart: ChatChart) => patchSegments((segs) => [...segs, { kind: "chart", chart }]),
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
      onError: (msg: string) => setError(msg),
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

  const selectThread = useCallback(async (id: string) => {
    setActiveId(id);
    setError(null);
    setLoadingThread(true);
    const { data } = await getChatMessagesAction(id);
    setMessages((data?.items ?? []).map(hydrate));
    setLoadingThread(false);
  }, []);

  const newChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setError(null);
  }, []);

  const ask = useCallback(
    async (content: string, model: string) => {
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
        onThreadCreated?.(data);
      }

      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { id: `u-${now}`, role: "user", content: text, createdAt: now },
        { id: `a-${now}`, role: "assistant", content: "", model, createdAt: now, segments: [] },
      ]);
      await send(threadId, text, model, streamHandlers(), view);
    },
    [streaming, activeId, send, streamHandlers, view, createError, onThreadCreated],
  );

  const resolveAction = useCallback(
    async (actionId: string, kind: "approve" | "reject", model: string) => {
      if (!activeId) return;
      const threadId = activeId;
      patchLastAssistant((m) => (m.pending?.id === actionId ? { ...m, pending: null } : m));
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
    [activeId, approve, reject, patchLastAssistant, streamHandlers, reload, onTurnFinished],
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
