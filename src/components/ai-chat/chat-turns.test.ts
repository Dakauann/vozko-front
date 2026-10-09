import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ getChatMessagesAction: vi.fn(), stopChatTurnAction: vi.fn() }));
const streams = vi.hoisted(() => ({ readChatStream: vi.fn() }));

vi.mock("@/app/actions/aichat", () => actions);
vi.mock("@/lib/aichat/chat-stream", () => ({
  chatStreams: { observe: (threadId: string) => ({ url: `/chat/threads/${threadId}/turn/events`, method: "GET", quietWhenMissing: true }) },
  readChatStream: streams.readChatStream,
}));
vi.mock("./screen-bridge", () => ({ answerScreenCommand: vi.fn(), endScreenTurn: vi.fn() }));

import { openThread } from "./chat-turns";

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("watching a running answer", () => {
  it("watches again every time the connection drops while the answer is still running", async () => {
    vi.useFakeTimers();
    actions.getChatMessagesAction.mockResolvedValue({ data: { items: [], running: true } });
    streams.readChatStream.mockResolvedValueOnce("detached").mockResolvedValueOnce("detached").mockResolvedValueOnce("finished");
    expect(await openThread("th-watch")).toBe("loaded");
    await vi.runAllTimersAsync();
    expect(streams.readChatStream).toHaveBeenCalledTimes(3);
  });

  it("stops watching once the answer is over", async () => {
    vi.useFakeTimers();
    actions.getChatMessagesAction.mockResolvedValueOnce({ data: { items: [], running: true } }).mockResolvedValue({ data: { items: [], running: false } });
    streams.readChatStream.mockResolvedValue("detached");
    await openThread("th-over");
    await vi.runAllTimersAsync();
    expect(streams.readChatStream).toHaveBeenCalledTimes(1);
  });
});
