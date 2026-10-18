import { describe, expect, it } from "vitest";

import type { AnalysisResult, AnalysisRun, TrackedField, TrendPoint } from "@/lib/unofficial-whatsapp-groups/types";

import { RUN_SENTIMENT_ORDER } from "../kit/figures";

import {
  cycleHighlights,
  dominantOf,
  latestFailure,
  mergeParticipantGroups,
  multiGroupCount,
  nextParticipantSort,
  numericStats,
  perCycle,
  sentimentShares,
  sortParticipants,
  splitByWindow,
  trackedFieldSeries,
  windowSince,
} from "./analysis-series";

function result(customFields: AnalysisResult["customFields"]): AnalysisResult {
  return {
    summary: "",
    sentiment: "neutral",
    keyThemes: [],
    relevantMentions: [],
    participantSentiments: [],
    insights: [],
    suggestedActions: [],
    alertLevel: "low",
    customFields,
  };
}

function run(cycle: number, completedAt: string, customFields?: AnalysisResult["customFields"], status: AnalysisRun["status"] = "completed"): AnalysisRun {
  return {
    id: `r${cycle}`,
    analysisId: "a1",
    workspaceId: "w1",
    groupId: "g1",
    cycle,
    kind: "cycle",
    status,
    messagesAnalyzed: 10,
    result: customFields === undefined ? undefined : result(customFields),
    promptTokens: 0,
    completionTokens: 0,
    startedAt: completedAt,
    completedAt,
  };
}

const fields: TrackedField[] = [
  { key: "nps", type: "number" },
  { key: "conversao", type: "percentage" },
  { key: "pediu_preco", type: "boolean" },
  { key: "produto", type: "text" },
];

describe("trackedFieldSeries", () => {
  it("orders runs oldest first and skips failed runs and runs without a result", () => {
    const runs = [
      run(3, "2026-10-03T10:00:00Z", { nps: 9, conversao: 40, pediu_preco: true, produto: "Plano B" }),
      run(2, "2026-10-02T10:00:00Z", {}, "failed"),
      run(4, "2026-10-04T10:00:00Z"),
      run(1, "2026-10-01T10:00:00Z", { nps: 7, conversao: null, pediu_preco: false, produto: "Plano A" }),
    ];
    const [nps, conversao, pediu, produto] = trackedFieldSeries(fields, runs);

    expect(nps).toEqual({
      key: "nps",
      type: "number",
      points: [
        { cycle: 1, at: "2026-10-01T10:00:00Z", value: 7 },
        { cycle: 3, at: "2026-10-03T10:00:00Z", value: 9 },
      ],
      latest: 9,
      answered: 2,
    });
    expect(conversao).toMatchObject({ type: "percentage", latest: 40, answered: 1 });
    expect(conversao.type === "percentage" && conversao.points.map((point) => point.value)).toEqual([null, 40]);
    expect(pediu).toEqual({
      key: "pediu_preco",
      type: "boolean",
      points: [
        { cycle: 1, at: "2026-10-01T10:00:00Z", value: false },
        { cycle: 3, at: "2026-10-03T10:00:00Z", value: true },
      ],
      trueCount: 1,
      answered: 2,
      trueShare: 50,
    });
    expect(produto).toEqual({
      key: "produto",
      type: "text",
      values: [
        { cycle: 3, at: "2026-10-03T10:00:00Z", value: "Plano B" },
        { cycle: 1, at: "2026-10-01T10:00:00Z", value: "Plano A" },
      ],
    });
  });

  it("reads values the model returned in a looser shape", () => {
    const [nps, , pediu, produto] = trackedFieldSeries(fields, [
      run(1, "2026-10-01T10:00:00Z", { nps: "8.5", pediu_preco: "true", produto: 12 }),
      run(2, "2026-10-02T10:00:00Z", { nps: "muito", pediu_preco: "talvez", produto: "  " }),
    ]);
    expect(nps.type === "number" && nps.points.map((point) => point.value)).toEqual([8.5, null]);
    expect(nps).toMatchObject({ latest: 8.5, answered: 1 });
    expect(pediu).toMatchObject({ trueCount: 1, answered: 1, trueShare: 100 });
    expect(produto.type === "text" && produto.values.map((entry) => entry.value)).toEqual(["12"]);
  });

  it("reports no share when nobody answered a yes or no field", () => {
    const [, , pediu] = trackedFieldSeries(fields, [run(1, "2026-10-01T10:00:00Z", {})]);
    expect(pediu).toMatchObject({ trueCount: 0, answered: 0, trueShare: null });
  });

  it("orders runs that finished together by cycle", () => {
    const [nps] = trackedFieldSeries([fields[0]], [run(2, "2026-10-01T10:00:00Z", { nps: 2 }), run(1, "2026-10-01T10:00:00Z", { nps: 1 })]);
    expect(nps.type === "number" && nps.points.map((point) => point.cycle)).toEqual([1, 2]);
  });
});

