import { inLoadedRange, olderPageNeeded, type LoadedRange } from "./loaded-range";
import { senderOf } from "./sender";
import type { ConversationMessage } from "./types";

export type AgentToolCallOutcome = "ok" | "error" | "requested";

export interface AgentToolCall {
  id: string;
  entryId: string;
  entryType: string;
  agentId: string;
  toolName: string;
  outcome: AgentToolCallOutcome;
  durationMs: number;
  createdAt: string;
  error?: string;
  errorCode?: string;
  runId?: string;
  workflowId?: string;
  toolCallId?: string;
}

const OUTCOMES: readonly AgentToolCallOutcome[] = ["ok", "error", "requested"];

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function timeOf(iso: string): number {
  return new Date(iso).getTime();
}

export function readToolCall(raw: unknown): AgentToolCall | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const outcome = value.outcome as AgentToolCallOutcome;
  const call: AgentToolCall = {
    id: text(value.id),
    entryId: text(value.entryId),
    entryType: text(value.entryType),
    agentId: text(value.agentId),
    toolName: text(value.toolName),
    outcome,
    durationMs: typeof value.durationMs === "number" ? value.durationMs : 0,
    createdAt: text(value.createdAt),
  };
  const error = optionalText(value.error);
  const errorCode = optionalText(value.errorCode);
  const runId = optionalText(value.runId);
  const workflowId = optionalText(value.workflowId);
  const toolCallId = optionalText(value.toolCallId);
  if (error) call.error = error;
  if (errorCode) call.errorCode = errorCode;
  if (runId) call.runId = runId;
  if (workflowId) call.workflowId = workflowId;
  if (toolCallId) call.toolCallId = toolCallId;
  if (!call.id || !call.toolName || !OUTCOMES.includes(outcome) || Number.isNaN(timeOf(call.createdAt))) return null;
  return call;
}

export interface ToolCallsState {
  calls: AgentToolCall[];
  page: number;
  totalPages: number;
  loaded: boolean;
}

export interface ToolCallsPage {
  calls: AgentToolCall[];
  page: number;
  totalPages: number;
}

export const emptyToolCalls: ToolCallsState = { calls: [], page: 0, totalPages: 0, loaded: false };

export function applyToolCallsPage(state: ToolCallsState, page: ToolCallsPage): ToolCallsState {
  const byId = new Map(state.calls.map((call) => [call.id, call]));
  for (const call of page.calls) byId.set(call.id, call);
  return {
    calls: [...byId.values()].sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt)),
    page: Math.max(state.page, page.page),
    totalPages: page.totalPages,
    loaded: true,
  };
}

export function nextToolCallsPage(state: ToolCallsState): number | null {
  return state.loaded && state.page < state.totalPages ? state.page + 1 : null;
}

export function needsOlderToolCalls(state: ToolCallsState, oldestMessageAt: string | null): boolean {
  if (nextToolCallsPage(state) === null) return false;
  return olderPageNeeded(state.calls[0]?.createdAt ?? null, oldestMessageAt);
}

export function visibleToolCalls(calls: AgentToolCall[], range: LoadedRange): AgentToolCall[] {
  return inLoadedRange(calls, range, (call) => call.createdAt);
}

export type ToolCallOutcomeKey = AgentToolCallOutcome | "runStarted";

export function toolCallOutcome(call: Pick<AgentToolCall, "outcome" | "runId">): ToolCallOutcomeKey {
  return call.outcome === "ok" && call.runId ? "runStarted" : call.outcome;
}

export function latestAutomationMessageId(messages: readonly ConversationMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const kind = senderOf(messages[index])?.kind;
    if (kind === "ai" || kind === "workflow") return messages[index].id;
  }
  return null;
}
