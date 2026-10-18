import { describe, expect, it } from "vitest";

import type {
  CategoryCount,
  DailyPoint,
  GroupGrowth,
  GroupInsight,
  GroupPerson,
  GroupRow,
  GroupSentiment,
  GroupsDashboard,
  JoinTask,
} from "@/lib/unofficial-whatsapp-groups/types";

import {
  attentionLines,
  categoryRanking,
  categoryFilterParam,
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_NONE,
  filterInsights,
  greetingName,
  growingGroups,
  hasNoGroups,
  insightCounts,
  isMembershipSort,
  membershipFilterActive,
  normalizeDashboard,
  payloadPeoplePage,
  rankSentimentByGroup,
  responseStats,
  sentimentTotal,
  sumOf,
  toggleMembershipSort,
  volumeStats,
} from "./dashboard-data";

function point(day: string, messages: number): DailyPoint {
  return { day, joins: 0, leaves: 0, net: 0, messages, activeGroups: 0 };
}

function row(id: string, overrides: Partial<GroupRow> = {}): GroupRow {
  return {
    group: {
      id,
      workspaceId: "w",
      jid: `${id}@g.us`,
      subject: `Grupo ${id}`,
      origin: "managed",
      announce: false,
      locked: false,
      memberCount: 10,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    },
    numbers: [{ instanceId: "i1", label: "A", connected: true, admin: true, canPost: true }],
    activity: { messages: 5, joins: 1, leaves: 0 },
    hasAnalysis: false,
    runningCampaigns: 0,
    ...overrides,
  };
}

function join(status: JoinTask["status"]): JoinTask {
  return {
    id: `${status}-${Math.random()}`,
    planId: "p",
    workspaceId: "w",
    instanceId: "i",
    inviteLink: "x",
    sequence: 1,
    follow: true,
    status,
    attempts: 1,
    dueAt: "2026-10-01T00:00:00Z",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };
}

function person(key: string): GroupPerson {
  return { personKey: key, name: key, jid: `${key}@s.whatsapp.net`, groupCount: 2, groups: [] };
}

describe("normalizeDashboard", () => {
  it("turns missing lists into empty ones", () => {
    const raw = {
      connections: { connected: 0, total: 0 },
      groups: { groups: 0, followed: 0, open: 0, closed: 0, categories: null },
      people: { memberships: 0, unique: 0 },
      analyses: { total: 0, active: 0 },
      runs: { runs: 0, messages: 0, highAlerts: 0 },
      dailyVolume: null,
      topGroups: null,
      sentiment: { positive: 0, neutral: 0, negative: 0 },
      sentimentByGroup: null,
      responseTime: null,
      growth: null,
      topGrowing: null,
      insights: null,
      themes: null,
      crossGroupPeople: [{ personKey: "p", name: "Ana", jid: "j", groupCount: 2, groups: null }],
    } as unknown as GroupsDashboard;
    const dashboard = normalizeDashboard(raw);
    expect(dashboard.groups.categories).toEqual([]);
    expect(dashboard.dailyVolume).toEqual([]);
    expect(dashboard.insights).toEqual([]);
    expect(dashboard.themes).toEqual([]);
    expect(dashboard.crossGroupPeople[0].groups).toEqual([]);
    expect(dashboard.crossGroupTotal).toBe(0);
    expect(dashboard.timezone).toBe("");
    expect(hasNoGroups(dashboard)).toBe(true);
  });
});

describe("greetingName", () => {
  it("keeps only the first name", () => {
    expect(greetingName("  Ana Paula Souza ")).toBe("Ana");
  });

  it("returns null without a name", () => {
    expect(greetingName("   ")).toBeNull();
    expect(greetingName(undefined)).toBeNull();
  });
});

describe("volumeStats", () => {
  it("sums the window, averages per day and finds the peak", () => {
    expect(volumeStats([point("2026-10-01", 4), point("2026-10-02", 10), point("2026-10-03", 1)])).toEqual({
      total: 15,
      average: 5,
      peak: { day: "2026-10-02", messages: 10 },
    });
  });

  it("has no peak when nothing was sent", () => {
    expect(volumeStats([point("2026-10-01", 0)])).toEqual({ total: 0, average: 0, peak: null });
    expect(volumeStats([])).toEqual({ total: 0, average: 0, peak: null });
  });
});