describe("sentimentShares", () => {
  it("returns every sentiment in order with its share of the total", () => {
    expect(sentimentShares({ positive: 3, negative: 1 }, RUN_SENTIMENT_ORDER)).toEqual({
      total: 4,
      rows: [
        { key: "positive", value: 3, share: 75 },
        { key: "neutral", value: 0, share: 0 },
        { key: "mixed", value: 0, share: 0 },
        { key: "negative", value: 1, share: 25 },
      ],
    });
  });

  it("gives zero shares when nothing was counted", () => {
    expect(sentimentShares({}, ["positive", "negative"] as const)).toEqual({
      total: 0,
      rows: [
        { key: "positive", value: 0, share: 0 },
        { key: "negative", value: 0, share: 0 },
      ],
    });
  });
});

describe("dominantOf", () => {
  it("picks the largest count and breaks ties by the given order", () => {
    expect(dominantOf({ negative: 4, positive: 4, neutral: 1 }, RUN_SENTIMENT_ORDER)).toBe("positive");
    expect(dominantOf({ mixed: 2, neutral: 1 }, RUN_SENTIMENT_ORDER)).toBe("mixed");
  });

  it("returns null when nothing was counted", () => {
    expect(dominantOf({}, RUN_SENTIMENT_ORDER)).toBeNull();
    expect(dominantOf({ positive: 0 }, RUN_SENTIMENT_ORDER)).toBeNull();
  });
});

describe("participant groups", () => {
  const detailMap = {
    "5511@s.whatsapp.net": [
      { groupId: "g1", subject: "Este" },
      { groupId: "g2", subject: "Outro" },
    ],
    "5522@s.whatsapp.net": [{ groupId: "g1", subject: "Este" }],
  };

  it("counts every person of the window who is in two or more groups", () => {
    expect(multiGroupCount(detailMap)).toBe(1);
    expect(multiGroupCount({})).toBe(0);
  });

  it("merges maps without repeating a group", () => {
    const merged = mergeParticipantGroups(detailMap, {
      "5511@s.whatsapp.net": [
        { groupId: "g2", subject: "Outro" },
        { groupId: "g3", subject: "Mais um" },
      ],
      "5533@s.whatsapp.net": [{ groupId: "g4", subject: "Novo" }],
    });
    expect(merged["5511@s.whatsapp.net"].map((group) => group.groupId)).toEqual(["g1", "g2", "g3"]);
    expect(merged["5533@s.whatsapp.net"]).toEqual([{ groupId: "g4", subject: "Novo" }]);
    expect(merged["5522@s.whatsapp.net"]).toHaveLength(1);
  });
});

