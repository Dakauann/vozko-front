import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { activeThreadKey } from "@/lib/aichat/active-thread";
import type { ChatStreamRequest, StreamHandlers, StreamOutcome } from "@/lib/aichat/chat-stream";
import type { ChatMessage, ChatView } from "@/lib/aichat/types";
import { chatTurns } from "@/lib/aichat/turn-store";

const getChatMessages = vi.fn();
const createChatThread = vi.fn();
const stopChatTurn = vi.fn();
const queueChatMessage = vi.fn();
const readChatStream = vi.fn();

vi.mock("@/app/actions/aichat", () => ({
  createChatThreadAction: (...args: unknown[]) => createChatThread(...args),
  getChatMessagesAction: (...args: unknown[]) => getChatMessages(...args),
  stopChatTurnAction: (...args: unknown[]) => stopChatTurn(...args),
  queueChatMessageAction: (...args: unknown[]) => queueChatMessage(...args),
}));

vi.mock("@/lib/aichat/chat-stream", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aichat/chat-stream")>();
  return { ...actual, readChatStream: (...args: unknown[]) => readChatStream(...args) };
});

import { useTurnLifetime } from "./background-turns";
import { useChatConversation } from "./use-chat-conversation";

interface OpenStream {
  request: ChatStreamRequest;
  handlers: StreamHandlers;
  signal: AbortSignal;
  finish: (outcome: StreamOutcome) => void;
}

function holdStreams(): OpenStream[] {
  const streams: OpenStream[] = [];
  readChatStream.mockImplementation(
    (request: ChatStreamRequest, handlers: StreamHandlers, signal: AbortSignal) =>
      new Promise<StreamOutcome>((resolve) => {
        const stream = { request, handlers, signal, finish: resolve };
        signal.addEventListener("abort", () => resolve("aborted"));
        streams.push(stream);
      }),
  );
  return streams;
}

interface Stored {
  items: ChatMessage[];
  running?: boolean;
  projectId?: string;
  queued?: unknown[];
}

function histories(byThread: Record<string, Stored>) {
  getChatMessages.mockImplementation(async (threadId: string) => {
    const stored = byThread[threadId];
    if (!stored) return { data: null, error: "missing" };
    return { data: { total: stored.items.length, page: 1, pageSize: 100, running: false, ...stored }, error: null };
  });
}

function said(id: string, content: string): ChatMessage {
  return { id, role: "user", content, createdAt: "2026-10-11T12:00:00Z" };
}

const proposal: ChatMessage = {
  id: "m-proposal",
  role: "assistant",
  content: "Posso exportar?",
  createdAt: "2026-10-11T12:00:01Z",
  proposal: { id: "act-1", toolName: "studio_export", fields: [], status: "pending" },
};

const studio = (projectId: string): ChatView => ({ surface: "studio", projectId, projectKind: "image" });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  stopChatTurn.mockResolvedValue({ error: null });
  queueChatMessage.mockResolvedValue({ data: {}, error: null });
});

