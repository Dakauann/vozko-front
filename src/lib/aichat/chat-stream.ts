import { fetchWithRefresh, getApiBaseUrl, scopeHeaders } from "@/lib/api/browser-client";
import { announceDataChanged } from "@/lib/aichat/data-changed";
import { deliveredFromPayload, queuedFromPayload, type QueuedMessage } from "@/lib/aichat/queue";
import type { Retraction } from "@/lib/aichat/retract";
import { isScreenCommand, isScreenGo, type ScreenCommand, type ScreenGo } from "@/lib/aichat/screen";
import { browserTimezone } from "@/lib/working-hours/types";
import type { ActionCard, Approval, ChatChart, ChatMedia, ChatMode, ChatStreamEvent, ChatView, PendingAction, ToolSubject } from "@/lib/aichat/types";

export const CHAT_STREAM_ERRORS = ["reply_failed", "session_expired", "request_failed", "network_failed", "provider_unreachable", "provider_busy", "thread_other_project", "model_without_tools", "model_catalog_unavailable", "reasoning_level_unsupported"] as const;

type ChatStreamError = (typeof CHAT_STREAM_ERRORS)[number];

export function isChatStreamError(value: string): value is ChatStreamError {
  return (CHAT_STREAM_ERRORS as readonly string[]).includes(value);
}

interface ChatStreamFailure {
  code: ChatStreamError;
  minutes: number;
}

const WAIT_SEPARATOR = "@";

export function providerBusyError(retryAfterSeconds: unknown): string {
  const minutes = typeof retryAfterSeconds === "number" && retryAfterSeconds > 0 ? Math.ceil(retryAfterSeconds / 60) : 0;
  return minutes > 0 ? `provider_busy${WAIT_SEPARATOR}${minutes}` : "provider_busy";
}

export function readChatStreamError(value: string): ChatStreamFailure | null {
  const [code, wait] = value.split(WAIT_SEPARATOR);
  if (!isChatStreamError(code)) return null;
  const minutes = Number.parseInt(wait ?? "", 10);
  return { code, minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 0 };
}

function streamFailure(code: string | undefined, retryAfterSeconds: unknown): string | null {
  if (code === "provider_busy") return providerBusyError(retryAfterSeconds);
  return code && isChatStreamError(code) ? code : null;
}

export interface StreamHandlers {
  onDelta?: (text: string) => void;
  onReasoning?: (text: string) => void;
  onReasoningDone?: () => void;
  onRetry?: (retraction: Retraction) => void;
  onToolStart?: (name: string) => void;
  onTool?: (name: string, summary: string, ok: boolean, subject?: ToolSubject) => void;
  onChart?: (chart: ChatChart) => void;
  onCard?: (card: ActionCard) => void;
  onImage?: (image: ChatMedia) => void;
  onProposal?: (action: PendingAction) => void;
  onAwaitingApproval?: (actionId: string) => void;
  onScreenCommand?: (command: ScreenCommand) => void;
  onScreenGo?: (signal: ScreenGo) => void;
  onQueued?: (item: QueuedMessage) => void;
  onUnqueued?: (clientId: string) => void;
  onDelivered?: (items: QueuedMessage[]) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export function dispatchStreamEvent(ev: ChatStreamEvent, h: StreamHandlers) {
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
    case "assistant_retry":
      h.onRetry?.({ text: p.text ?? "", reasoning: p.reasoning ?? "" });
      break;
    case "tool":
      h.onTool?.(p.name ?? "", p.summary ?? "", !!p.ok, p.subject);
      if (p.changed) announceDataChanged(p.changed);
      break;
    case "tool_start":
      h.onToolStart?.(p.name ?? "");
      break;
    case "chart":
      if (ev.payload) h.onChart?.(ev.payload as unknown as ChatChart);
      break;
    case "action_card":
      if (ev.payload) h.onCard?.(ev.payload as unknown as ActionCard);
      break;
    case "image":
      if (ev.payload) h.onImage?.(ev.payload as unknown as ChatMedia);
      break;
    case "tool_proposal":
      h.onProposal?.({ id: p.id ?? "", toolName: p.toolName ?? "", args: p.args, summary: p.summary, fields: p.fields, preview: p.preview, secrets: p.secrets, choices: p.choices });
      break;
    case "awaiting_approval":
      h.onAwaitingApproval?.(p.actionId ?? "");
      break;
    case "screen_command":
      if (isScreenCommand(ev.payload)) h.onScreenCommand?.(ev.payload);
      break;
    case "screen_go":
      if (isScreenGo(ev.payload)) h.onScreenGo?.(ev.payload);
      break;
    case "queued": {
      const item = queuedFromPayload(ev.payload);
      if (item) h.onQueued?.(item);
      break;
    }
    case "unqueued":
      if (p.clientId) h.onUnqueued?.(p.clientId);
      break;
    case "delivered":
      h.onDelivered?.(deliveredFromPayload(ev.payload));
      break;
    case "done":
      h.onDone?.();
      break;
    case "error":
      h.onError?.(streamFailure(p.code, p.retryAfterSeconds) ?? p.error ?? "reply_failed");
      break;
  }
}

