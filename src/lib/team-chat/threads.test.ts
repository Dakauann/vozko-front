import { describe, expect, it } from "vitest";

import { ME, message, thread } from "./fixtures.test-helpers";
import { threadsAfterMessage, threadsAfterMessageChange, threadsAfterRead, upsertThread, withoutThread } from "./threads";

describe("threadsAfterMessage", () => {
  it("moves the thread to the top and counts the message as unread", () => {
    const list = [
      thread("t-0", { last_message_at: "2026-10-19T11:00:00Z" }),
      thread("t-1", { last_seq: 2, me: { role: "member", last_read_seq: 2, muted: false } }),
    ];
    const next = threadsAfterMessage(list, message(3, { mentions: [ME] }), ME);
    expect(next?.map((t) => t.id)).toEqual(["t-1", "t-0"]);
    expect(next?.[0]).toMatchObject({ last_seq: 3, unread: 1, unread_mentions: 1, last_message_at: "2026-10-19T12:03:00Z" });
    expect(next?.[0].last_message?.id).toBe("m-3");
  });

  it("treats my own message as read", () => {
    const list = [thread("t-1", { last_seq: 2, unread: 2, me: { role: "member", last_read_seq: 0, muted: false } })];
    const next = threadsAfterMessage(list, message(3, { author_id: ME }), ME);
    expect(next?.[0]).toMatchObject({ unread: 0, unread_mentions: 0, me: { last_read_seq: 3 } });
  });

  it("ignores a message it already counted", () => {
    const list = [thread("t-1", { last_seq: 3, unread: 1 })];
    expect(threadsAfterMessage(list, message(3), ME)).toBe(list);
  });

  it("answers null when the thread is not loaded, so the caller fetches it", () => {
    expect(threadsAfterMessage([thread("t-9")], message(1), ME)).toBeNull();
  });
});

describe("threadsAfterRead", () => {
  it("clears my unread up to the mark and keeps receipts for others", () => {
    const list = [thread("t-1", { last_seq: 5, unread: 3, unread_mentions: 1, me: { role: "member", last_read_seq: 2, muted: false } })];
    const mine = threadsAfterRead(list, { thread_id: "t-1", user_id: ME, seq: 5 }, ME);
    expect(mine[0]).toMatchObject({ unread: 0, unread_mentions: 0, me: { last_read_seq: 5 } });
    const theirs = threadsAfterRead(list, { thread_id: "t-1", user_id: "u-bia", seq: 4 }, ME);
    expect(theirs[0].members.find((m) => m.user_id === "u-bia")?.last_read_seq).toBe(4);
    expect(theirs[0].unread).toBe(3);
  });

  it("keeps mentions when the read stops before the end", () => {
    const list = [thread("t-1", { last_seq: 5, unread: 3, unread_mentions: 1, me: { role: "member", last_read_seq: 2, muted: false } })];
    expect(threadsAfterRead(list, { thread_id: "t-1", user_id: ME, seq: 4 }, ME)[0]).toMatchObject({ unread: 1, unread_mentions: 1 });
  });
});

describe("thread list edits", () => {
  it("replaces the last message when it changes", () => {
    const list = [thread("t-1", { last_message: message(3) })];
    const edited = message(3, { body: "editada", edited_at: "2026-10-19T13:00:00Z" });
    expect(threadsAfterMessageChange(list, edited)[0].last_message?.body).toBe("editada");
    expect(threadsAfterMessageChange(list, message(2, { body: "x" }))).toBe(list);
  });

  it("inserts or replaces a thread in order and removes one", () => {
    const list = [thread("t-1", { last_message_at: "2026-10-19T11:00:00Z" })];
    const added = upsertThread(list, thread("t-2", { last_message_at: "2026-10-19T12:00:00Z" }));
    expect(added.map((t) => t.id)).toEqual(["t-2", "t-1"]);
    const renamed = upsertThread(added, thread("t-1", { title: "Vendas", last_message_at: "2026-10-19T11:00:00Z" }));
    expect(renamed.find((t) => t.id === "t-1")?.title).toBe("Vendas");
    expect(withoutThread(renamed, "t-2").map((t) => t.id)).toEqual(["t-1"]);
  });
});
