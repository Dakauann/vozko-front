import { describe, expect, it } from "vitest";

import {
  TIMELINE_AUTO_EMPTY_PAGES,
  autoLoadsNextPage,
  dealsOf,
  isLocationEvent,
  leadConversationLinks,
  readDealsPage,
  readTimelinePage,
  timelineEntryLink,
  timelineItemsOf,
  type LeadTimelineItem,
} from "../timeline";

function item(overrides: Partial<LeadTimelineItem> = {}): LeadTimelineItem {
  return {
    id: "conversation:whatsapp:e-1",
    kind: "conversation",
    at: "2026-10-08T14:32:00Z",
    ref: { type: "entry", id: "e-1", entryType: "whatsapp" },
    summary: { channel: "whatsapp" },
    ...overrides,
  };
}

describe("readTimelinePage", () => {
  it("reads the items, the cursor and the lead the server answered", () => {
    const page = readTimelinePage({
      leadId: "lead-1",
      items: [item(), item({ id: "call:c-1", kind: "call", ref: { type: "call", id: "sip-1" }, summary: { direction: "outbound", durationSec: 42 } })],
      next: "cur-1",
    });

    expect(page?.leadId).toBe("lead-1");
    expect(page?.next).toBe("cur-1");
    expect(page?.items.map((entry) => entry.kind)).toEqual(["conversation", "call"]);
  });

  it("refuses an answer that is not a page", () => {
    expect(readTimelinePage(null)).toBeNull();
    expect(readTimelinePage({ leadId: "lead-1" })).toBeNull();
    expect(readTimelinePage({ leadId: "lead-1", items: "x" })).toBeNull();
  });

  it("drops an item of a kind this screen does not know, or without an id or a time", () => {
    const page = readTimelinePage({
      leadId: "lead-1",
      items: [item({ kind: "sms" as LeadTimelineItem["kind"] }), item({ id: "" }), item({ at: "not a date" }), item({ id: "memory:m-1", kind: "memory", ref: { type: "memory", id: "m-1" } })],
    });

    expect(page?.items.map((entry) => entry.id)).toEqual(["memory:m-1"]);
    expect(page?.next).toBeUndefined();
  });

  it("reads a deal stage move with the stage names the server resolved", () => {
    const page = readTimelinePage({
      leadId: "lead-1",
      items: [
        item({
          id: "deal_event:ev-1",
          kind: "deal_event",
          ref: { type: "deal", id: "d-1" },
          summary: { event: "stage_moved", title: "Matrícula", stageId: "st-2", fromStageId: "st-1", stageName: "Visita agendada", fromStageName: "Novo contato" },
        }),
      ],
    });

    expect(page?.items[0]).toMatchObject({ kind: "deal_event", ref: { type: "deal", id: "d-1" }, summary: { stageName: "Visita agendada", fromStageName: "Novo contato" } });
  });

  it("reads the outcome a call list recorded for a call", () => {
    const page = readTimelinePage({
      leadId: "lead-1",
      items: [item({ id: "call:c-1", kind: "call", ref: { type: "call", id: "c-1" }, summary: { disposition: "_callback", callbackAt: "2026-10-09T12:00:00Z", callListId: "cl-1" } })],
    });

    expect(page?.items[0].summary).toMatchObject({ disposition: "_callback", callbackAt: "2026-10-09T12:00:00Z", callListId: "cl-1" });
  });

  it("keeps a short or empty page that still carries the cursor", () => {
    expect(readTimelinePage({ leadId: "lead-1", items: [], next: "cur-2" })).toEqual({ leadId: "lead-1", items: [], next: "cur-2" });
  });

  it("gives every item a summary and a list of fields even when the server left them out", () => {
    const page = readTimelinePage({ leadId: "lead-1", items: [{ id: "record:ev-1", kind: "record", at: "2026-10-08T14:32:00Z", ref: { type: "lead_event", id: "ev-1" } }] });

    expect(page?.items[0].summary).toEqual({ fields: [] });
  });
});

describe("readDealsPage", () => {
  it("reads the deals and the cursor", () => {
    const page = readDealsPage({ leadId: "lead-1", deals: [{ id: "d-1", title: "Matrícula", status: "open" }], next: "cur-1" });

    expect(page?.deals.map((deal) => deal.id)).toEqual(["d-1"]);
    expect(page?.next).toBe("cur-1");
  });

  it("refuses an answer without a deal list", () => {
    expect(readDealsPage({ leadId: "lead-1" })).toBeNull();
    expect(readDealsPage(undefined)).toBeNull();
  });

  it("drops a deal without an id", () => {
    expect(readDealsPage({ leadId: "lead-1", deals: [{ title: "x" }, { id: "d-2" }] })?.deals.map((deal) => deal.id)).toEqual(["d-2"]);
  });
});

