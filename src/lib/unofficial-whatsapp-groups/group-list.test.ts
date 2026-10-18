import { describe, expect, it } from "vitest";

import type { GroupRow, NumberSeat } from "./types";

import {
  DEFAULT_PAGE_SIZE,
  columnSort,
  keepSelectedRows,
  listStats,
  maxMessages,
  netGrowth,
  pageWithinTotal,
  parsePageSize,
  postingCount,
  seatsNeedAttention,
  sortRows,
  toggleClientSort,
  toggleServerSort,
} from "./group-list";

function seat(instanceId: string, canPost = true, connected = true): NumberSeat {
  return { instanceId, label: `Número ${instanceId}`, connected, admin: false, canPost };
}

function row(id: string, overrides: Partial<GroupRow> = {}, group: Partial<GroupRow["group"]> = {}): GroupRow {
  return {
    group: {
      id,
      workspaceId: "w",
      jid: `${id}@g.us`,
      subject: `Grupo ${id}`,
      origin: "external",
      announce: false,
      locked: false,
      memberCount: 0,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      ...group,
    },
    numbers: [],
    activity: { messages: 0, joins: 0, leaves: 0 },
    hasAnalysis: false,
    runningCampaigns: 0,
    ...overrides,
  };
}

function summary(positivity: number, highAlertPct = 0): GroupRow["summary"] {
  return { sentiment: "neutral", positivity, cycles: 1, messages: 3, highAlertPct, themes: [], mentions: [] };
}

describe("netGrowth", () => {
  it("is joins minus leaves", () => {
    expect(netGrowth({ messages: 0, joins: 7, leaves: 10 })).toBe(-3);
  });
});

describe("postingCount and seatsNeedAttention", () => {
  it("counts the seats that can post", () => {
    expect(postingCount(row("a", { numbers: [seat("n1"), seat("n2", false), seat("n3")] }))).toBe(2);
  });

  it("flags a group where no number posts or a number is offline", () => {
    expect(seatsNeedAttention(row("a", { numbers: [seat("n1")] }))).toBe(false);
    expect(seatsNeedAttention(row("b", { numbers: [seat("n1", false)] }))).toBe(true);
    expect(seatsNeedAttention(row("c", { numbers: [seat("n1"), seat("n2", true, false)] }))).toBe(true);
    expect(seatsNeedAttention(row("d"))).toBe(true);
  });
});

describe("listStats", () => {
  it("adds up what the rows carry", () => {
    const rows = [
      row("a", { activity: { messages: 40, joins: 5, leaves: 1 }, summary: summary(80, 50), numbers: [seat("n1")] }, { memberCount: 120, followedAt: "2026-10-02T00:00:00Z" }),
      row("b", { activity: { messages: 2, joins: 0, leaves: 3 }, numbers: [seat("n1", false)] }, { memberCount: 30 }),
      row("c", { summary: summary(50) }, { memberCount: 5, followedAt: "2026-10-03T00:00:00Z", membersSyncedAt: "2026-10-03T00:00:00Z" }),
    ];
    expect(listStats(rows)).toEqual({ followed: 2, members: 155, net: 1, messages: 42, highAlertGroups: 1, withoutPoster: 2, unsyncedMembers: 2 });
  });

  it("is all zero without rows", () => {
    expect(listStats([])).toEqual({ followed: 0, members: 0, net: 0, messages: 0, highAlertGroups: 0, withoutPoster: 0, unsyncedMembers: 0 });
  });
});

describe("maxMessages", () => {
  it("is the busiest row, never below one", () => {
    expect(maxMessages([row("a", { activity: { messages: 4, joins: 0, leaves: 0 } }), row("b", { activity: { messages: 9, joins: 0, leaves: 0 } })])).toBe(9);
    expect(maxMessages([])).toBe(1);
  });
});

