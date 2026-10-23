import { describe, expect, it } from "vitest";

import { conversationHref, needsHistoryEntry, readConversationDeepLink, sameConversation, withConversationDeepLink } from "./deep-link";

const id = "0b0e7c1e-3a7a-4c55-9d7c-2a1c0f1e9b11";

describe("conversationHref", () => {
  it("points the live chat at one conversation", () => {
    expect(conversationHref(id, "instagram")).toBe(`/dashboard/live-chat?entry=${id}&type=instagram`);
  });
});

describe("readConversationDeepLink", () => {
  it("reads the conversation from the query string", () => {
    expect(readConversationDeepLink(`?entry=${id}&type=whatsapp`)).toEqual({ entryId: id, entryType: "whatsapp" });
  });

  it("reads a Messenger conversation", () => {
    expect(readConversationDeepLink(`?entry=${id}&type=facebook`)).toEqual({ entryId: id, entryType: "facebook" });
  });

  it("opens nothing when the type is missing, instead of guessing a channel", () => {
    expect(readConversationDeepLink(`?entry=${id}`)).toBeNull();
    expect(readConversationDeepLink(`?entry=${id}&type=`)).toBeNull();
  });

  it("reads every channel a conversation can live on", () => {
    for (const entryType of ["whatsapp", "instagram", "facebook", "telegram", "unofficial_whatsapp", "webchat", "mercadolivre", "tiktok", "email"] as const) {
      expect(readConversationDeepLink(conversationHref(id, entryType).split("?")[1])).toEqual({ entryId: id, entryType });
    }
  });

  it("refuses unknown channels and malformed ids", () => {
    for (const search of [`?entry=${id}&type=fax`, "?entry=../../admin&type=whatsapp", "?entry=&type=whatsapp", "", "?type=whatsapp"]) {
      expect(readConversationDeepLink(search)).toBeNull();
    }
  });
});

describe("withConversationDeepLink", () => {
  it("writes the open conversation beside the board params, which stay as they were", () => {
    const search = withConversationDeepLink("?g=stage&f=abc&p=pipe&pt=conversation", { entryId: id, entryType: "telegram" });
    const params = new URLSearchParams(search);
    expect(params.get("entry")).toBe(id);
    expect(params.get("type")).toBe("telegram");
    expect(params.get("g")).toBe("stage");
    expect(params.get("f")).toBe("abc");
    expect(params.get("p")).toBe("pipe");
    expect(params.get("pt")).toBe("conversation");
  });

  it("drops the conversation and nothing else when none is open", () => {
    expect(withConversationDeepLink(`?g=label&entry=${id}&type=whatsapp`, null)).toBe("?g=label");
  });

  it("writes an empty search when nothing is left", () => {
    expect(withConversationDeepLink(`?entry=${id}&type=whatsapp`, null)).toBe("");
  });

  it("is read back by the parser, so one module owns both directions", () => {
    const link = { entryId: id, entryType: "webchat" } as const;
    expect(readConversationDeepLink(withConversationDeepLink("?v=view-1", link))).toEqual(link);
  });
});

describe("sameConversation", () => {
  it("compares id and channel, and treats two empty sides as the same", () => {
    expect(sameConversation({ entryId: id, entryType: "whatsapp" }, { entryId: id, entryType: "whatsapp" })).toBe(true);
    expect(sameConversation({ entryId: id, entryType: "whatsapp" }, { entryId: id, entryType: "instagram" })).toBe(false);
    expect(sameConversation(null, { entryId: id, entryType: "whatsapp" })).toBe(false);
    expect(sameConversation(null, null)).toBe(true);
  });
});

describe("needsHistoryEntry", () => {
  const a = { entryId: id, entryType: "whatsapp" } as const;
  const b = { entryId: "other-entry", entryType: "instagram" } as const;

  it("adds a history entry when the operator opens another conversation", () => {
    expect(needsHistoryEntry({ previous: a, current: b, inUrl: a })).toBe(true);
    expect(needsHistoryEntry({ previous: null, current: a, inUrl: null })).toBe(true);
  });

  it("adds a history entry when the operator closes the conversation, so back reopens it", () => {
    expect(needsHistoryEntry({ previous: a, current: null, inUrl: a })).toBe(true);
  });

  it("adds nothing when the address already shows it, as after back, forward or a shared link", () => {
    expect(needsHistoryEntry({ previous: a, current: b, inUrl: b })).toBe(false);
    expect(needsHistoryEntry({ previous: a, current: null, inUrl: null })).toBe(false);
  });

  it("adds nothing when the open conversation did not change", () => {
    expect(needsHistoryEntry({ previous: a, current: a, inUrl: null })).toBe(false);
  });
});