describe("responseStats", () => {
  it("weights the mean by samples and counts the days above the goal", () => {
    expect(
      responseStats(
        [
          { day: "a", avgMinutes: 10, samples: 1 },
          { day: "b", avgMinutes: 2, samples: 3 },
          { day: "c", avgMinutes: 0, samples: 0 },
        ],
        5,
      ),
    ).toEqual({ average: 4, samples: 4, daysAboveGoal: 1 });
  });

  it("has no mean without samples", () => {
    expect(responseStats([{ day: "a", avgMinutes: 9, samples: 0 }], 5)).toEqual({ average: null, samples: 0, daysAboveGoal: 0 });
  });
});

describe("rankSentimentByGroup", () => {
  const groups: GroupSentiment[] = [
    { groupId: "a", subject: "A", positive: 90, neutral: 0, negative: 10 },
    { groupId: "b", subject: "B", positive: 1, neutral: 0, negative: 3 },
    { groupId: "c", subject: "C", positive: 0, neutral: 0, negative: 0 },
    { groupId: "d", subject: "D", positive: 5, neutral: 5, negative: 10 },
  ];

  it("puts the most negative share first and drops empty groups", () => {
    expect(rankSentimentByGroup(groups, "negative").map((group) => group.groupId)).toEqual(["b", "d", "a"]);
  });

  it("orders by total messages on request", () => {
    expect(rankSentimentByGroup(groups, "messages").map((group) => group.groupId)).toEqual(["a", "d", "b"]);
  });

  it("keeps at most the limit", () => {
    expect(rankSentimentByGroup(groups, "messages", 2)).toHaveLength(2);
  });
});

describe("categoryRanking", () => {
  it("orders by count, puts the empty category last and computes shares", () => {
    const categories: CategoryCount[] = [
      { category: "", count: 5 },
      { category: "Vendas", count: 3 },
      { category: "Suporte", count: 12 },
    ];
    expect(categoryRanking(categories)).toEqual([
      { category: "Suporte", count: 12, share: 60 },
      { category: "Vendas", count: 3, share: 15 },
      { category: "", count: 5, share: 25 },
    ]);
  });

  it("returns nothing when no group has a category count", () => {
    expect(categoryRanking([{ category: "A", count: 0 }])).toEqual([]);
  });
});

describe("category filter", () => {
  it("sends no category for all, an empty one for uncategorized and the name otherwise", () => {
    expect(categoryFilterParam(CATEGORY_FILTER_ALL)).toBeUndefined();
    expect(categoryFilterParam(CATEGORY_FILTER_NONE)).toBe("");
    expect(categoryFilterParam("Vendas")).toBe("Vendas");
  });

  it("knows when a ledger filter is on", () => {
    expect(membershipFilterActive({ search: "", origin: "all", category: CATEGORY_FILTER_ALL })).toBe(false);
    expect(membershipFilterActive({ search: "x", origin: "all", category: CATEGORY_FILTER_ALL })).toBe(true);
    expect(membershipFilterActive({ search: "", origin: "external", category: CATEGORY_FILTER_ALL })).toBe(true);
    expect(membershipFilterActive({ search: "", origin: "all", category: CATEGORY_FILTER_NONE })).toBe(true);
  });
});

describe("insights", () => {
  const insights: GroupInsight[] = [
    { analysisId: "a", analysisName: "A", groupId: "g", message: "m1", alertLevel: "high", createdAt: "2026-10-01T00:00:00Z" },
    { analysisId: "a", analysisName: "A", groupId: "g", message: "m2", alertLevel: "low", createdAt: "2026-10-01T00:00:00Z" },
    { analysisId: "a", analysisName: "A", groupId: "g", message: "m3", alertLevel: "high", createdAt: "2026-10-01T00:00:00Z" },
  ];

  it("counts each alert level", () => {
    expect(insightCounts(insights)).toEqual({ all: 3, high: 2, medium: 0, low: 1 });
  });

  it("filters by level", () => {
    expect(filterInsights(insights, "high").map((insight) => insight.message)).toEqual(["m1", "m3"]);
    expect(filterInsights(insights, "all")).toHaveLength(3);
  });
});

