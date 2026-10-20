import { describe, expect, it } from "vitest";

import {
  applyHistoryPage,
  applyLiveMessage,
  applyMessageUpdate,
  foldResent,
  mergeMessages,
  newestMessageAt,
  withPendingBubbles,
  type HistoryPage,
  type ThreadMessages,
} from "./thread-merge";
import type { ConversationMessage } from "./types";

function at(minute: number): string {
  return new Date(Date.UTC(2026, 9, 18, 10, minute)).toISOString();
}

function message(id: string, minute: number, over: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id,
    entry_id: "e1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: "5511",
    to: "me",
    text: id,
    sender_name: "",
    read: true,
    read_at: null,
    read_by: null,
    created_at: at(minute),
    updated_at: at(minute),
    ...over,
  };
}

function thread(messages: ConversationMessage[], over: Partial<ThreadMessages> = {}): ThreadMessages {
  return { messages, has_more: false, ...over };
}

function page(direction: HistoryPage["direction"], messages: ConversationMessage[], over: Partial<HistoryPage> = {}): HistoryPage {
  return { direction, messages, has_more: false, has_after: false, ...over };
}

const ids = (messages: readonly ConversationMessage[]) => messages.map((m) => m.id);

describe("mergeMessages", () => {
  it("keeps the thread in time order whatever order the pages arrive in", () => {
    const merged = mergeMessages([message("b", 2), message("d", 4)], [message("c", 3), message("a", 1)]);
    expect(ids(merged)).toEqual(["a", "b", "c", "d"]);
  });

  it("replaces a row the server sent again instead of showing it twice", () => {
    const merged = mergeMessages([message("a", 1, { text: "old" })], [message("a", 1, { text: "edited" })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe("edited");
  });

  it("never moves a delivery status backwards when an older copy of the row arrives late", () => {
    const merged = mergeMessages(
      [message("a", 1, { delivery_status: "read", read: true, read_at: at(2) })],
      [message("a", 1, { delivery_status: "delivered", read: false, read_at: null })],
    );
    expect(merged[0].delivery_status).toBe("read");
    expect(merged[0].read).toBe(true);
    expect(merged[0].read_at).toBe(at(2));
  });

  it("keeps a failed delivery failed, because only a resend creates a new row", () => {
    const merged = mergeMessages([message("a", 1, { delivery_status: "failed" })], [message("a", 1, { delivery_status: "sent" })]);
    expect(merged[0].delivery_status).toBe("failed");
  });

  it("returns the same array when nothing new arrived, so renders stay cheap", () => {
    const held = [message("a", 1)];
    expect(mergeMessages(held, [])).toBe(held);
  });
});

describe("applyHistoryPage", () => {
  it("takes the first page as the thread", () => {
    const next = applyHistoryPage(thread([]), page("latest", [message("a", 1)], { has_more: true, total: 9 }));
    expect(ids(next.messages)).toEqual(["a"]);
    expect(next.has_more).toBe(true);
    expect(next.has_after).toBe(false);
    expect(next.total).toBe(9);
  });

  it("prepends an older page and takes its has_more", () => {
    const next = applyHistoryPage(
      thread([message("c", 3)], { has_more: true }),
      page("before", [message("a", 1), message("b", 2)], { has_more: false }),
    );
    expect(ids(next.messages)).toEqual(["a", "b", "c"]);
    expect(next.has_more).toBe(false);
  });

  it("does not take the total an older page reports, because only latest and around pages carry one", () => {
    const next = applyHistoryPage(
      thread([message("c", 3)], { has_more: true, total: 40 }),
      page("before", [message("a", 1)], { has_more: true, total: 0 }),
    );
    expect(next.total).toBe(40);
  });

  it("replaces the thread with the page around a jump target and remembers newer messages exist", () => {
    const next = applyHistoryPage(
      thread([message("x", 50), message("y", 51)]),
      page("around", [message("j", 10), message("k", 11)], { has_more: true, has_after: true, total: 80 }),
    );
    expect(ids(next.messages)).toEqual(["j", "k"]);
    expect(next.has_more).toBe(true);
    expect(next.has_after).toBe(true);
    expect(next.total).toBe(80);
  });

  it("appends a newer page after a jump and stays detached while the server says more follow", () => {
    const jumped = thread([message("j", 10)], { has_after: true });
    const next = applyHistoryPage(jumped, page("after", [message("k", 11), message("l", 12)], { has_after: true }));
    expect(ids(next.messages)).toEqual(["j", "k", "l"]);
    expect(next.has_after).toBe(true);
  });

  it("does not read has_more on a newer page as 'no older history'", () => {
    const jumped = thread([message("j", 10)], { has_more: true, has_after: true });
    const next = applyHistoryPage(jumped, page("after", [message("k", 11)], { has_more: false, has_after: true }));
    expect(next.has_more).toBe(true);
  });

  it("joins the live messages that arrived while detached once the last newer page lands", () => {
    let current = thread([message("j", 10)], { has_after: true });
    current = applyLiveMessage(current, message("live", 30));
    expect(ids(current.messages)).toEqual(["j"]);

    current = applyHistoryPage(current, page("after", [message("k", 11)], { has_after: false }));
    expect(ids(current.messages)).toEqual(["j", "k", "live"]);
    expect(current.has_after).toBe(false);
    expect(current.held_live).toBeUndefined();
  });

  it("ignores a newer page that lands entirely before the thread, a stale answer", () => {
    const current = thread([message("m", 20)]);
    expect(applyHistoryPage(current, page("after", [message("a", 1)]))).toBe(current);
  });

  it("merges the latest page into a thread it overlaps, keeping the older rows already held", () => {
    const cached = thread([message("a", 1), message("b", 2)], { has_more: true });
    const next = applyHistoryPage(cached, page("latest", [message("b", 2), message("c", 3)], { has_more: true, total: 12 }));
    expect(ids(next.messages)).toEqual(["a", "b", "c"]);
    expect(next.has_more).toBe(true);
    expect(next.total).toBe(12);
  });

  it("replaces a stale thread with the latest page when the two do not touch, so no gap is shown as continuous", () => {
    const stale = thread([message("a", 1)]);
    const next = applyHistoryPage(stale, page("latest", [message("y", 50), message("z", 51)], { has_more: true }));
    expect(ids(next.messages)).toEqual(["y", "z"]);
    expect(next.has_more).toBe(true);
  });

  it("parks the latest page while a jump is open, and joins it when the thread catches up", () => {
    let current = thread([message("j", 10)], { has_after: true });
    current = applyHistoryPage(current, page("latest", [message("y", 50)], { has_more: true }));
    expect(ids(current.messages)).toEqual(["j"]);

    current = applyHistoryPage(current, page("after", [message("k", 11)], { has_after: false }));
    expect(ids(current.messages)).toEqual(["j", "k", "y"]);
  });

  it("treats a page before now that lands after the thread as the present when nothing is detached", () => {
    const stale = thread([message("a", 1)]);
    const next = applyHistoryPage(stale, page("before", [message("y", 50)], { has_more: true }));
    expect(ids(next.messages)).toEqual(["y"]);
  });

  it("keeps the thread when the subscribe page comes back empty", () => {
    const current = thread([message("a", 1)], { has_more: true });
    const next = applyHistoryPage(current, page("latest", [], { total: 1 }));
    expect(ids(next.messages)).toEqual(["a"]);
    expect(next.has_more).toBe(true);
  });
});

describe("live messages and updates", () => {
  it("appends a live message once even when it also came in a page", () => {
    let current = thread([message("a", 1)]);
    current = applyLiveMessage(current, message("b", 2));
    current = applyHistoryPage(current, page("latest", [message("a", 1), message("b", 2)]));
    expect(ids(current.messages)).toEqual(["a", "b"]);
  });

  it("replaces an updated row by id", () => {
    const current = thread([message("a", 1, { text: "hi" })]);
    const next = applyMessageUpdate(current, message("a", 1, { text: "", retracted_at: at(5) }));
    expect(next.messages[0].retracted_at).toBe(at(5));
  });

  it("does not add an updated row the thread never loaded", () => {
    const current = thread([message("a", 1)]);
    expect(applyMessageUpdate(current, message("z", 9))).toBe(current);
  });

  it("updates a parked live row too", () => {
    const current = applyLiveMessage(thread([message("j", 1)], { has_after: true }), message("live", 9, { text: "x" }));
    const next = applyMessageUpdate(current, message("live", 9, { text: "y" }));
    expect(next.held_live?.[0].text).toBe("y");
  });
});

describe("catch up helpers", () => {
  it("names the newest held message as the cursor for load_after", () => {
    expect(newestMessageAt(thread([message("a", 1), message("b", 7)]))).toBe(at(7));
    expect(newestMessageAt(thread([]))).toBeNull();
  });

  it("catches a reconnected thread up with the newer page and keeps it attached when the page reaches the present", () => {
    const held = thread([message("a", 1), message("b", 2)]);
    const next = applyHistoryPage(held, page("after", [message("c", 3)], { has_after: false }));
    expect(ids(next.messages)).toEqual(["a", "b", "c"]);
    expect(next.has_after).toBe(false);
  });

  it("does not let a newer page that ends before the thread's newest message detach it", () => {
    const caughtUp = thread([message("b", 2), message("y", 50)]);
    const next = applyHistoryPage(caughtUp, page("after", [message("c", 3), message("d", 4)], { has_after: true }));
    expect(ids(next.messages)).toEqual(["b", "c", "d", "y"]);
    expect(next.has_after).toBe(false);
  });
});

describe("folding", () => {
  it("hides a failed row once the message that replaced it is in the thread", () => {
    const folded = foldResent([message("a", 1, { resent_as: "b", delivery_status: "failed" }), message("b", 2)]);
    expect(ids(folded)).toEqual(["b"]);
  });

  it("keeps a failed row while its replacement is not loaded", () => {
    const held = [message("a", 1, { resent_as: "b", delivery_status: "failed" })];
    expect(foldResent(held)).toBe(held);
  });

  it("drops a pending bubble once the real message with its request id is in the thread", () => {
    const pending = message("pending:r1", 9, { client_request_id: "r1" });
    const other = message("pending:r2", 9, { client_request_id: "r2" });
    const shown = withPendingBubbles([message("a", 1, { client_request_id: "r1" })], [pending, other]);
    expect(ids(shown)).toEqual(["a", "pending:r2"]);
  });

  it("returns the thread itself when nothing is pending", () => {
    const held = [message("a", 1)];
    expect(withPendingBubbles(held, [])).toBe(held);
  });
});
