import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentToolCall } from "@/lib/conversations/agent-tool-calls";

import { useConversationToolCalls } from "./use-conversation-tool-calls";

const actions = vi.hoisted(() => ({ listConversationToolCallsAction: vi.fn() }));
vi.mock("@/app/actions/conversations", () => actions);

function call(id: string, createdAt: string): AgentToolCall {
  return { id, entryId: "e1", entryType: "whatsapp", agentId: "a1", toolName: "run_workflow", outcome: "ok", durationMs: 3, createdAt };
}

function page(calls: AgentToolCall[], pageNumber = 1, totalPages = 1) {
  return { page: { calls, page: pageNumber, totalPages } };
}

const refused = { page: null, error: "Não foi possível carregar as chamadas de ferramenta.", code: "tool_calls_failed", status: 500 };

describe("useConversationToolCalls", () => {
  beforeEach(() => {
    actions.listConversationToolCallsAction.mockReset();
  });

  it("returns the recorded calls with no failure when the read succeeds", async () => {
    actions.listConversationToolCallsAction.mockResolvedValue(page([call("c1", "2026-10-20T10:00:00Z")]));
    const { result } = renderHook(() => useConversationToolCalls("e1", "whatsapp", null, null));
    await waitFor(() => expect(result.current.calls.map((entry) => entry.id)).toEqual(["c1"]));
    expect(result.current.failure).toBeNull();
  });

  it("reports a refused read with its code instead of looking like a conversation without tool calls", async () => {
    actions.listConversationToolCallsAction.mockResolvedValue(refused);
    const { result } = renderHook(() => useConversationToolCalls("e1", "whatsapp", null, null));
    await waitFor(() => expect(result.current.failure).toEqual({ message: refused.error, code: "tool_calls_failed", status: 500 }));
    expect(result.current.calls).toEqual([]);
  });

  it("reports a read that never answered, with no code", async () => {
    actions.listConversationToolCallsAction.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useConversationToolCalls("e1", "whatsapp", null, null));
    await waitFor(() => expect(result.current.failure).toEqual({}));
  });

  it("reads the page again on retry and clears the failure once it answers", async () => {
    actions.listConversationToolCallsAction.mockResolvedValueOnce(refused).mockResolvedValueOnce(page([call("c1", "2026-10-20T10:00:00Z")]));
    const { result } = renderHook(() => useConversationToolCalls("e1", "whatsapp", null, null));
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.calls.map((entry) => entry.id)).toEqual(["c1"]));
    expect(result.current.failure).toBeNull();
    expect(actions.listConversationToolCallsAction).toHaveBeenCalledTimes(2);
  });

  it("retries a failed older page, which is otherwise never asked for twice", async () => {
    actions.listConversationToolCallsAction
      .mockResolvedValueOnce(page([call("c2", "2026-10-20T10:00:00Z")], 1, 2))
      .mockResolvedValueOnce(refused)
      .mockResolvedValueOnce(page([call("c1", "2026-10-19T10:00:00Z")], 2, 2));
    const { result } = renderHook(() => useConversationToolCalls("e1", "whatsapp", "2026-10-19T09:00:00Z", null));
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    expect(actions.listConversationToolCallsAction).toHaveBeenLastCalledWith("whatsapp", "e1", { page: 2, pageSize: 50 });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.calls.map((entry) => entry.id)).toEqual(["c1", "c2"]));
    expect(result.current.failure).toBeNull();
  });

  it("forgets the failure of another conversation", async () => {
    actions.listConversationToolCallsAction.mockResolvedValueOnce(refused).mockResolvedValue(page([]));
    const { result, rerender } = renderHook(({ entryId }) => useConversationToolCalls(entryId, "whatsapp", null, null), { initialProps: { entryId: "e1" } });
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    rerender({ entryId: "e2" });
    expect(result.current.failure).toBeNull();
  });
});
