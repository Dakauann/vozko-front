import { describe, expect, it } from "vitest";

import { conversationHref, readConversationDeepLink } from "./deep-link";

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

  it("defaults to whatsapp when the type is missing, as older links carry only the entry", () => {
    expect(readConversationDeepLink(`?entry=${id}`)).toEqual({ entryId: id, entryType: "whatsapp" });
  });

  it("refuses unknown channels and malformed ids", () => {
    for (const search of [`?entry=${id}&type=fax`, "?entry=../../admin&type=whatsapp", "?entry=&type=whatsapp", "", "?type=whatsapp"]) {
      expect(readConversationDeepLink(search)).toBeNull();
    }
  });
});
