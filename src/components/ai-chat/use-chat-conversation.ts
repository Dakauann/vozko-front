"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { createChatThreadAction } from "@/app/actions/aichat";
import { chatStreams } from "@/lib/aichat/chat-stream";
import { editorProjectOf } from "@/lib/aichat/editor-view";
import type { Approval, ChatAttachment, ChatMode, ChatThread, ChatView } from "@/lib/aichat/types";
import { forgetActiveThread, readActiveThread, rememberActiveThread } from "@/lib/aichat/active-thread";
import { expireOpen, isOpenProposal } from "@/lib/aichat/proposal";
import { newClientId } from "@/lib/aichat/queue";
import { threadPlace } from "@/lib/aichat/thread-list";
import { chatTurns, IDLE_TURN } from "@/lib/aichat/turn-store";
import type { UIMessage } from "@/lib/aichat/ui-message";

import { learnProject, openThread, queueMessage, refreshThread, startTurn, stopTurn, takeQueued, unqueueMessage, type TurnStart } from "./chat-turns";
import { useScreenStop } from "./screen-bridge";
import { useProjectOpenedNotice } from "./use-project-opened";

interface Options {
  view?: ChatView;
  mode?: ChatMode;
  reasoning?: string;
  rememberKey?: string;
  createError: string;
  onThreadCreated?: (thread: ChatThread) => void;
  onTurnFinished?: () => void;
}

function emptyReply(model: string, createdAt: string): UIMessage {
  return { id: `a-${createdAt}`, role: "assistant", content: "", model, createdAt, segments: [] };
}

function expireProposals(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => (m.pending ? { ...m, pending: expireOpen(m.pending) } : m));
}

function awaitsApproval(threadId: string): boolean {
  return chatTurns.snapshot(threadId).messages.some((m) => isOpenProposal(m.pending));
}

const OTHER_PROJECT = "thread_other_project";

function openProjectOf(view: ChatView | undefined): string | undefined {
  return editorProjectOf(view);
}

function belongsElsewhere(threadId: string, openProject: string | undefined): boolean {
  return threadPlace(chatTurns.snapshot(threadId).projectId, openProject) === "other_project";
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

export function useChatConversation({ view, mode, reasoning, rememberKey, createError, onThreadCreated, onTurnFinished }: Options) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const turn = useSyncExternalStore(
    chatTurns.subscribe,
    () => chatTurns.snapshot(activeId),
    () => IDLE_TURN,
  );
  const { messages, queued, streaming } = turn;
  const openProject = openProjectOf(view);
  const otherProject = threadPlace(turn.projectId, openProject) === "other_project";
  useProjectOpenedNotice(activeId, view, mode, turn.projectId);

  const refuseElsewhere = useCallback(
    (threadId: string) => {
      if (!belongsElsewhere(threadId, openProject)) return false;
      setLocalError(OTHER_PROJECT);
      return true;
    },
    [openProject],
  );

  const startHere = useCallback(
    async (threadId: string, start: TurnStart) => {
      if (openProject && !chatTurns.snapshot(threadId).projectId) chatTurns.bindProject(threadId, openProject);
      await startTurn(threadId, start);
      if (chatTurns.snapshot(threadId).error === OTHER_PROJECT) await learnProject(threadId);
    },
    [openProject],
  );

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
      setLocalError(null);
      if (activeId && refuseElsewhere(activeId)) return;
      const now = new Date().toISOString();

      if (activeId && (chatTurns.isStreaming(activeId) || awaitsApproval(activeId))) {
        const result = await queueMessage(activeId, { clientId: newClientId(), content: text, attachments, createdAt: now });
        if (result.outcome === "queued") return;
        if (result.outcome === "failed") {
          setLocalError(result.error);
          return;
        }
        await chatTurns.whenIdle(activeId);
      }

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

      const moved = takeQueued(threadId);
      await startHere(threadId, {
        request: chatStreams.send(threadId, { content: text, model, reasoning, view, attachments: attachments.map((a) => a.mediaId), mode }),
        open: (prev) => [
          ...expireProposals(prev),
          ...moved,
          { id: `u-${now}`, role: "user", content: text, attachments, createdAt: now },
          emptyReply(model, now),
        ],
      });
    },
    [activeId, view, mode, reasoning, createError, onThreadCreated, remember, refuseElsewhere, startHere],
  );

  const resolveAction = useCallback(
    async (actionId: string, kind: "approve" | "reject", model: string, approval?: Approval) => {
      if (!activeId || chatTurns.isStreaming(activeId) || refuseElsewhere(activeId)) return;
      const threadId = activeId;
      const status = kind === "approve" ? "approved" : "rejected";
      const approved = chatTurns.snapshot(threadId).messages.find((m) => m.pending?.id === actionId)?.pending ?? undefined;
      chatTurns.update(threadId, (prev) => prev.map((m) => (m.pending?.id === actionId ? { ...m, pending: { ...m.pending, status } } : m)));
      if (kind === "approve") {
        const now = new Date().toISOString();
        await startHere(threadId, {
          request: chatStreams.approve(threadId, actionId, { ...approval, view, mode }),
          open: (prev) => [...prev, emptyReply(model, now)],
          approved,
        });
        return;
      }
      await startHere(threadId, { request: chatStreams.reject(threadId, actionId, { view, mode }), open: (prev) => prev });
      await refreshThread(threadId);
    },
    [activeId, view, mode, refuseElsewhere, startHere],
  );

  const sendQueued = useCallback(
    async (model: string) => {
      if (!activeId || !model || chatTurns.isStreaming(activeId) || refuseElsewhere(activeId)) return;
      const threadId = activeId;
      const moved = takeQueued(threadId);
      if (moved.length === 0) return;
      setLocalError(null);
      const now = new Date().toISOString();
      await startHere(threadId, {
        request: chatStreams.send(threadId, { content: "", model, reasoning, view, mode }),
        open: (prev) => [...expireProposals(prev), ...moved, emptyReply(model, now)],
      });
    },
    [activeId, view, mode, reasoning, refuseElsewhere, startHere],
  );

  const unqueue = useCallback(
    async (clientId: string) => {
      if (!activeId) return;
      const failure = await unqueueMessage(activeId, clientId);
      if (failure) setLocalError(failure);
    },
    [activeId],
  );

  return {
    activeId,
    messages,
    queued,
    awaitingApproval: messages.some((m) => isOpenProposal(m.pending)),
    otherProject,
    sendQueued,
    unqueue,
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