describe("analysis window", () => {
  const now = new Date("2026-10-18T12:00:00Z");

  it("starts the window the given number of days ago, or never for all cycles", () => {
    expect(windowSince(7, now)).toBe(new Date("2026-10-11T12:00:00Z").getTime());
    expect(windowSince(-1, now)).toBeNull();
    expect(windowSince(0, now)).toBeNull();
  });

  it("keeps the runs inside the window and says when the page went past it", () => {
    const since = windowSince(7, now);
    const inside = run(3, "2026-10-17T10:00:00Z", {});
    const outside = run(2, "2026-10-01T10:00:00Z", {});
    expect(splitByWindow([inside, outside], since)).toEqual({ runs: [inside], passed: true });
    expect(splitByWindow([inside], since)).toEqual({ runs: [inside], passed: false });
    expect(splitByWindow([inside, outside], null)).toEqual({ runs: [inside, outside], passed: false });
  });
});

describe("latestFailure", () => {
  it("returns the reason of the most recent failed run on the page", () => {
    const failed = { ...run(4, "2026-10-17T10:00:00Z", undefined, "failed"), failureReason: "sem saldo" };
    const older = { ...run(2, "2026-10-10T10:00:00Z", undefined, "failed"), failureReason: "tempo esgotado" };
    expect(latestFailure([run(5, "2026-10-18T10:00:00Z", {}), failed, older])).toBe("sem saldo");
    expect(latestFailure([run(5, "2026-10-18T10:00:00Z", {})])).toBeUndefined();
  });
});

describe("numericStats", () => {
  it("summarises the answered values only", () => {
    const points = [
      { cycle: 1, at: "a", value: 4 },
      { cycle: 2, at: "b", value: null },
      { cycle: 3, at: "c", value: 10 },
      { cycle: 4, at: "d", value: 7 },
    ];
    expect(numericStats(points)).toEqual({ min: 4, max: 10, avg: 7 });
    expect(numericStats([{ cycle: 1, at: "a", value: null }])).toBeNull();
  });
});

describe("perCycle", () => {
  it("averages messages over completed cycles", () => {
    expect(perCycle(150, 4)).toBe(37.5);
    expect(perCycle(10, 0)).toBeNull();
  });
});

describe("participant sorting", () => {
  const people = [
    { key: "a", name: "bruno", messages: 3, sentiments: {} },
    { key: "b", name: "Ana", messages: 9, sentiments: {} },
    { key: "c", name: "Caio", messages: 3, sentiments: {} },
  ];

  it("sorts by messages with the name as tie break, or by name", () => {
    expect(sortParticipants(people, { key: "messages", direction: "desc" }).map((row) => row.key)).toEqual(["b", "a", "c"]);
    expect(sortParticipants(people, { key: "messages", direction: "asc" }).map((row) => row.key)).toEqual(["a", "c", "b"]);
    expect(sortParticipants(people, { key: "name", direction: "asc" }).map((row) => row.key)).toEqual(["b", "a", "c"]);
  });

  it("starts messages descending and names ascending, and flips the current column", () => {
    expect(nextParticipantSort({ key: "messages", direction: "desc" }, "messages")).toEqual({ key: "messages", direction: "asc" });
    expect(nextParticipantSort({ key: "messages", direction: "asc" }, "name")).toEqual({ key: "name", direction: "asc" });
    expect(nextParticipantSort({ key: "name", direction: "asc" }, "messages")).toEqual({ key: "messages", direction: "desc" });
  });
});

function point(cycle: number, messages: number, positivity: number): TrendPoint {
  return { cycle, at: `2026-10-1${cycle}T12:00:00Z`, positivity, messages, sentiment: "neutral", alert: "low", participants: 1 };
}

describe("cycleHighlights", () => {
  it("names the busiest, the most positive and the most negative cycle", () => {
    const highlights = cycleHighlights([point(1, 4, 50), point(2, 9, 10), point(3, 9, 100)]);
    expect(highlights.busiest?.cycle).toBe(2);
    expect(highlights.best?.cycle).toBe(3);
    expect(highlights.worst?.cycle).toBe(2);
  });

  it("has nothing to point at without cycles", () => {
    expect(cycleHighlights([])).toEqual({ busiest: null, best: null, worst: null });
  });
});
