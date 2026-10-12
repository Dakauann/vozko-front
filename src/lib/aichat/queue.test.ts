import { describe, expect, it } from "vitest";

import { addQueued, deliveredFromPayload, newClientId, queuedAsUser, queuedFromPayload, removeQueued, restoreQueued, withoutQueued, type QueuedMessage } from "./queue";

const first: QueuedMessage = { clientId: "c1", content: "use o azul", createdAt: "2026-10-10T12:00:00Z" };
const second: QueuedMessage = { clientId: "c2", content: "e o logo?", createdAt: "2026-10-10T12:00:01Z" };

describe("queue list", () => {
  it("keeps typing order and ignores a repeated client id", () => {
    const list = addQueued(addQueued(addQueued([], first), second), { ...first, content: "repetida" });
    expect(list.map((q) => q.clientId)).toEqual(["c1", "c2"]);
    expect(list[0].content).toBe("use o azul");
  });

  it("removes one message or every delivered one", () => {
    expect(removeQueued([first, second], "c1")).toEqual([second]);
    expect(withoutQueued([first, second], ["c2", "c1"])).toEqual([]);
    expect(withoutQueued([first, second], [])).toEqual([first, second]);
  });

  it("puts a message whose removal failed back in its place", () => {
    expect(restoreQueued([second], first).map((q) => q.clientId)).toEqual(["c1", "c2"]);
    expect(restoreQueued([first, second], first)).toEqual([first, second]);
  });

  it("makes a fresh client id the server accepts", () => {
    const a = newClientId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(newClientId()).not.toBe(a);
  });
});

describe("queue payloads", () => {
  it("reads a queued event and refuses one without a client id", () => {
    expect(queuedFromPayload({ clientId: "c1", content: "oi", createdAt: "2026-10-10T12:00:00Z" })).toEqual({ clientId: "c1", content: "oi", createdAt: "2026-10-10T12:00:00Z" });
    expect(queuedFromPayload({ content: "oi" })).toBeNull();
    expect(queuedFromPayload(null)).toBeNull();
  });

  it("reads the delivered messages with their saved ids", () => {
    const delivered = deliveredFromPayload({
      messages: [
        { id: "m1", clientId: "c1", content: "um", createdAt: "2026-10-10T12:00:00Z", attachments: [{ mediaId: "x", name: "a.png", kind: "image" }] },
        { content: "sem id" },
      ],
    });
    expect(delivered).toEqual([{ id: "m1", clientId: "c1", content: "um", createdAt: "2026-10-10T12:00:00Z", attachments: [{ mediaId: "x", name: "a.png", kind: "image" }] }]);
    expect(deliveredFromPayload({})).toEqual([]);
  });

  it("turns a queued message into the user message it becomes", () => {
    expect(queuedAsUser({ ...first, id: "m1" })).toEqual({ id: "m1", clientId: "c1", role: "user", content: "use o azul", createdAt: "2026-10-10T12:00:00Z" });
    expect(queuedAsUser(second).id).toBe("q-c2");
  });
});
