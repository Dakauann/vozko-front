import { describe, expect, it } from "vitest";

import { ME, message, thread } from "./fixtures.test-helpers";
import { lastSeq, mergeMessages, missedAfter, pendingAfterDelivery, readByOthers, threadRows, threadTitle, type PendingMessage } from "./messages";

describe("mergeMessages", () => {
  it("dedupes by id, keeps the newest copy and orders by seq", () => {
    const merged = mergeMessages([message(3), message(1)], [message(2), message(3, { body: "editada" })]);
    expect(merged.map((m) => m.seq)).toEqual([1, 2, 3]);
    expect(merged[2].body).toBe("editada");
  });
});

describe("missedAfter", () => {
  it("asks to catch up when an arrival skips sequences", () => {
    expect(missedAfter([message(1), message(2)], message(5))).toBe(2);
    expect(missedAfter([message(1), message(2)], message(3))).toBeNull();
    expect(missedAfter([], message(9))).toBeNull();
  });
});

describe("pendingAfterDelivery", () => {
  it("drops pending sends once their message arrives", () => {
    const pending: PendingMessage[] = [
      { client_id: "c-1", body: "oi", mentions: [], created_at: "2026-10-19T12:00:00Z", failed: false },
      { client_id: "c-2", body: "tudo", mentions: [], created_at: "2026-10-19T12:00:01Z", failed: false },
    ];
    const left = pendingAfterDelivery(pending, [message(4, { client_id: "c-1", author_id: ME })]);
    expect(left.map((p) => p.client_id)).toEqual(["c-2"]);
  });
});

describe("lastSeq", () => {
  it("is zero for an empty list", () => {
    expect(lastSeq([])).toBe(0);
    expect(lastSeq([message(2), message(7)])).toBe(7);
  });
});

describe("threadRows", () => {
  it("adds a day row when the day changes and places each message in its author run", () => {
    const rows = threadRows(
      [
        message(1, { created_at: "2026-10-18T12:00:00Z" }),
        message(2, { created_at: "2026-10-19T12:00:00Z" }),
        message(3, { created_at: "2026-10-19T12:01:00Z" }),
        message(4, { created_at: "2026-10-19T12:02:00Z", author_id: ME, author_name: "Eu" }),
        message(5, { created_at: "2026-10-19T12:03:00Z", kind: "system", event: "renamed", body: "Vendas" }),
      ],
      "America/Sao_Paulo",
    );
    expect(rows.map((r) => r.kind)).toEqual(["day", "message", "day", "message", "message", "message", "system"]);
    const positions = rows.filter((r) => r.kind === "message").map((r) => (r.kind === "message" ? r.position : null));
    expect(positions).toEqual(["single", "first", "last", "single"]);
  });
});

describe("readByOthers", () => {
  it("is true once another member read up to the message", () => {
    const t = thread("t-1", {
      members: [
        { user_id: ME, name: "Eu", picture: "", role: "member", last_read_seq: 9 },
        { user_id: "u-bia", name: "Bia", picture: "", role: "member", last_read_seq: 4 },
      ],
    });
    expect(readByOthers(t, message(4), ME)).toBe(true);
    expect(readByOthers(t, message(5), ME)).toBe(false);
  });
});

describe("threadTitle", () => {
  it("names a direct thread after the other person and a group by its title", () => {
    expect(threadTitle(thread("t-1"), ME)).toBe("Bia");
    expect(threadTitle(thread("t-2", { kind: "group", title: "Vendas" }), ME)).toBe("Vendas");
  });
});
