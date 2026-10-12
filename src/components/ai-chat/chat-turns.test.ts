import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ getChatMessagesAction: vi.fn(), stopChatTurnAction: vi.fn() }));
const streams = vi.hoisted(() => ({ readChatStream: vi.fn() }));

vi.mock("@/app/actions/aichat", () => actions);
vi.mock("@/lib/aichat/chat-stream", () => ({
  chatStreams: { observe: (threadId: string) => ({ url: `/chat/threads/${threadId}/turn/events`, method: "GET", quietWhenMissing: true }) },
  readChatStream: streams.readChatStream,
}));
vi.mock("./screen-bridge", () => ({ answerScreenCommand: vi.fn(), endScreenTurn: vi.fn(), receiveScreenGo: vi.fn() }));

import { chatTurns } from "@/lib/aichat/turn-store";

import { closeTurns, openThread } from "./chat-turns";

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

describe("a conversation's studio project", () => {
  it("comes from the history and is forgotten when the history has none", async () => {
    actions.getChatMessagesAction.mockResolvedValueOnce({ data: { items: [], running: false, projectId: "p-history" } });
    await openThread("th-project");
    expect(chatTurns.snapshot("th-project").projectId).toBe("p-history");
    actions.getChatMessagesAction.mockResolvedValueOnce({ data: { items: [], running: false } });
    await openThread("th-project");
    expect(chatTurns.snapshot("th-project").projectId).toBeNull();
  });

  it("becomes the project Elo created as soon as its card arrives", async () => {
    actions.getChatMessagesAction.mockResolvedValue({ data: { items: [], running: true } });
    streams.readChatStream.mockImplementationOnce(async (_request: unknown, handlers: { onCard: (card: unknown) => void }) => {
      handlers.onCard({ kind: "studio_project", studioProject: { kind: "image", projectId: "p-created" } });
      return "finished";
    });
    await openThread("th-created");
    await vi.waitFor(() => expect(chatTurns.snapshot("th-created").projectId).toBe("p-created"));
  });
});

describe("closing the app", () => {
  it("drops every running answer and never watches them again", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    actions.getChatMessagesAction.mockResolvedValue({ data: { items: [], running: true } });
    streams.readChatStream.mockResolvedValueOnce("detached").mockImplementation(
      (_request: unknown, _handlers: unknown, signal: AbortSignal) =>
        new Promise((resolve) => {
          signals.push(signal);
          signal.addEventListener("abort", () => resolve("aborted"));
        }),
    );
    await openThread("th-closed");
    await openThread("th-held");
    expect(chatTurns.live()).toEqual(["th-held"]);
    closeTurns();
    await vi.runAllTimersAsync();
    expect(signals[0].aborted).toBe(true);
    expect(chatTurns.live()).toEqual([]);
    expect(streams.readChatStream).toHaveBeenCalledTimes(2);
  });

  it("still watches conversations opened after the app comes back", async () => {
    closeTurns();
    actions.getChatMessagesAction.mockResolvedValue({ data: { items: [], running: true } });
    streams.readChatStream.mockResolvedValue("finished");
    await openThread("th-back");
    await vi.waitFor(() => expect(streams.readChatStream).toHaveBeenCalledTimes(1));
  });
});
