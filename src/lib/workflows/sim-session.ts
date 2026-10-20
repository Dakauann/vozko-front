import type { ConversationMessage } from "@/lib/conversations/types";

import { payloadRecord as record, simConversationMessage } from "./sim-message";
import type { WorkflowRunLog } from "./types";

export type SimStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "confirming"
  | "waiting_trigger"
  | "running"
  | "paused"
  | "waiting_reply"
  | "waiting_form"
  | "waiting_key"
  | "completed"
  | "error"
  | "cancelled";

export interface SimStep extends WorkflowRunLog {
  stepIndex: number;
  pinned?: boolean;
}

export type SimPauseReason = "breakpoint" | "run_until" | "step";

export interface SimPause {
  nodeId: string;
  nodeType: string;
  stepIndex: number;
  reason: SimPauseReason | string;
  state: Record<string, unknown>;
}

export interface SimReproducing {
  runId: string;
  workflowVersion?: number;
  pinnedNodes: string[];
}

export interface SimRefusal {
  command: string;
  error: string;
}

export type SimCancelReason = "cancelled" | "paused_timeout" | "start_timeout";

const NAMED_CANCEL_REASONS: ReadonlySet<string> = new Set<SimCancelReason>(["paused_timeout", "start_timeout"]);

export interface SimFormWait {
  nodeId: string;
  formId: string;
}

export interface SimMessageEvent {
  type: "message";
  direction: "outbound" | "inbound";
  text: string;
  msgType: string;
  nodeId?: string;
  messageId: string;
  audioBase64?: string;
  audioMime?: string;
  audioUrl?: string;
  message?: ConversationMessage;
}

export type SimEvent =
  | SimMessageEvent
  | { type: "step"; step: SimStep }
  | { type: "paused"; pause: SimPause }
  | { type: "waiting_reply"; nodeId: string; timeoutSeconds: number }
  | { type: "reply_ignored"; nodeId: string }
  | { type: "waiting_form"; nodeId: string; formId: string; timeoutSeconds: number }
  | { type: "waiting_key"; timeoutSeconds: number }
  | { type: "call_transferred"; queueId: string; queueName: string; notes?: string }
  | { type: "error"; message: string };

export interface SimSession {
  status: SimStatus;
  events: SimEvent[];
  steps: SimStep[];
  stateVars: Record<string, unknown>;
  currentNodeId: string | null;
  pause: SimPause | null;
  realCallNodes: string[];
  triggerType: string | null;
  runId: string | null;
  reproducing: SimReproducing | null;
  refusal: SimRefusal | null;
  cancelReason: SimCancelReason | null;
  waitingForm: SimFormWait | null;
}

export interface SimServerMessage {
  type: string;
  payload?: unknown;
}

export type SimIntent =
  | { kind: "confirming" }
  | { kind: "dismissed" }
  | { kind: "start_sent"; reproduceRunId?: string }
  | { kind: "resumed" }
  | { kind: "replied" }
  | { kind: "key"; key: string; messageId: string }
  | { kind: "cancelled" }
  | { kind: "closed" }
  | { kind: "failed" };

const LIVE_STATUSES: ReadonlySet<SimStatus> = new Set([
  "connecting",
  "ready",
  "confirming",
  "waiting_trigger",
  "running",
  "paused",
  "waiting_reply",
  "waiting_form",
  "waiting_key",
]);

export function isLiveSimStatus(status: SimStatus): boolean {
  return LIVE_STATUSES.has(status);
}

export const SIM_EVENT_WINDOW = 80;

export function simEventWindowStart(total: number, limit: number): number {
  return Math.max(0, total - limit);
}

export function initialSimSession(): SimSession {
  return {
    status: "idle",
    events: [],
    steps: [],
    stateVars: {},
    currentNodeId: null,
    pause: null,
    realCallNodes: [],
    triggerType: null,
    runId: null,
    reproducing: null,
    refusal: null,
    cancelReason: null,
    waitingForm: null,
  };
}

export function connectingSimSession(): SimSession {
  return { ...initialSimSession(), status: "connecting" };
}

export function simulationUrl(base: string, workflowId: string, workspaceId: string): string {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspace_id", workspaceId);
  params.set("await_start", "1");
  return `${base}/ws/workflows/${encodeURIComponent(workflowId)}/simulate?${params.toString()}`;
}

export function simCommand(type: string, data?: Record<string, unknown>): string {
  return JSON.stringify(data === undefined ? { type } : { type, data });
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function vars(payload: unknown, fallback: Record<string, unknown>): Record<string, unknown> {
  const value = record(payload).vars;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : fallback;
}

function reproducingOf(value: unknown): SimReproducing | null {
  const data = record(value);
  const runId = text(data.runId);
  if (!runId) return null;
  return {
    runId,
    ...(typeof data.workflowVersion === "number" ? { workflowVersion: data.workflowVersion } : {}),
    pinnedNodes: stringList(data.pinnedNodes),
  };
}

function errorText(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload) return payload;
  return text(record(payload).error) || fallback;
}

function withEvent(session: SimSession, event: SimEvent, patch: Partial<SimSession> = {}): SimSession {
  return { ...session, ...patch, events: [...session.events, event] };
}

const UNKNOWN_ERROR = "Erro desconhecido";

