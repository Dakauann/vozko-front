import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatStreamRequest, StreamHandlers, StreamOutcome } from "@/lib/aichat/chat-stream";
import type { ChatMessage } from "@/lib/aichat/types";

const getChatMessages = vi.fn();
const createChatThread = vi.fn();
const stopChatTurn = vi.fn();
const readChatStream = vi.fn();

vi.mock("@/app/actions/aichat", () => ({
  createChatThreadAction: (...args: unknown[]) => createChatThread(...args),
  getChatMessagesAction: (...args: unknown[]) => getChatMessages(...args),
  stopChatTurnAction: (...args: unknown[]) => stopChatTurn(...args),
}));

vi.mock("@/lib/aichat/chat-stream", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aichat/chat-stream")>();
  return { ...actual, readChatStream: (...args: unknown[]) => readChatStream(...args) };
});

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
        streams.push({ request, handlers, signal, finish: resolve });
      }),
  );
  return streams;
}

function history(items: ChatMessage[], running = false) {
  return { data: { items, total: items.length, page: 1, pageSize: 100, running }, error: null };
}

const question: ChatMessage = { id: "m-user", role: "user", content: "edita a imagem", createdAt: "2026-10-08T12:00:00Z" };

const proposal: ChatMessage = {
  id: "msg-1",
  role: "assistant",
  content: "Posso gerar a imagem?",
  createdAt: "2026-10-02T12:00:00Z",
  proposal: {
    id: "act-1",
    toolName: "generate_image",
    fields: [
      { key: "image", value: "um card de pizza" },
      { key: "format", value: "story" },
    ],
    status: "pending",
  },
};

function lastSegments(messages: { segments?: unknown[] }[]) {
  return messages[messages.length - 1]?.segments;
}

beforeEach(() => {
  getChatMessages.mockReset();
  createChatThread.mockReset();
  stopChatTurn.mockReset();
  readChatStream.mockReset();
  stopChatTurn.mockResolvedValue({ error: null });
  localStorage.clear();
});