describe("attentionLines", () => {
  it("returns only the lines with something to look at, in a fixed order", () => {
    const rows = [
      row("calm"),
      row("alert", { summary: { sentiment: "negative", positivity: 20, cycles: 4, messages: 40, highAlertPct: 50, themes: [], mentions: [] } }),
      row("mild", { summary: { sentiment: "positive", positivity: 80, cycles: 4, messages: 40, highAlertPct: 10, themes: [], mentions: [] } }),
      row("mute", { numbers: [{ instanceId: "i", label: "A", connected: true, admin: false, canPost: false }] }),
      row("shrinking", { activity: { messages: 3, joins: 1, leaves: 4 } }),
      row("silent", { activity: { messages: 0, joins: 0, leaves: 0 } }),
    ];
    const lines = attentionLines({
      rows,
      connections: { connected: 1, total: 3 },
      joins: [join("failed"), join("done"), join("failed")],
    });
    expect(lines.map((line) => [line.key, line.count])).toEqual([
      ["disconnected", 2],
      ["failedJoins", 2],
      ["highAlert", 2],
      ["negative", 1],
      ["noPoster", 1],
      ["losingMembers", 1],
      ["silent", 1],
    ]);
    expect(lines.find((line) => line.key === "highAlert")?.groups.map((group) => group.groupId)).toEqual(["alert", "mild"]);
    expect(lines.find((line) => line.key === "disconnected")?.groups).toEqual([]);
  });

  it("is empty when everything is fine", () => {
    expect(attentionLines({ rows: [row("a")], connections: { connected: 2, total: 2 }, joins: [join("done")] })).toEqual([]);
  });

  it("puts the groups losing the most members first", () => {
    const lines = attentionLines({
      rows: [row("a", { activity: { messages: 1, joins: 0, leaves: 1 } }), row("b", { activity: { messages: 1, joins: 0, leaves: 6 } })],
      connections: { connected: 1, total: 1 },
      joins: [],
    });
    expect(lines[0].groups.map((group) => group.groupId)).toEqual(["b", "a"]);
  });
});

describe("payloadPeoplePage", () => {
  const people = Array.from({ length: 20 }, (_, index) => person(`p${index}`));

  it("serves the first pages from the dashboard payload", () => {
    const first = payloadPeoplePage(people, 34, { search: "", minGroups: 2, page: 1 });
    expect(first?.items.map((item) => item.personKey)).toEqual(people.slice(0, 10).map((item) => item.personKey));
    expect(first?.totalItems).toBe(34);
    expect(first?.totalPages).toBe(4);
    expect(payloadPeoplePage(people, 34, { search: "", minGroups: 2, page: 2 })?.items[0].personKey).toBe("p10");
  });

  it("asks the server for a page past the payload or any filter", () => {
    expect(payloadPeoplePage(people, 34, { search: "", minGroups: 2, page: 3 })).toBeNull();
    expect(payloadPeoplePage(people, 34, { search: "ana", minGroups: 2, page: 1 })).toBeNull();
    expect(payloadPeoplePage(people, 34, { search: "", minGroups: 3, page: 1 })).toBeNull();
  });

  it("serves a short last page when the payload holds everyone", () => {
    const few = people.slice(0, 13);
    expect(payloadPeoplePage(few, 13, { search: "", minGroups: 2, page: 2 })?.items).toHaveLength(3);
  });
});

describe("totals", () => {
  it("adds the sentiment tally", () => {
    expect(sentimentTotal({ positive: 2, neutral: 3, negative: 5 })).toBe(10);
  });

  it("sums a picked field", () => {
    expect(sumOf([{ n: 2 }, { n: 5 }], (item) => item.n)).toBe(7);
  });
});

describe("toggleMembershipSort", () => {
  it("flips the direction of the active column", () => {
    expect(toggleMembershipSort({ key: "members", direction: "desc" }, "members")).toEqual({ key: "members", direction: "asc" });
  });

  it("starts numbers from the largest and names from A", () => {
    expect(toggleMembershipSort({ key: "members", direction: "desc" }, "joins")).toEqual({ key: "joins", direction: "desc" });
    expect(toggleMembershipSort({ key: "members", direction: "desc" }, "name")).toEqual({ key: "name", direction: "asc" });
  });

  it("recognises only the sorts the API accepts, growth included", () => {
    expect(isMembershipSort("churn")).toBe(true);
    expect(isMembershipSort("growth")).toBe(true);
    expect(isMembershipSort("lastActivity")).toBe(false);
  });
});

describe("growingGroups", () => {
  const growth = (groupId: string, net: number): GroupGrowth => ({ groupId, subject: groupId, joins: Math.max(net, 0), leaves: Math.max(-net, 0), net });

  it("keeps only groups whose member balance grew", () => {
    expect(growingGroups([growth("a", 4), growth("b", 0), growth("c", -3), growth("d", 1)]).map((group) => group.groupId)).toEqual(["a", "d"]);
  });

  it("returns nothing when no group grew", () => {
    expect(growingGroups([growth("a", 0), growth("b", -2)])).toEqual([]);
  });
});