export function applySimMessage(session: SimSession, message: SimServerMessage): SimSession {
  const data = record(message.payload);
  switch (message.type) {
    case "sim_ready":
      return {
        ...session,
        status: "ready",
        realCallNodes: stringList(data.realCallNodes),
        triggerType: text(data.triggerType) || null,
      };
    case "waiting_trigger":
      return { ...session, status: "waiting_trigger", refusal: null };
    case "sim_started":
      return {
        ...session,
        status: "running",
        runId: text(data.runId) || null,
        realCallNodes: stringList(data.realCallNodes),
        reproducing: reproducingOf(data.reproducing),
        refusal: null,
      };
    case "node_executed": {
      const step = { ...(data as unknown as SimStep) };
      return withEvent(session, { type: "step", step }, {
        steps: [...session.steps, step],
        currentNodeId: step.nodeId,
        status: session.status === "paused" ? "running" : session.status,
      });
    }
    case "paused": {
      const pause: SimPause = {
        nodeId: text(data.nodeId),
        nodeType: text(data.nodeType),
        stepIndex: typeof data.stepIndex === "number" ? data.stepIndex : session.steps.length,
        reason: text(data.reason),
        state: record(data.state),
      };
      return withEvent(session, { type: "paused", pause }, {
        status: "paused",
        pause,
        stateVars: pause.state,
        currentNodeId: pause.nodeId,
      });
    }
    case "command_refused": {
      const refusal = { command: text(data.command), error: text(data.error) };
      const startRefused = refusal.command === "reproduce_run" || refusal.command === "start";
      return {
        ...session,
        refusal,
        ...(startRefused ? { status: "ready" as const, reproducing: null } : {}),
      };
    }
    case "message_sent":
      return withEvent(session, {
        type: "message",
        direction: data.direction === "inbound" ? "inbound" : "outbound",
        text: text(data.text),
        msgType: text(data.msgType),
        nodeId: text(data.nodeId) || undefined,
        messageId: text(data.messageId),
        audioBase64: text(data.audioBase64) || undefined,
        audioMime: text(data.audioMime) || undefined,
        audioUrl: text(data.audioUrl) || undefined,
        message: simConversationMessage(data.message),
      });
    case "message_received": {
      const message = simConversationMessage(data.message);
      if (!message) return session;
      return withEvent(session, {
        type: "message",
        direction: "inbound",
        text: message.text,
        msgType: message.message_type,
        messageId: message.id,
        message,
      });
    }
    case "reply_ignored": {
      const nodeId = text(data.nodeId);
      return withEvent(session, { type: "reply_ignored", nodeId }, { status: "waiting_reply", currentNodeId: nodeId || session.currentNodeId });
    }
    case "waiting_reply": {
      const nodeId = text(data.nodeId);
      const timeoutSeconds = typeof data.timeoutSeconds === "number" ? data.timeoutSeconds : 0;
      return withEvent(session, { type: "waiting_reply", nodeId, timeoutSeconds }, { status: "waiting_reply", currentNodeId: nodeId });
    }
    case "waiting_form": {
      const nodeId = text(data.nodeId);
      const formId = text(data.formId);
      if (!formId) return session;
      const timeoutSeconds = typeof data.timeoutSeconds === "number" ? data.timeoutSeconds : 0;
      return withEvent(session, { type: "waiting_form", nodeId, formId, timeoutSeconds }, {
        status: "waiting_form",
        currentNodeId: nodeId || session.currentNodeId,
        waitingForm: { nodeId, formId },
      });
    }
    case "waiting_key": {
      const timeoutSeconds = typeof data.timeoutSeconds === "number" ? data.timeoutSeconds : 0;
      return withEvent(session, { type: "waiting_key", timeoutSeconds }, { status: "waiting_key" });
    }
    case "call_transferred":
      return withEvent(session, {
        type: "call_transferred",
        queueId: text(data.queueId),
        queueName: text(data.queueName),
        notes: text(data.notes) || undefined,
      });
    case "state_update":
      return { ...session, stateVars: vars(message.payload, session.stateVars) };
    case "run_completed":
      return { ...session, status: "completed", pause: null, stateVars: vars(message.payload, session.stateVars) };
    case "run_cancelled":
      return {
        ...session,
        status: "cancelled",
        pause: null,
        waitingForm: null,
        cancelReason: typeof data.reason === "string" && NAMED_CANCEL_REASONS.has(data.reason) ? (data.reason as SimCancelReason) : "cancelled",
      };
    case "run_error":
      return withEvent(session, { type: "error", message: errorText(message.payload, UNKNOWN_ERROR) }, { status: "error", pause: null });
    case "error":
      return withEvent(session, { type: "error", message: errorText(message.payload, UNKNOWN_ERROR) }, { status: "error", pause: null });
    default:
      return session;
  }
}

export function applySimIntent(session: SimSession, intent: SimIntent): SimSession {
  switch (intent.kind) {
    case "confirming":
      return { ...session, status: "confirming" };
    case "dismissed":
      return session.status === "confirming" ? { ...session, status: "ready" } : session;
    case "start_sent":
      return { ...session, status: "running", refusal: null };
    case "resumed":
      return session.status === "paused" ? { ...session, status: "running", pause: null, refusal: null } : session;
    case "replied":
      return { ...session, status: "running", waitingForm: null };
    case "key":
      return withEvent(
        session,
        { type: "message", direction: "inbound", text: intent.key, msgType: "key", messageId: intent.messageId },
        { status: session.status === "waiting_key" ? "running" : session.status },
      );
    case "cancelled":
      return { ...session, status: "cancelled", pause: null, cancelReason: "cancelled" };
    case "closed":
      return isLiveSimStatus(session.status) ? { ...session, status: "error", pause: null } : session;
    case "failed":
      return { ...session, status: "error", pause: null };
  }
}
