import { describe, expect, it } from "vitest";

import {
  applyToolCallsPage,
  emptyToolCalls,
  latestAutomationMessageId,
  needsOlderToolCalls,
  nextToolCallsPage,
  readToolCall,
  toolCallOutcome,
  visibleToolCalls,
  type AgentToolCall,
} from "./agent-tool-calls";
import type { ConversationMessage } from "./types";

function call(overrides: Partial<AgentToolCall> = {}): AgentToolCall {
  return {
    id: "c1",
    entryId: "e1",
    entryType: "whatsapp",
    agentId: "ag1",
    toolName: "run_workflow_wf-1",
    outcome: "ok",
    durationMs: 120,
    createdAt: "2026-10-19T10:00:00Z",
    ...overrides,
  };
}

describe("readToolCall", () => {
  it("reads the backend record and drops what the timeline cannot place", () => {
    expect(
      readToolCall({
        id: "c1",
        entryId: "e1",
        entryType: "whatsapp",
        agentId: "ag1",
        toolName: "run_workflow_wf-1",
        outcome: "ok",
        durationMs: 120,
        runId: "r1",
        workflowId: "wf-1",
        createdAt: "2026-10-19T10:00:00Z",
        args: { cpf: "••••12" },
      }),
    ).toEqual(call({ runId: "r1", workflowId: "wf-1" }));
    expect(readToolCall({ ...call(), createdAt: "nope" })).toBeNull();
    expect(readToolCall({ ...call(), id: "" })).toBeNull();
    expect(readToolCall({ ...call(), outcome: "weird" })).toBeNull();
    expect(readToolCall(null)).toBeNull();
  });

  it("keeps the tool call id the history row shares, and leaves it out on older records", () => {
    expect(readToolCall({ ...call(), toolCallId: "call_abc" })?.toolCallId).toBe("call_abc");
    expect(readToolCall(call())).not.toHaveProperty("toolCallId");
  });

  it("keeps the error text of a failed call", () => {
    expect(readToolCall({ ...call(), outcome: "error", error: "workflow inativo", errorCode: "workflow_not_active" })).toMatchObject({
      outcome: "error",
      error: "workflow inativo",
      errorCode: "workflow_not_active",
    });
  });
});

describe("tool call pages", () => {
  it("merges pages oldest first, dedupes by id and remembers the last page read", () => {
    const first = applyToolCallsPage(emptyToolCalls, {
      calls: [call({ id: "c3", createdAt: "2026-10-19T12:00:00Z" }), call({ id: "c2", createdAt: "2026-10-19T11:00:00Z" })],
      page: 1,
      totalPages: 2,
    });
    const second = applyToolCallsPage(first, {
      calls: [call({ id: "c2", createdAt: "2026-10-19T11:00:00Z" }), call({ id: "c1" })],
      page: 2,
      totalPages: 2,
    });
    expect(second.calls.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(nextToolCallsPage(first)).toBe(2);
    expect(nextToolCallsPage(second)).toBeNull();
  });

  it("keeps the deepest page read when the first page is read again for new calls", () => {
    const deep = applyToolCallsPage(emptyToolCalls, { calls: [call({ id: "c1" })], page: 3, totalPages: 3 });
    const refreshed = applyToolCallsPage(deep, { calls: [call({ id: "c9", createdAt: "2026-10-19T13:00:00Z" })], page: 1, totalPages: 3 });
    expect(refreshed.page).toBe(3);
    expect(refreshed.calls.map((c) => c.id)).toEqual(["c1", "c9"]);
  });

  it("asks for older calls only while they may still sit inside the loaded messages", () => {
    const state = applyToolCallsPage(emptyToolCalls, { calls: [call({ createdAt: "2026-10-19T10:00:00Z" })], page: 1, totalPages: 2 });
    expect(needsOlderToolCalls(state, "2026-10-19T09:00:00Z")).toBe(true);
    expect(needsOlderToolCalls(state, "2026-10-19T11:00:00Z")).toBe(false);
    expect(needsOlderToolCalls(state, null)).toBe(true);
    expect(needsOlderToolCalls(emptyToolCalls, null)).toBe(false);
    const done = applyToolCallsPage(emptyToolCalls, { calls: [call()], page: 1, totalPages: 1 });
    expect(needsOlderToolCalls(done, "2026-10-19T09:00:00Z")).toBe(false);
  });

  it("shows only the calls inside the loaded message range", () => {
    const calls = [call({ id: "a", createdAt: "2026-10-19T08:00:00Z" }), call({ id: "b", createdAt: "2026-10-19T10:00:00Z" })];
    expect(visibleToolCalls(calls, { from: "2026-10-19T09:00:00Z", until: null }).map((c) => c.id)).toEqual(["b"]);
    expect(visibleToolCalls(calls, { from: null, until: null })).toBe(calls);
  });
});

describe("readToolCall workflow", () => {
  it("takes the workflow from the backend record, never from the tool name", () => {
    expect(readToolCall({ ...call({ toolName: "run_workflow_6f1c" }), runId: "r1" })?.workflowId).toBeUndefined();
    expect(readToolCall({ ...call(), runId: "r1", workflowId: "wf-9" })?.workflowId).toBe("wf-9");
  });
});

describe("toolCallOutcome", () => {
  it("says a run started when Executar fluxo returned a run", () => {
    expect(toolCallOutcome(call({ runId: "r1" }))).toBe("runStarted");
  });

  it("keeps the recorded outcome otherwise", () => {
    expect(toolCallOutcome(call())).toBe("ok");
    expect(toolCallOutcome(call({ outcome: "error", runId: "r1" }))).toBe("error");
    expect(toolCallOutcome(call({ outcome: "requested" }))).toBe("requested");
  });
});

describe("latestAutomationMessageId", () => {
  function message(id: string, kind?: string): ConversationMessage {
    return { id, sent_by: kind ? { kind, id: "x" } : undefined } as unknown as ConversationMessage;
  }

  it("is the newest message an agent or a workflow sent, so new tool calls are read once per automated reply", () => {
    expect(latestAutomationMessageId([message("1", "ai"), message("2", "workflow"), message("3", "contact"), message("4", "human")])).toBe("2");
    expect(latestAutomationMessageId([message("1", "contact")])).toBeNull();
  });
});