describe("timelineItemsOf", () => {
  it("joins the pages in order and shows an item only once", () => {
    const pages = [
      { leadId: "lead-1", items: [item({ id: "a" }), item({ id: "b" })], next: "cur-1" },
      { leadId: "lead-1", items: [], next: "cur-2" },
      { leadId: "lead-1", items: [item({ id: "b" }), item({ id: "c" })] },
    ];

    expect(timelineItemsOf(pages).map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("is empty before the first page", () => {
    expect(timelineItemsOf(undefined)).toEqual([]);
  });
});

describe("dealsOf", () => {
  it("joins the pages and shows a deal only once", () => {
    const deal = (id: string) => ({ id }) as never;
    expect(dealsOf([{ leadId: "l", deals: [deal("d-1")] }, { leadId: "l", deals: [deal("d-1"), deal("d-2")] }]).map((d) => d.id)).toEqual(["d-1", "d-2"]);
  });
});

describe("timelineEntryLink", () => {
  it("opens the conversation of a conversation or a campaign send", () => {
    expect(timelineEntryLink(item())).toEqual({ entryId: "e-1", entryType: "whatsapp" });
    expect(
      timelineEntryLink(item({ kind: "campaign_read", ref: { type: "entry", id: "u-9", entryType: "unofficial_whatsapp" } })),
    ).toEqual({ entryId: "u-9", entryType: "unofficial_whatsapp" });
  });

  it("opens nothing for a reference that is not a conversation the inbox can open", () => {
    expect(timelineEntryLink(item({ ref: { type: "entry", id: "", entryType: "whatsapp" } }))).toBeNull();
    expect(timelineEntryLink(item({ ref: { type: "entry", id: "e-1", entryType: "voice" } }))).toBeNull();
    expect(timelineEntryLink(item({ ref: { type: "entry", id: "e-1" } }))).toBeNull();
    expect(timelineEntryLink(item({ kind: "call", ref: { type: "call", id: "sip-1" } }))).toBeNull();
    expect(timelineEntryLink(item({ ref: { type: "entry", id: "../x", entryType: "whatsapp" } }))).toBeNull();
  });
});

describe("isLocationEvent", () => {
  it("tells a pinned or accepted map position apart from other record changes", () => {
    const record = (event: string) => item({ kind: "record", ref: { type: "lead_event", id: "ev-1" }, summary: { event, fields: ["addresses"] } });
    expect(isLocationEvent(record("location_pinned"))).toBe(true);
    expect(isLocationEvent(record("location_accepted"))).toBe(true);
    expect(isLocationEvent(record("updated"))).toBe(false);
    expect(isLocationEvent(item({ kind: "memory", ref: { type: "memory", id: "m-1" }, summary: { event: "location_pinned" } }))).toBe(false);
  });
});

describe("autoLoadsNextPage", () => {
  it("keeps loading by itself while pages keep bringing items", () => {
    expect(autoLoadsNextPage([30, 30, 2])).toBe(true);
    expect(autoLoadsNextPage([])).toBe(true);
  });

  it("keeps loading past a few empty pages, then waits for the person to ask", () => {
    const empties = Array.from({ length: TIMELINE_AUTO_EMPTY_PAGES - 1 }, () => 0);
    expect(autoLoadsNextPage([30, ...empties])).toBe(true);
    expect(autoLoadsNextPage([30, ...empties, 0])).toBe(false);
    expect(autoLoadsNextPage([...empties, 0, 3])).toBe(true);
  });
});

describe("leadConversationLinks", () => {
  const current = { entryId: "e-1", entryType: "whatsapp" } as const;

  it("lists each other conversation of the contact once, newest first, without the open one", () => {
    const items = [
      item({ id: "1", at: "2026-10-10T10:00:00Z" }),
      item({ id: "2", kind: "campaign_read", at: "2026-10-09T10:00:00Z", ref: { type: "entry", id: "u-9", entryType: "unofficial_whatsapp" } }),
      item({ id: "3", at: "2026-10-08T10:00:00Z", ref: { type: "entry", id: "i-4", entryType: "instagram" } }),
      item({ id: "4", kind: "campaign_sent", at: "2026-10-07T10:00:00Z", ref: { type: "entry", id: "u-9", entryType: "unofficial_whatsapp" } }),
    ];
    expect(leadConversationLinks(items, current)).toEqual([
      { entryId: "u-9", entryType: "unofficial_whatsapp", at: "2026-10-09T10:00:00Z" },
      { entryId: "i-4", entryType: "instagram", at: "2026-10-08T10:00:00Z" },
    ]);
  });

  it("skips events that do not point at a conversation the inbox can open", () => {
    const items = [item({ id: "c", kind: "call", ref: { type: "call", id: "sip-1" } }), item({ id: "v", ref: { type: "entry", id: "e-7", entryType: "voice" } })];
    expect(leadConversationLinks(items, current)).toEqual([]);
  });

  it("keeps the same id on another channel, which is another conversation", () => {
    const items = [item({ id: "x", ref: { type: "entry", id: "e-1", entryType: "telegram" } })];
    expect(leadConversationLinks(items, current)).toEqual([{ entryId: "e-1", entryType: "telegram", at: "2026-10-08T14:32:00Z" }]);
  });

  it("names the campaign a conversation came from, even when only an older event carries it, so two WhatsApp lines read apart", () => {
    const items = [
      item({ id: "1", at: "2026-10-10T10:00:00Z", ref: { type: "entry", id: "u-9", entryType: "unofficial_whatsapp" }, summary: { channel: "unofficial_whatsapp" } }),
      item({ id: "2", kind: "campaign_sent", at: "2026-10-09T10:00:00Z", ref: { type: "entry", id: "u-9", entryType: "unofficial_whatsapp" }, summary: { channel: "unofficial_whatsapp", title: "  Volta às aulas " } }),
      item({ id: "3", kind: "campaign_read", at: "2026-10-08T10:00:00Z", ref: { type: "entry", id: "w-2", entryType: "whatsapp" }, summary: { channel: "whatsapp", title: "" } }),
    ];
    expect(leadConversationLinks(items, { entryId: "e-1", entryType: "instagram" })).toEqual([
      { entryId: "u-9", entryType: "unofficial_whatsapp", at: "2026-10-10T10:00:00Z", campaign: "Volta às aulas" },
      { entryId: "w-2", entryType: "whatsapp", at: "2026-10-08T10:00:00Z" },
    ]);
  });

  it("names the line each conversation runs on, so two conversations on the same channel read apart", () => {
    const items = [
      item({ id: "1", at: "2026-10-10T10:00:00Z", ref: { type: "entry", id: "w-2", entryType: "whatsapp" }, summary: { channel: "whatsapp", line: " +55 11 4000-1000 " } }),
      item({ id: "2", at: "2026-10-09T10:00:00Z", ref: { type: "entry", id: "w-3", entryType: "whatsapp" }, summary: { channel: "whatsapp", line: "+55 11 4000-2000" } }),
      item({ id: "3", kind: "campaign_read", at: "2026-10-08T10:00:00Z", ref: { type: "entry", id: "w-3", entryType: "whatsapp" }, summary: { channel: "whatsapp", title: "Volta às aulas" } }),
      item({ id: "4", at: "2026-10-07T10:00:00Z", ref: { type: "entry", id: "t-1", entryType: "telegram" }, summary: { channel: "telegram", line: "  " } }),
    ];
    expect(leadConversationLinks(items, current)).toEqual([
      { entryId: "w-2", entryType: "whatsapp", at: "2026-10-10T10:00:00Z", line: "+55 11 4000-1000" },
      { entryId: "w-3", entryType: "whatsapp", at: "2026-10-09T10:00:00Z", line: "+55 11 4000-2000", campaign: "Volta às aulas" },
      { entryId: "t-1", entryType: "telegram", at: "2026-10-07T10:00:00Z" },
    ]);
  });

  it("takes the line from the conversation even when a campaign event about it comes first", () => {
    const items = [
      item({ id: "1", kind: "campaign_read", at: "2026-10-10T10:00:00Z", ref: { type: "entry", id: "u-9", entryType: "unofficial_whatsapp" }, summary: { channel: "unofficial_whatsapp", title: "Volta às aulas" } }),
      item({ id: "2", at: "2026-10-09T10:00:00Z", ref: { type: "entry", id: "u-9", entryType: "unofficial_whatsapp" }, summary: { channel: "unofficial_whatsapp", line: "Comercial" } }),
    ];
    expect(leadConversationLinks(items, current)).toEqual([
      { entryId: "u-9", entryType: "unofficial_whatsapp", at: "2026-10-10T10:00:00Z", campaign: "Volta às aulas", line: "Comercial" },
    ]);
  });
});
