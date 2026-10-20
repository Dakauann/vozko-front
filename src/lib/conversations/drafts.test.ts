import { describe, expect, it, vi } from "vitest";

import { createDraftStore, draftPreview, isEmptyDraft, type ConversationDraft, type DraftStoragePort } from "./drafts";

function memoryStorage(seed: Record<string, string> = {}): DraftStoragePort & { entries: Map<string, string> } {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    get length() {
      return entries.size;
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  };
}

function throwingStorage(): DraftStoragePort {
  const fail = () => {
    throw new Error("storage blocked");
  };
  return {
    get length(): number {
      return fail();
    },
    key: fail,
    getItem: fail,
    setItem: fail,
    removeItem: fail,
  };
}

const ana = { workspaceId: "ws-1", userId: "user-ana" };
const bruno = { workspaceId: "ws-1", userId: "user-bruno" };

const draft: ConversationDraft = {
  text: "Seu boleto vence amanhã",
  reply: { id: "msg-9", sender_name: "Carla", from: "5511", text: "Quando vence?" },
  attachments: [{ mediaId: "media-1", type: "image", name: "boleto.png", size: 2048 }],
};

describe("conversation drafts", () => {
  it("gives back what was written for the same workspace, user and conversation", () => {
    const store = createDraftStore(memoryStorage());
    store.write(ana, "whatsapp-e1", draft);
    expect(store.read(ana, "whatsapp-e1")).toEqual(draft);
  });

  it("keeps each operator's drafts apart, so a shared browser never shows a colleague's words", () => {
    const store = createDraftStore(memoryStorage());
    store.write(ana, "whatsapp-e1", draft);
    expect(store.read(bruno, "whatsapp-e1")).toBeNull();
    expect(store.read({ ...ana, workspaceId: "ws-2" }, "whatsapp-e1")).toBeNull();
    expect(store.read(ana, "whatsapp-e2")).toBeNull();
  });

  it("keeps an internal note draft apart from the message draft of the same conversation", () => {
    const storage = memoryStorage();
    const store = createDraftStore(storage);
    store.write(ana, "whatsapp-e1", draft);
    store.write(ana, "whatsapp-e1", { text: "@Bruno olha isso", attachments: [] }, "note");
    expect(store.read(ana, "whatsapp-e1")).toEqual(draft);
    expect(store.read(ana, "whatsapp-e1", "note")?.text).toBe("@Bruno olha isso");
    store.clear(ana, "whatsapp-e1", "note");
    expect(store.read(ana, "whatsapp-e1", "note")).toBeNull();
    expect(store.read(ana, "whatsapp-e1")).toEqual(draft);
  });

  it("clears note drafts on logout too", () => {
    const store = createDraftStore(memoryStorage());
    store.write(ana, "whatsapp-e1", { text: "nota", attachments: [] }, "note");
    store.clearUser(ana.userId);
    expect(store.read(ana, "whatsapp-e1", "note")).toBeNull();
  });

  it("removes the draft once it is empty instead of storing blanks", () => {
    const storage = memoryStorage();
    const store = createDraftStore(storage);
    store.write(ana, "whatsapp-e1", draft);
    store.write(ana, "whatsapp-e1", { text: "   ", attachments: [] });
    expect(store.read(ana, "whatsapp-e1")).toBeNull();
    expect(storage.entries.size).toBe(0);
  });

  it("clears one conversation when its send is accepted", () => {
    const store = createDraftStore(memoryStorage());
    store.write(ana, "whatsapp-e1", draft);
    store.write(ana, "whatsapp-e2", draft);
    store.clear(ana, "whatsapp-e1");
    expect(store.read(ana, "whatsapp-e1")).toBeNull();
    expect(store.read(ana, "whatsapp-e2")).toEqual(draft);
  });

  it("clears every draft of a user on logout and leaves other users and other keys alone", () => {
    const storage = memoryStorage({ sendSigned: "true" });
    const store = createDraftStore(storage);
    store.write(ana, "whatsapp-e1", draft);
    store.write({ ...ana, workspaceId: "ws-2" }, "instagram-e3", draft);
    store.write(bruno, "whatsapp-e1", draft);

    store.clearUser("user-ana");

    expect(store.read(ana, "whatsapp-e1")).toBeNull();
    expect(store.read({ ...ana, workspaceId: "ws-2" }, "instagram-e3")).toBeNull();
    expect(store.read(bruno, "whatsapp-e1")).toEqual(draft);
    expect(storage.entries.get("sendSigned")).toBe("true");
  });

  it.each([
    ["not json", "{oops"],
    ["a bare string", JSON.stringify("hello")],
    ["text of the wrong type", JSON.stringify({ text: 42, attachments: [] })],
    ["attachments that are not a list", JSON.stringify({ text: "oi", attachments: "x" })],
    ["an attachment without a media id", JSON.stringify({ text: "oi", attachments: [{ type: "image", name: "a", size: 1 }] })],
    ["an attachment of an unknown kind", JSON.stringify({ text: "oi", attachments: [{ mediaId: "m", type: "virus", name: "a", size: 1 }] })],
    ["a reply target without an id", JSON.stringify({ text: "oi", attachments: [], reply: { sender_name: "x", from: "y", text: "z" } })],
  ])("reads %s as no draft", (_case, raw) => {
    const storage = memoryStorage();
    const store = createDraftStore(storage);
    store.write(ana, "whatsapp-e1", draft);
    const key = storage.key(0)!;
    storage.setItem(key, raw);
    expect(store.read(ana, "whatsapp-e1")).toBeNull();
  });

  it("never throws when the browser refuses storage, and simply has no drafts", () => {
    const store = createDraftStore(throwingStorage());
    expect(() => store.write(ana, "whatsapp-e1", draft)).not.toThrow();
    expect(store.read(ana, "whatsapp-e1")).toBeNull();
    expect(() => store.clear(ana, "whatsapp-e1")).not.toThrow();
    expect(() => store.clearUser("user-ana")).not.toThrow();
  });

  it("works without any storage at all", () => {
    const store = createDraftStore(null);
    store.write(ana, "whatsapp-e1", draft);
    expect(store.read(ana, "whatsapp-e1")).toBeNull();
  });

  it("tells subscribers which conversation changed so inbox rows can refresh", () => {
    const store = createDraftStore(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.write(ana, "whatsapp-e1", draft);
    store.clear(ana, "whatsapp-e1");
    unsubscribe();
    store.write(ana, "whatsapp-e2", draft);

    expect(listener.mock.calls).toEqual([["whatsapp-e1"], ["whatsapp-e1"]]);
  });

  it("tells subscribers about a logout wipe", () => {
    const store = createDraftStore(memoryStorage());
    const listener = vi.fn();
    store.write(ana, "whatsapp-e1", draft);
    store.subscribe(listener);
    store.clearUser("user-ana");
    expect(listener).toHaveBeenCalledWith(null);
  });
});

describe("isEmptyDraft", () => {
  it("treats a reply target alone as worth keeping", () => {
    expect(isEmptyDraft({ text: "", attachments: [], reply: draft.reply })).toBe(false);
  });

  it("treats whitespace as nothing", () => {
    expect(isEmptyDraft({ text: " \n ", attachments: [] })).toBe(true);
  });
});

describe("draftPreview", () => {
  it("shows the text on one line", () => {
    expect(draftPreview({ text: "Olá\n  tudo bem?", attachments: [] })).toBe("Olá tudo bem?");
  });

  it("falls back to the first attachment name when there is no text", () => {
    expect(draftPreview({ text: "", attachments: draft.attachments })).toBe("boleto.png");
  });

  it("has nothing to show for a reply target alone", () => {
    expect(draftPreview({ text: "", attachments: [], reply: draft.reply })).toBeNull();
  });

  it("has nothing to show without a draft", () => {
    expect(draftPreview(null)).toBeNull();
  });
});