export interface ChatStreamRequest {
  url: string;
  method: "GET" | "POST";
  body?: unknown;
  quietWhenMissing?: boolean;
}

export type StreamOutcome = "finished" | "detached" | "aborted" | "failed" | "missing";

interface SendBody {
  content: string;
  model: string;
  reasoning?: string;
  view?: ChatView;
  attachments?: string[];
  mode?: ChatMode;
}

interface TurnContext {
  view?: ChatView;
  mode?: ChatMode;
}

interface ApproveBody extends Approval, TurnContext {}

const TERMINAL_EVENTS: ReadonlySet<ChatStreamEvent["type"]> = new Set(["done", "error", "awaiting_approval"]);

const QUEUE_EVENTS: ReadonlySet<ChatStreamEvent["type"]> = new Set(["queued", "unqueued"]);

function threadPath(threadId: string): string {
  return `${getApiBaseUrl()}/chat/threads/${encodeURIComponent(threadId)}`;
}

export const chatStreams = {
  send: (threadId: string, body: SendBody): ChatStreamRequest => ({
    url: `${threadPath(threadId)}/messages`,
    method: "POST",
    body: { ...body, attachments: body.attachments ?? [], timezone: browserTimezone() },
  }),
  approve: (threadId: string, actionId: string, body: ApproveBody): ChatStreamRequest => ({
    url: `${threadPath(threadId)}/actions/${encodeURIComponent(actionId)}/approve`,
    method: "POST",
    body,
  }),
  reject: (threadId: string, actionId: string, body: TurnContext = {}): ChatStreamRequest => ({
    url: `${threadPath(threadId)}/actions/${encodeURIComponent(actionId)}/reject`,
    method: "POST",
    body,
  }),
  observe: (threadId: string): ChatStreamRequest => ({
    url: `${threadPath(threadId)}/turn/events`,
    method: "GET",
    quietWhenMissing: true,
  }),
};

async function failureMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.code === "string" && isChatStreamError(body.code)) return body.code;
    return body?.message || body?.error || "request_failed";
  } catch {
    return "request_failed";
  }
}

function frameEvent(frame: string): ChatStreamEvent | null {
  const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
  if (!dataLine) return null;
  const raw = dataLine.slice(5).trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChatStreamEvent;
  } catch {
    return null;
  }
}

export async function readChatStream(request: ChatStreamRequest, handlers: StreamHandlers, signal: AbortSignal): Promise<StreamOutcome> {
  let opened = false;
  try {
    const res = await fetchWithRefresh(() =>
      fetch(request.url, {
        method: request.method,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...scopeHeaders() },
        body: request.method === "POST" ? JSON.stringify(request.body ?? {}) : undefined,
        signal,
      }),
    );
    if (res.status === 404 && request.quietWhenMissing) return "missing";
    if (res.status === 401) {
      handlers.onError?.("session_expired");
      return "failed";
    }
    if (!res.ok || !res.body) {
      handlers.onError?.(await failureMessage(res));
      return "failed";
    }

    opened = true;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let ended = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const ev = frameEvent(buffer.slice(0, sep));
        buffer = buffer.slice(sep + 2);
        if (!ev) continue;
        dispatchStreamEvent(ev, handlers);
        if (TERMINAL_EVENTS.has(ev.type)) ended = true;
        else if (!QUEUE_EVENTS.has(ev.type)) ended = false;
      }
    }
    return ended ? "finished" : "detached";
  } catch (e) {
    const err = e as Error;
    if (err?.name === "AbortError" || signal.aborted) return "aborted";
    if (opened) return "detached";
    handlers.onError?.("network_failed");
    return "failed";
  }
}