describe("approving an image generation", () => {
  it("shows the running image in the aspect the user approved", async () => {
    getChatMessages.mockResolvedValue(history([proposal]));
    const streams = holdStreams();
    const { result } = renderHook(() => useChatConversation({ createError: "x" }));
    await act(async () => {
      await result.current.selectThread("t-approve");
    });
    act(() => {
      void result.current.resolveAction("act-1", "approve", "m");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    act(() => streams[0].handlers.onToolStart?.("generate_image"));

    expect(lastSegments(result.current.messages)).toEqual([{ kind: "tool", name: "generate_image", summary: "", ok: true, running: true, frame: "story" }]);
    await act(async () => streams[0].finish("finished"));
  });
});

describe("a conversation that remounts during an answer", () => {
  async function startAnswer(rememberKey: string, threadId: string) {
    createChatThread.mockResolvedValue({ data: { id: threadId, title: "", model: "m", createdAt: "2026-10-08T12:00:00Z" }, error: null });
    const streams = holdStreams();
    const first = renderHook(() => useChatConversation({ createError: "x", rememberKey }));
    act(() => {
      void first.result.current.ask("edita a imagem", "m");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    act(() => streams[0].handlers.onDelta?.("Vou editar"));
    first.unmount();
    const second = renderHook(() => useChatConversation({ createError: "x", rememberKey }));
    await waitFor(() => expect(second.result.current.activeId).toBe(threadId));
    return { streams, second };
  }

  it("shows the running answer again and keeps following it", async () => {
    const { streams, second } = await startAnswer("k-remount", "th-remount");

    expect(second.result.current.streaming).toBe(true);
    expect(lastSegments(second.result.current.messages)).toEqual([{ kind: "text", text: "Vou editar", streaming: true }]);
    act(() => streams[0].handlers.onDelta?.(" agora"));
    expect(lastSegments(second.result.current.messages)).toEqual([{ kind: "text", text: "Vou editar agora", streaming: true }]);
    expect(getChatMessages).not.toHaveBeenCalled();
    await act(async () => streams[0].finish("finished"));
    expect(second.result.current.streaming).toBe(false);
  });

  it("can still stop the answer", async () => {
    const { streams, second } = await startAnswer("k-stop", "th-stop");
    await act(async () => {
      second.result.current.stop();
    });
    await waitFor(() => expect(streams[0].signal.aborted).toBe(true));
    expect(stopChatTurn).toHaveBeenCalledWith("th-stop");
    await act(async () => streams[0].finish("aborted"));
  });

  it("refuses a second message while the answer runs", async () => {
    const { streams, second } = await startAnswer("k-busy", "th-busy");
    await act(async () => {
      await second.result.current.ask("outra coisa", "m");
    });
    expect(streams).toHaveLength(1);
    await act(async () => streams[0].finish("finished"));
  });
});

describe("an answer running on the server", () => {
  it("is watched when its conversation opens", async () => {
    getChatMessages.mockResolvedValue(history([question], true));
    const streams = holdStreams();
    const { result } = renderHook(() => useChatConversation({ createError: "x" }));
    await act(async () => {
      await result.current.selectThread("th-server");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    expect(streams[0].request.method).toBe("GET");
    expect(streams[0].request.url).toContain("/chat/threads/th-server/turn/events");
    act(() => streams[0].handlers.onDelta?.("Trabalhando"));

    expect(result.current.streaming).toBe(true);
    expect(result.current.messages[0]).toMatchObject({ id: "m-user" });
    expect(lastSegments(result.current.messages)).toEqual([{ kind: "text", text: "Trabalhando", streaming: true }]);
    await act(async () => streams[0].finish("finished"));
  });

  it("reloads the history when the answer ended before it could be watched", async () => {
    const answer: ChatMessage = { id: "m-answer", role: "assistant", content: "pronto", createdAt: "2026-10-08T12:00:05Z" };
    getChatMessages.mockResolvedValueOnce(history([question], true)).mockResolvedValueOnce(history([question, answer]));
    readChatStream.mockResolvedValue("missing");
    const { result } = renderHook(() => useChatConversation({ createError: "x" }));
    await act(async () => {
      await result.current.selectThread("th-ended");
    });
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(["m-user", "m-answer"]));
    expect(result.current.streaming).toBe(false);
  });

  it("is picked up again when the stream drops before the answer ends", async () => {
    createChatThread.mockResolvedValue({ data: { id: "th-drop", title: "", model: "m", createdAt: "2026-10-08T12:00:00Z" }, error: null });
    getChatMessages.mockResolvedValue(history([question], true));
    const streams = holdStreams();
    const { result } = renderHook(() => useChatConversation({ createError: "x" }));
    act(() => {
      void result.current.ask("edita a imagem", "m");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    await act(async () => streams[0].finish("detached"));
    await waitFor(() => expect(streams).toHaveLength(2));
    expect(streams[1].request.url).toContain("/chat/threads/th-drop/turn/events");
    act(() => streams[1].handlers.onDelta?.("de volta"));
    expect(lastSegments(result.current.messages)).toEqual([{ kind: "text", text: "de volta", streaming: true }]);
    await act(async () => streams[1].finish("finished"));
  });
});

describe("the end of an answer", () => {
  it("is announced once to the conversation on screen", async () => {
    createChatThread.mockResolvedValue({ data: { id: "th-end", title: "", model: "m", createdAt: "2026-10-08T12:00:00Z" }, error: null });
    const streams = holdStreams();
    const onTurnFinished = vi.fn();
    const { result } = renderHook(() => useChatConversation({ createError: "x", onTurnFinished }));
    act(() => {
      void result.current.ask("oi", "m");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    act(() => streams[0].handlers.onDone?.());
    await act(async () => streams[0].finish("finished"));
    expect(onTurnFinished).toHaveBeenCalledTimes(1);
  });
});
