"use client";

import { useCallback, useRef, useState } from "react";

import { fetchWithRefresh, getApiBaseUrl, scopeHeaders } from "@/lib/api/browser-client";
import type { ChatStreamEvent, PendingAction } from "@/lib/aichat/types";

const API_BASE = getApiBaseUrl();

export interface StreamHandlers {
  onDelta?: (text: string) => void;
  onReasoning?: (text: string) => void;
  onReasoningDone?: () => void;
  onTool?: (name: string, summary: string, ok: boolean) => void;
  onProposal?: (action: PendingAction) => void;
  onAwaitingApproval?: (actionId: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

function dispatch(ev: ChatStreamEvent, h: StreamHandlers) {
  const p = ev.payload ?? {};
  switch (ev.type) {
    case "assistant_delta":
      if (p.text) h.onDelta?.(p.text);
      break;
    case "reasoning_delta":
      if (p.text) h.onReasoning?.(p.text);
      break;
    case "reasoning_done":
      h.onReasoningDone?.();
      break;
    case "tool":
      h.onTool?.(p.name ?? "", p.summary ?? "", !!p.ok);
      break;
    case "tool_proposal":
      h.onProposal?.({ id: p.id ?? "", toolName: p.toolName ?? "", args: p.args, summary: p.summary });
      break;
    case "awaiting_approval":
      h.onAwaitingApproval?.(p.actionId ?? "");
      break;
    case "done":
      h.onDone?.();
      break;
    case "error":
      h.onError?.(p.error ?? "Erro ao gerar resposta");
      break;
    // "iteration" / "assistant_done" are progress-only and ignored by the UI.
  }
}

/**
 * useChatStream consumes the copilot SSE protocol (POST + text/event-stream).
 * Native EventSource can't send auth headers, so we use fetch + ReadableStream.
 * send() streams a turn; approve()/reject() resolve a pending mutation; stop()
 * aborts the in-flight fetch.
 */
export function useChatStream() {
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runStream = useCallback(
    async (url: string, body: unknown, handlers: StreamHandlers) => {
      setStreaming(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        // Auth rides the httpOnly cookie (credentials: "include"); the browser
        // attaches it on the SSE POST. On a 401 we refresh once and retry.
        const doFetch = () =>
          fetch(url, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...scopeHeaders(),
            },
            body: JSON.stringify(body),
            signal: ctrl.signal,
          });

        // Shared auth behavior: on a 401 this refreshes once and retries; if the
        // refresh fails it broadcasts session-expired and returns the 401.
        const res = await fetchWithRefresh(doFetch);
        if (res.status === 401) {
          handlers.onError?.("Sessão expirada. Faça login novamente.");
          return;
        }
        if (!res.ok || !res.body) {
          // Gate failures (402/403/404) arrive as a JSON error, not a stream.
          let msg = `Erro ${res.status}`;
          try {
            const j = await res.json();
            msg = j?.message || j?.error || msg;
          } catch {
            /* keep default */
          }
          handlers.onError?.(msg);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const raw = dataLine.slice(5).trim();
            if (!raw) continue;
            let ev: ChatStreamEvent;
            try {
              ev = JSON.parse(raw) as ChatStreamEvent;
            } catch {
              continue;
            }
            dispatch(ev, handlers);
          }
        }
      } catch (e) {
        const err = e as Error;
        if (err?.name !== "AbortError") {
          handlers.onError?.(err?.message ?? "Erro de rede");
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [],
  );

  const send = useCallback(
    (threadId: string, content: string, model: string, handlers: StreamHandlers) =>
      runStream(`${API_BASE}/chat/threads/${threadId}/messages`, { content, model }, handlers),
    [runStream],
  );

  const approve = useCallback(
    (threadId: string, actionId: string, handlers: StreamHandlers) =>
      runStream(`${API_BASE}/chat/threads/${threadId}/actions/${actionId}/approve`, {}, handlers),
    [runStream],
  );

  const reject = useCallback(
    (threadId: string, actionId: string, handlers: StreamHandlers) =>
      runStream(`${API_BASE}/chat/threads/${threadId}/actions/${actionId}/reject`, {}, handlers),
    [runStream],
  );

  return { streaming, send, approve, reject, stop };
}
