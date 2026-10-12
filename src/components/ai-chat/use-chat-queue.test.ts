import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatStreamRequest, StreamHandlers, StreamOutcome } from "@/lib/aichat/chat-stream";
import type { ChatMessage } from "@/lib/aichat/types";

const getChatMessages = vi.fn();
const createChatThread = vi.fn();
const stopChatTurn = vi.fn();
const queueChatMessage = vi.fn();
const unqueueChatMessage = vi.fn();
const readChatStream = vi.fn();

vi.mock("@/app/actions/aichat", () => ({
  createChatThreadAction: (...args: unknown[]) => createChatThread(...args),
  getChatMessagesAction: (...args: unknown[]) => getChatMessages(...args),
  stopChatTurnAction: (...args: unknown[]) => stopChatTurn(...args),
  queueChatMessageAction: (...args: unknown[]) => queueChatMessage(...args),
  unqueueChatMessageAction: (...args: unknown[]) => unqueueChatMessage(...args),
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

function history(items: ChatMessage[], running = false, queued: unknown[] = []) {
  return { data: { items, total: items.length, page: 1, pageSize: 100, running, queued }, error: null };
}

const question: ChatMessage = { id: "m-user", role: "user", content: "monte o anúncio", createdAt: "2026-10-10T12:00:00Z" };

const proposal: ChatMessage = {
  id: "m-proposal",
  role: "assistant",
  content: "Posso criar a campanha?",
  createdAt: "2026-10-10T12:00:01Z",
  proposal: { id: "act-1", toolName: "create_campaign", fields: [], status: "pending" },
};

async function answering(threadId: string) {
  getChatMessages.mockResolvedValue(history([question], true));
  const streams = holdStreams();
  const hook = renderHook(() => useChatConversation({ createError: "x", view: { surface: "leads" }, mode: "edit" }));
  await act(async () => {
    await hook.result.current.selectThread(threadId);
  });
  await waitFor(() => expect(streams).toHaveLength(1));
  act(() => streams[0].handlers.onDelta?.("Vou olhar"));
  return { streams, hook };
}

beforeEach(() => {
  vi.clearAllMocks();
  stopChatTurn.mockResolvedValue({ error: null });
  queueChatMessage.mockResolvedValue({ data: {}, error: null });
  unqueueChatMessage.mockResolvedValue({ error: null });
});

describe("a message sent while Elo works", () => {
  it("waits in the queue and joins the conversation when Elo picks it up", async () => {
    const { streams, hook } = await answering("th-q1");
    await act(async () => {
      await hook.result.current.ask("use o azul", "m");
    });
    expect(streams).toHaveLength(1);
    const [clientId] = hook.result.current.queued.map((q) => q.clientId);
    expect(queueChatMessage).toHaveBeenCalledWith("th-q1", { clientId, content: "use o azul", attachments: [] });
    expect(hook.result.current.queued).toMatchObject([{ content: "use o azul" }]);

    act(() => streams[0].handlers.onDelivered?.([{ id: "m-9", clientId, content: "use o azul", createdAt: "2026-10-10T12:00:05Z" }]));
    expect(hook.result.current.queued).toEqual([]);
    expect(hook.result.current.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(hook.result.current.messages[2]).toMatchObject({ id: "m-9", content: "use o azul" });
    act(() => streams[0].handlers.onDelta?.("Feito, azul."));
    expect(hook.result.current.messages[3].segments).toEqual([{ kind: "text", text: "Feito, azul.", streaming: true }]);
    await act(async () => streams[0].finish("finished"));
  });

  it("can be taken back before Elo reads it", async () => {
    const { streams, hook } = await answering("th-q2");
    await act(async () => {
      await hook.result.current.ask("esquece", "m");
    });
    const [clientId] = hook.result.current.queued.map((q) => q.clientId);
    await act(async () => {
      await hook.result.current.unqueue(clientId);
    });
    expect(unqueueChatMessage).toHaveBeenCalledWith("th-q2", clientId);
    expect(hook.result.current.queued).toEqual([]);
    await act(async () => streams[0].finish("finished"));
  });

  it("is sent normally when the answer had already ended on the server", async () => {
    const { streams, hook } = await answering("th-q3");
    queueChatMessage.mockResolvedValue({ data: null, error: { message: "not running", code: "turn_not_running" } });
    let sent: Promise<void> = Promise.resolve();
    act(() => {
      sent = hook.result.current.ask("e agora?", "m");
    });
    await waitFor(() => expect(queueChatMessage).toHaveBeenCalled());
    await act(async () => streams[0].finish("finished"));
    await waitFor(() => expect(streams).toHaveLength(2));
    expect(streams[1].request.method).toBe("POST");
    expect(streams[1].request.body).toMatchObject({ content: "e agora?" });
    expect(hook.result.current.queued).toEqual([]);
    await act(async () => {
      streams[1].finish("finished");
      await sent;
    });
  });

  it("stays queued after stop and goes with Enviar agora", async () => {
    const { streams, hook } = await answering("th-q4");
    await act(async () => {
      await hook.result.current.ask("na verdade, pare", "m");
    });
    await act(async () => {
      hook.result.current.stop();
    });
    await act(async () => streams[0].finish("aborted"));
    expect(hook.result.current.queued).toMatchObject([{ content: "na verdade, pare" }]);

    act(() => {
      void hook.result.current.sendQueued("m");
    });
    await waitFor(() => expect(streams).toHaveLength(2));
    expect(streams[1].request.body).toMatchObject({ content: "", view: { surface: "leads" }, mode: "edit" });
    expect(hook.result.current.queued).toEqual([]);
    expect(hook.result.current.messages.slice(-2).map((m) => [m.role, m.content])).toEqual([
      ["user", "na verdade, pare"],
      ["assistant", ""],
    ]);
    await act(async () => streams[1].finish("finished"));
  });

  it("waits while an approval card is open", async () => {
    getChatMessages.mockResolvedValue(history([question, proposal]));
    const streams = holdStreams();
    const { result } = renderHook(() => useChatConversation({ createError: "x" }));
    await act(async () => {
      await result.current.selectThread("th-q5");
    });
    expect(result.current.awaitingApproval).toBe(true);
    await act(async () => {
      await result.current.ask("chame de Atendente", "m");
    });
    expect(streams).toHaveLength(0);
    expect(queueChatMessage).toHaveBeenCalledWith("th-q5", expect.objectContaining({ content: "chame de Atendente" }));
  });

  it("is still there after a reload", async () => {
    getChatMessages.mockResolvedValue(history([question], false, [{ clientId: "c7", content: "ainda na fila", createdAt: "2026-10-10T12:00:09Z" }]));
    const { result } = renderHook(() => useChatConversation({ createError: "x" }));
    await act(async () => {
      await result.current.selectThread("th-q6");
    });
    expect(result.current.queued).toEqual([{ clientId: "c7", content: "ainda na fila", createdAt: "2026-10-10T12:00:09Z" }]);
  });

  it("stays with its own conversation when another session is opened", async () => {
    const { streams, hook } = await answering("th-q8");
    await act(async () => {
      await hook.result.current.ask("depois faz o azul", "m");
    });
    const [clientId] = hook.result.current.queued.map((q) => q.clientId);

    getChatMessages.mockResolvedValue(history([{ ...question, id: "m-other", content: "outra sessão" }]));
    await act(async () => {
      await hook.result.current.selectThread("th-q9");
    });
    expect(hook.result.current.queued).toEqual([]);
    act(() => {
      void hook.result.current.ask("pergunta nova", "m");
    });
    await waitFor(() => expect(streams).toHaveLength(2));
    expect(streams[1].request.url).toContain("/chat/threads/th-q9/messages");
    expect(streams[1].request.body).toMatchObject({ content: "pergunta nova" });
    expect(hook.result.current.messages.map((m) => m.content)).not.toContain("depois faz o azul");
    await act(async () => streams[1].finish("finished"));

    await act(async () => {
      await hook.result.current.selectThread("th-q8");
    });
    expect(hook.result.current.queued).toMatchObject([{ clientId, content: "depois faz o azul" }]);
    act(() => streams[0].handlers.onDelivered?.([{ id: "m-10", clientId, content: "depois faz o azul", createdAt: "2026-10-10T12:00:06Z" }]));
    expect(hook.result.current.queued).toEqual([]);
    expect(hook.result.current.messages.map((m) => m.content)).toContain("depois faz o azul");
    await act(async () => streams[0].finish("finished"));
  });

  it("keeps the screen and mode when a rejection answers the queue", async () => {
    getChatMessages.mockResolvedValue(history([question, proposal]));
    const streams = holdStreams();
    const { result } = renderHook(() => useChatConversation({ createError: "x", view: { surface: "leads" }, mode: "edit" }));
    await act(async () => {
      await result.current.selectThread("th-q7");
    });
    act(() => {
      void result.current.resolveAction("act-1", "reject", "m");
    });
    await waitFor(() => expect(streams).toHaveLength(1));
    expect(streams[0].request.body).toEqual({ view: { surface: "leads" }, mode: "edit" });
    await act(async () => streams[0].finish("finished"));
  });
});
