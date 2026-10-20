import { describe, expect, it } from "vitest";

import { message, thread } from "./fixtures.test-helpers";
import { isTeamChatMessage, isTeamChatSummary, isTeamChatThread, isTeamChatThreadPage, readTeamChatEvent } from "./types";

describe("team chat guards", () => {
  it("accepts the shapes the server sends", () => {
    expect(isTeamChatMessage(message(1))).toBe(true);
    expect(isTeamChatThread(thread("t-1", { last_message: message(1) }))).toBe(true);
    expect(isTeamChatThreadPage({ threads: [thread("t-1")], next: "" })).toBe(true);
    expect(isTeamChatSummary({ unread_threads: 1, unread_messages: 3 })).toBe(true);
  });

  it("refuses broken shapes", () => {
    expect(isTeamChatMessage({ ...message(1), seq: "1" })).toBe(false);
    expect(isTeamChatMessage({ ...message(1), kind: "voice" })).toBe(false);
    expect(isTeamChatThread({ ...thread("t-1"), members: null })).toBe(false);
    expect(isTeamChatThreadPage({ threads: [{}], next: "" })).toBe(false);
    expect(isTeamChatSummary({ unread_threads: 1 })).toBe(false);
  });
});

describe("readTeamChatEvent", () => {
  it("reads every team chat socket event", () => {
    expect(readTeamChatEvent("team_chat:message", { thread_id: "t-1", message: message(2) })).toEqual({
      type: "team_chat:message",
      payload: { thread_id: "t-1", message: message(2) },
    });
    expect(readTeamChatEvent("team_chat:read", { thread_id: "t-1", user_id: "u", seq: 4 })?.type).toBe("team_chat:read");
    expect(readTeamChatEvent("team_chat:thread", { thread_id: "t-1" })?.type).toBe("team_chat:thread");
    expect(readTeamChatEvent("team_chat:thread_removed", { thread_id: "t-1" })?.type).toBe("team_chat:thread_removed");
    expect(readTeamChatEvent("team_chat:typing", { thread_id: "t-1", user_id: "u" })?.type).toBe("team_chat:typing");
    expect(
      readTeamChatEvent("team_chat:scheduled", {
        thread_id: "t-1",
        scheduled: {
          id: "s-1",
          thread_id: "t-1",
          body: "x",
          mentions: [],
          send_at: "2026-10-20T15:00:00Z",
          status: "sent",
          created_at: "2026-10-19T12:00:00Z",
          updated_at: "2026-10-19T12:00:00Z",
        },
      })?.type,
    ).toBe("team_chat:scheduled");
  });

  it("ignores other events and malformed payloads", () => {
    expect(readTeamChatEvent("conversation:message", { thread_id: "t-1" })).toBeNull();
    expect(readTeamChatEvent("team_chat:message", { thread_id: "t-1" })).toBeNull();
    expect(readTeamChatEvent("team_chat:read", { thread_id: "t-1", user_id: "u", seq: "x" })).toBeNull();
  });
});
