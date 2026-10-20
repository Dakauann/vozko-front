import { describe, expect, it } from "vitest";

import { noUnreadBoundary, trackUnreadBoundary, type UnreadBoundary } from "./unread-boundary";
import type { ConversationMessage } from "./types";

function msg(id: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id,
    entry_id: "e1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: "+5511999999999",
    to: "+5511888888888",
    text: id,
    sender_name: "Lead",
    read: true,
    read_at: null,
    read_by: null,
    created_at: "2026-10-18T10:00:00Z",
    updated_at: "2026-10-18T10:00:00Z",
    ...overrides,
  };
}

interface Step {
  key: string | null;
  messages: ConversationMessage[];
  loading: boolean;
}

function after(steps: Step[]): UnreadBoundary {
  return steps.reduce((boundary, step) => trackUnreadBoundary(boundary, step.key, step.messages, step.loading), noUnreadBoundary);
}

const unreadPage = [msg("a"), msg("b", { read: false }), msg("c", { read: false })];
const readPage = unreadPage.map((m) => ({ ...m, read: true }));

describe("unread boundary", () => {
  it("is the first unread customer message of the first page", () => {
    expect(after([{ key: "w:1", messages: unreadPage, loading: false }]).messageId).toBe("b");
  });

  it("survives mark_read flipping the messages to read while the conversation stays open", () => {
    expect(
      after([
        { key: "w:1", messages: unreadPage, loading: false },
        { key: "w:1", messages: readPage, loading: false },
      ]).messageId,
    ).toBe("b");
  });

  it("waits for the first page instead of settling on the empty thread", () => {
    expect(
      after([
        { key: "w:1", messages: [], loading: true },
        { key: "w:1", messages: unreadPage, loading: false },
      ]).messageId,
    ).toBe("b");
  });

  it("never treats a message that arrives live after an empty first page as unread on open", () => {
    expect(
      after([
        { key: "w:1", messages: [], loading: true },
        { key: "w:1", messages: [], loading: false },
        { key: "w:1", messages: [msg("live", { read: false })], loading: false },
      ]).messageId,
    ).toBeNull();
  });

  it("waits for the server's page when a cached thread shows at once, so the divider still follows the server's unread state", () => {
    expect(
      after([
        { key: "w:1", messages: readPage.slice(0, 1), loading: true },
        { key: "w:1", messages: unreadPage, loading: false },
      ]).messageId,
    ).toBe("b");
  });

  it("ignores our own unread outgoing messages", () => {
    const page = [msg("op", { read: false, message_type: "operator" })];
    expect(after([{ key: "w:1", messages: page, loading: false }]).messageId).toBeNull();
  });

  it("is forgotten when the operator leaves for another conversation", () => {
    expect(
      after([
        { key: "w:1", messages: unreadPage, loading: false },
        { key: "w:2", messages: readPage, loading: false },
      ]).messageId,
    ).toBeNull();
  });

  it("returns the same boundary when nothing changed so render-time updates settle", () => {
    const settled = after([{ key: "w:1", messages: unreadPage, loading: false }]);
    expect(trackUnreadBoundary(settled, "w:1", readPage, false)).toBe(settled);
  });
});
