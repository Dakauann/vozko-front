import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  listTeamChatMessagesAction: vi.fn(),
  sendTeamChatMessageAction: vi.fn(),
  editTeamChatMessageAction: vi.fn(),
  deleteTeamChatMessageAction: vi.fn(),
  markTeamChatReadAction: vi.fn(),
}));

vi.mock("@/app/actions/team-chat", () => actions);
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u-me" } }) }));

import { emitTeamChat, emitTeamChatConnection } from "@/lib/team-chat/bus";
import type { TeamChatMessage } from "@/lib/team-chat/types";

import { forgetTeamChatMessages, useTeamChatMessages } from "./use-team-chat-messages";

function message(seq: number, overrides: Partial<TeamChatMessage> = {}): TeamChatMessage {
  return {
    id: `m-${seq}`,
    thread_id: "t-1",
    seq,
    author_id: "u-bia",
    author_name: "Bia",
    kind: "text",
    body: `oi ${seq}`,
    subject_ids: [],
    mentions: [],
    created_at: "2026-10-19T12:00:00Z",
    ...overrides,
  };
}

const page = (messages: TeamChatMessage[], hasMore = false) => Promise.resolve({ data: { messages, has_more: hasMore } });

beforeEach(() => {
  vi.clearAllMocks();
  actions.listTeamChatMessagesAction.mockImplementation((_id: string, window: { afterSeq?: number }) =>
    window.afterSeq ? page([message(window.afterSeq + 1), message(window.afterSeq + 2)]) : page([message(1), message(2)]),
  );
});

afterEach(() => forgetTeamChatMessages());

const seqs = (messages: TeamChatMessage[]) => messages.map((m) => m.seq);

describe("useTeamChatMessages", () => {
  it("loads the latest page, then appends live arrivals in order", async () => {
    const { result } = renderHook(() => useTeamChatMessages("t-1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => emitTeamChat({ type: "team_chat:message", payload: { thread_id: "t-1", message: message(3) } }));
    expect(seqs(result.current.messages)).toEqual([1, 2, 3]);
  });

  it("catches up after a gap instead of showing a hole", async () => {
    const { result } = renderHook(() => useTeamChatMessages("t-1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => emitTeamChat({ type: "team_chat:message", payload: { thread_id: "t-1", message: message(5) } }));
    await waitFor(() => expect(seqs(result.current.messages)).toEqual([1, 2, 3, 4]));
    expect(actions.listTeamChatMessagesAction).toHaveBeenLastCalledWith("t-1", { afterSeq: 2, limit: 50 });
  });

  it("catches up when the socket comes back", async () => {
    const { result } = renderHook(() => useTeamChatMessages("t-1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => emitTeamChatConnection(true));
    await waitFor(() => expect(seqs(result.current.messages)).toEqual([1, 2, 3, 4]));
  });

  it("retries a failed send with the same client id, so the server never stores it twice", async () => {
    actions.sendTeamChatMessageAction.mockResolvedValueOnce({ error: "offline" });
    actions.sendTeamChatMessageAction.mockImplementation((_id: string, draft: { client_id: string }) =>
      Promise.resolve({ data: message(3, { author_id: "u-me", client_id: draft.client_id, body: "oi" }) }),
    );
    const { result } = renderHook(() => useTeamChatMessages("t-1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.send({ body: "oi", mentions: [] });
    });
    expect(result.current.pending).toHaveLength(1);
    expect(result.current.pending[0].failed).toBe(true);

    const clientId = result.current.pending[0].client_id;
    await act(async () => {
      await result.current.retry(clientId);
    });
    expect(actions.sendTeamChatMessageAction.mock.calls.map((call) => call[1].client_id)).toEqual([clientId, clientId]);
    expect(result.current.pending).toHaveLength(0);
    expect(seqs(result.current.messages)).toEqual([1, 2, 3]);
  });
});