describe("parsePageSize", () => {
  it("accepts only the offered sizes", () => {
    expect(parsePageSize(25)).toBe(25);
    expect(parsePageSize(100)).toBe(100);
    expect(parsePageSize(30)).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe("column sorts", () => {
  it("shows the server sort on its column", () => {
    expect(columnSort("name", null)).toEqual({ key: "group", direction: "asc" });
    expect(columnSort("name_desc", null)).toEqual({ key: "group", direction: "desc" });
    expect(columnSort("members", null)).toEqual({ key: "members", direction: "desc" });
    expect(columnSort("recent", null)).toBeNull();
    expect(columnSort("oldest", null)).toBeNull();
  });

  it("shows a client sort over the server sort", () => {
    expect(columnSort("name", { key: "net", direction: "asc" })).toEqual({ key: "net", direction: "asc" });
  });

  it("flips the name order and keeps members descending", () => {
    expect(toggleServerSort("group", "recent")).toBe("name");
    expect(toggleServerSort("group", "name")).toBe("name_desc");
    expect(toggleServerSort("group", "name_desc")).toBe("name");
    expect(toggleServerSort("members", "members")).toBe("members");
    expect(toggleServerSort("members", "name")).toBe("members");
  });

  it("starts a client sort descending and flips it on the same column", () => {
    expect(toggleClientSort("messages", null)).toEqual({ key: "messages", direction: "desc" });
    expect(toggleClientSort("messages", { key: "messages", direction: "desc" })).toEqual({ key: "messages", direction: "asc" });
    expect(toggleClientSort("net", { key: "messages", direction: "asc" })).toEqual({ key: "net", direction: "desc" });
  });
});

describe("sortRows", () => {
  const rows = [
    row("a", { activity: { messages: 5, joins: 1, leaves: 4, lastActivity: "2026-10-10T00:00:00Z" }, summary: summary(70), numbers: [seat("n1")] }),
    row("b", { activity: { messages: 9, joins: 3, leaves: 0 }, numbers: [seat("n1"), seat("n2")] }),
    row("c", { activity: { messages: 1, joins: 0, leaves: 0, lastActivity: "2026-10-12T00:00:00Z" }, summary: summary(20) }),
  ];
  const ids = (list: GroupRow[]) => list.map((item) => item.group.id);

  it("keeps the server order without a client sort", () => {
    expect(ids(sortRows(rows, null))).toEqual(["a", "b", "c"]);
  });

  it("sorts by messages and by net growth", () => {
    expect(ids(sortRows(rows, { key: "messages", direction: "desc" }))).toEqual(["b", "a", "c"]);
    expect(ids(sortRows(rows, { key: "net", direction: "asc" }))).toEqual(["a", "c", "b"]);
  });

  it("sorts by positivity and keeps groups without analysis last", () => {
    expect(ids(sortRows(rows, { key: "analysis", direction: "desc" }))).toEqual(["a", "c", "b"]);
    expect(ids(sortRows(rows, { key: "analysis", direction: "asc" }))).toEqual(["c", "a", "b"]);
  });

  it("sorts by posting numbers and by last activity, missing activity last", () => {
    expect(ids(sortRows(rows, { key: "numbers", direction: "desc" }))).toEqual(["b", "a", "c"]);
    expect(ids(sortRows(rows, { key: "lastActivity", direction: "desc" }))).toEqual(["c", "a", "b"]);
    expect(ids(sortRows(rows, { key: "lastActivity", direction: "asc" }))).toEqual(["a", "c", "b"]);
  });

  it("reads the last activity from the group when the window has none", () => {
    const withGroupActivity = [rows[1], row("d", {}, { lastActivityAt: "2026-10-15T00:00:00Z" })];
    expect(ids(sortRows(withGroupActivity, { key: "lastActivity", direction: "desc" }))).toEqual(["d", "b"]);
  });
});

describe("keepSelectedRows", () => {
  it("remembers rows picked on earlier pages and drops the ones unpicked", () => {
    const previous = new Map([["a", row("a")], ["b", row("b")]]);
    const next = keepSelectedRows(previous, new Set(["a", "c"]), [row("c"), row("d")]);
    expect([...next.keys()]).toEqual(["a", "c"]);
  });

  it("prefers the fresher copy of a row on the current page", () => {
    const previous = new Map([["a", row("a", {}, { subject: "Velho" })]]);
    const next = keepSelectedRows(previous, new Set(["a"]), [row("a", {}, { subject: "Novo" })]);
    expect(next.get("a")?.group.subject).toBe("Novo");
  });
});

describe("pageWithinTotal", () => {
  it("moves back to the last page when a reload leaves the current page past the end", () => {
    expect(pageWithinTotal(2, { page: 2, pageSize: 25, totalPages: 1, totalItems: 25 }, 0)).toBe(1);
  });

  it("keeps the page when it still has rows or is within range", () => {
    expect(pageWithinTotal(2, { page: 2, pageSize: 25, totalPages: 2, totalItems: 26 }, 1)).toBeNull();
    expect(pageWithinTotal(1, { page: 1, pageSize: 25, totalPages: 0, totalItems: 0 }, 0)).toBeNull();
  });

  it("goes back to the first page when nothing matches any more", () => {
    expect(pageWithinTotal(3, { page: 3, pageSize: 25, totalPages: 0, totalItems: 0 }, 0)).toBe(1);
  });
});
