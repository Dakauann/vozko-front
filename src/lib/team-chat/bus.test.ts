import { describe, expect, it, vi } from "vitest";

import {
  emitTeamChat,
  emitTeamChatConnection,
  registerTeamChatTypingSender,
  sendTeamChatTyping,
  subscribeTeamChat,
  subscribeTeamChatConnection,
} from "./bus";

describe("team chat bus", () => {
  it("delivers events to subscribers until they leave", () => {
    const listener = vi.fn();
    const leave = subscribeTeamChat(listener);
    emitTeamChat({ type: "team_chat:thread", payload: { thread_id: "t-1" } });
    leave();
    emitTeamChat({ type: "team_chat:thread", payload: { thread_id: "t-2" } });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tells subscribers when the socket comes back", () => {
    const listener = vi.fn();
    const leave = subscribeTeamChatConnection(listener);
    emitTeamChatConnection(true);
    leave();
    expect(listener).toHaveBeenCalledWith(true);
  });

  it("sends typing only while a socket registered a sender", () => {
    expect(sendTeamChatTyping("t-1")).toBe(false);
    const sender = vi.fn(() => true);
    const unregister = registerTeamChatTypingSender(sender);
    expect(sendTeamChatTyping("t-1")).toBe(true);
    expect(sender).toHaveBeenCalledWith("t-1");
    unregister();
    expect(sendTeamChatTyping("t-1")).toBe(false);
  });
});