describe("switching sessions", () => {
  it("keeps the running answer of the session left behind streaming, and shows it live on the way back", async () => {
    histories({ "th-live": { items: [said("m1", "monte o relatório")], running: true }, "th-other": { items: [said("m2", "outra coisa")] } });
    const streams = holdStreams();
    const { result } = renderHook(() => useChatConversation({ createError: "x" }));
    await act(async () => {
      await result.current.selectThread("th-live");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    expect(streams[0].request).toMatchObject({ method: "GET", url: expect.stringContaining("/chat/threads/th-live/turn/events") });

    await act(async () => {
      await result.current.selectThread("th-other");
    });
    expect(result.current.activeId).toBe("th-other");
    expect(result.current.streaming).toBe(false);
    expect(result.current.messages.map((m) => m.content)).toEqual(["outra coisa"]);
    expect(streams[0].signal.aborted).toBe(false);
    act(() => streams[0].handlers.onDelta?.("Somando os números"));
    expect(chatTurns.isStreaming("th-live")).toBe(true);

    await act(async () => {
      await result.current.selectThread("th-live");
    });
    expect(streams).toHaveLength(1);
    expect(result.current.streaming).toBe(true);
    expect(result.current.messages.at(-1)?.segments).toEqual([{ kind: "text", text: "Somando os números", streaming: true }]);
    await act(async () => streams[0].finish("finished"));
  });

  it("replays an answer that kept running on the server while this browser was not watching it", async () => {
    histories({ "th-replay": { items: [said("m1", "gera o banner")], running: true } });
    const streams = holdStreams();
    const { result } = renderHook(() => useChatConversation({ createError: "x" }));
    await act(async () => {
      await result.current.selectThread("th-replay");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    act(() => streams[0].handlers.onDelta?.("Já gerei a primeira versão"));
    expect(result.current.messages.at(-1)?.segments).toEqual([{ kind: "text", text: "Já gerei a primeira versão", streaming: true }]);
    await act(async () => streams[0].finish("finished"));
  });

  it("remembers the chosen session per workspace", async () => {
    histories({ "th-a": { items: [said("m1", "a")] }, "th-b": { items: [said("m2", "b")] } });
    localStorage.setItem(activeThreadKey("ws-2"), "th-a");
    const first = renderHook(() => useChatConversation({ createError: "x", rememberKey: activeThreadKey("ws-1") }));
    await act(async () => {
      await first.result.current.selectThread("th-b");
    });
    expect(localStorage.getItem(activeThreadKey("ws-1"))).toBe("th-b");
    expect(localStorage.getItem(activeThreadKey("ws-2"))).toBe("th-a");
    first.unmount();

    const again = renderHook(() => useChatConversation({ createError: "x", rememberKey: activeThreadKey("ws-1") }));
    await waitFor(() => expect(again.result.current.activeId).toBe("th-b"));
    const elsewhere = renderHook(() => useChatConversation({ createError: "x", rememberKey: activeThreadKey("ws-2") }));
    await waitFor(() => expect(elsewhere.result.current.activeId).toBe("th-a"));
  });
});

describe("the background subscription", () => {
  it("keeps a running answer alive while the app is open and drops it when the app closes", async () => {
    histories({ "th-bg": { items: [said("m1", "analisa a campanha")], running: true }, "th-next": { items: [] } });
    const streams = holdStreams();
    const app = renderHook(() => {
      useTurnLifetime();
      return useChatConversation({ createError: "x" });
    });
    await act(async () => {
      await app.result.current.selectThread("th-bg");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    await act(async () => {
      await app.result.current.selectThread("th-next");
    });
    expect(streams[0].signal.aborted).toBe(false);
    expect(chatTurns.live()).toContain("th-bg");

    app.unmount();
    expect(streams[0].signal.aborted).toBe(true);
    await waitFor(() => expect(chatTurns.live()).not.toContain("th-bg"));
  });
});

describe("a session from another studio project", () => {
  it("is shown but refuses to send, queue, approve or send the queue", async () => {
    histories({ "th-foreign": { items: [said("m1", "troca o fundo"), proposal], projectId: "p-other" } });
    const streams = holdStreams();
    const { result } = renderHook(() => useChatConversation({ createError: "x", view: studio("p-open"), mode: "edit" }));
    await act(async () => {
      await result.current.selectThread("th-foreign");
    });
    expect(result.current.otherProject).toBe(true);
    expect(result.current.messages).toHaveLength(2);

    await act(async () => {
      await result.current.ask("agora deixa azul", "m");
    });
    expect(result.current.error).toBe("thread_other_project");
    await act(async () => {
      await result.current.resolveAction("act-1", "approve", "m");
      await result.current.sendQueued("m");
    });
    expect(streams).toHaveLength(0);
    expect(queueChatMessage).not.toHaveBeenCalled();
    expect(createChatThread).not.toHaveBeenCalled();
    expect(result.current.messages[1].pending?.status).toBe("pending");
  });

  it("binds a new session to the open project, and refuses it once another project is open", async () => {
    createChatThread.mockResolvedValue({ data: { id: "th-new", title: "", model: "m", createdAt: "2026-10-11T12:00:00Z" }, error: null });
    const streams = holdStreams();
    const { result, rerender } = renderHook(({ view }) => useChatConversation({ createError: "x", view }), { initialProps: { view: studio("p-open") } });
    act(() => {
      void result.current.ask("cria um post", "m");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    expect(streams[0].request.body).toMatchObject({ view: studio("p-open") });
    expect(chatTurns.snapshot("th-new").projectId).toBe("p-open");
    await act(async () => streams[0].finish("finished"));
    expect(result.current.otherProject).toBe(false);

    rerender({ view: studio("p-second") });
    expect(result.current.otherProject).toBe(true);
    await act(async () => {
      await result.current.ask("e neste?", "m");
    });
    expect(streams).toHaveLength(1);
    expect(result.current.error).toBe("thread_other_project");
  });

  it("learns the real project when the server refuses the turn", async () => {
    histories({ "th-stale": { items: [said("m1", "oi")] } });
    const streams = holdStreams();
    const { result } = renderHook(() => useChatConversation({ createError: "x", view: studio("p-open") }));
    await act(async () => {
      await result.current.selectThread("th-stale");
    });
    histories({ "th-stale": { items: [said("m1", "oi")], projectId: "p-other" } });
    act(() => {
      void result.current.ask("muda a cor", "m");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    await act(async () => {
      streams[0].handlers.onError?.("thread_other_project");
      streams[0].finish("failed");
    });
    await waitFor(() => expect(result.current.otherProject).toBe(true));
    expect(chatTurns.snapshot("th-stale").projectId).toBe("p-other");
  });

  it("works normally outside the studio", async () => {
    histories({ "th-studio": { items: [said("m1", "oi")], projectId: "p-other" } });
    const streams = holdStreams();
    const { result } = renderHook(() => useChatConversation({ createError: "x" }));
    await act(async () => {
      await result.current.selectThread("th-studio");
    });
    expect(result.current.otherProject).toBe(false);
    act(() => {
      void result.current.ask("resume a conversa", "m");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    await act(async () => streams[0].finish("finished"));
  });
});
