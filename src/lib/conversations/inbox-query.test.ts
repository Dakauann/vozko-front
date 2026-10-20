import { describe, expect, it } from "vitest";

import { inboxCanHaveGroups, needsServerList } from "./inbox-query";

describe("whether the inbox needs a server search", () => {
  it("stays on the live inbox for a plain page, with or without a status", () => {
    expect(needsServerList({ page: 1, page_size: 20 })).toBe(false);
    expect(needsServerList({ page: 1, page_size: 20, conversation_status: "new" })).toBe(false);
    expect(needsServerList({ page: 1, sort: "recent" })).toBe(false);
  });

  it.each([
    ["a query", { query: "ana" }],
    ["a stage", { stage_id: "s1" }],
    ["a label", { label_id: "l1" }],
    ["the waiting sort", { sort: "waiting" as const }],
    ["the pinned view", { personal: "pinned" as const }],
    ["a closed window", { window_open: false }],
    ["read conversations", { has_unread: false }],
    ["a responsible", { responsible_kind: "ai" as const }],
    ["unassigned", { responsible_unassigned: true }],
    ["only groups", { is_group: true }],
    ["only people", { is_group: false }],
  ])("searches the server for %s", (_name, payload) => {
    expect(needsServerList({ page: 1, ...payload })).toBe(true);
  });
});

describe("whether the inbox can hold group conversations", () => {
  it("offers the groups filter on the global inbox and on unofficial WhatsApp, never on the official one", () => {
    expect(inboxCanHaveGroups(undefined)).toBe(true);
    expect(inboxCanHaveGroups("unofficial_whatsapp")).toBe(true);
    expect(inboxCanHaveGroups("whatsapp")).toBe(false);
  });
});
