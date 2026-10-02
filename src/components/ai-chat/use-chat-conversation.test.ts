import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StreamHandlers } from "@/hooks/use-chat-stream";
import type { ChatMessage } from "@/lib/aichat/types";

const getChatMessages = vi.fn();
const approve = vi.fn();
vi.mock("@/app/actions/aichat", () => ({
  createChatThreadAction: vi.fn(),
  getChatMessagesAction: (...args: unknown[]) => getChatMessages(...args),
}));
vi.mock("@/hooks/use-chat-stream", () => ({
  useChatStream: () => ({ streaming: false, send: vi.fn(), approve, reject: vi.fn(), stop: vi.fn() }),
}));

import { useChatConversation } from "./use-chat-conversation";

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

describe("approving an image generation", () => {
  beforeEach(() => {
    getChatMessages.mockReset();
    approve.mockReset();
    getChatMessages.mockResolvedValue({ data: { items: [proposal], total: 1, page: 1, pageSize: 100 }, error: null });
  });

  it("shows the running image in the aspect the user approved", async () => {
    approve.mockImplementation(async (_thread: string, _action: string, handlers: StreamHandlers) => {
      handlers.onToolStart?.("generate_image");
    });
    const { result } = renderHook(() => useChatConversation({ createError: "x" }));
    await act(async () => {
      await result.current.selectThread("t-1");
    });
    await act(async () => {
      await result.current.resolveAction("act-1", "approve", "m");
    });

    const live = result.current.messages[result.current.messages.length - 1];
    expect(live.segments).toEqual([{ kind: "tool", name: "generate_image", summary: "", ok: true, running: true, aspect: "story" }]);
  });
});
