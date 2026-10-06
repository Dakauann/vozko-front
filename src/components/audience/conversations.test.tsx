import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import pt from "@/i18n/messages/pt.json";
import type { CommentAnalysisStats, TrendPoint } from "@/lib/audience/types";
import { CommentAnalysisConversations } from "./conversations";

const chart = vi.hoisted(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }));
vi.mock("@/components/charts/echarts-runtime", () => ({ init: () => chart }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function counters(overrides: Partial<CommentAnalysisStats> = {}): CommentAnalysisStats {
  const zero = new Proxy({}, { get: (_target, key) => (key === "subjects" || key === "topics" ? [] : key === "lastAnalyzedAt" ? null : 0) });
  return Object.assign(Object.create(zero), overrides) as CommentAnalysisStats;
}

function day(bucketDate: string, hot: number, warm: number, cold: number): TrendPoint {
  return Object.assign(counters({
    conversationAnalyzed: hot + warm + cold,
    qualificationHotLead: hot,
    qualificationWarmLead: warm,
    qualificationColdLead: cold,
    attendanceQualityAvg: 80,
  }), { bucketDate, acceptanceScore: 0 }) as TrendPoint;
}

const stats = counters({
  conversationCount: 20,
  conversationAnalyzed: 19,
  qualificationHotLead: 6,
  qualificationWarmLead: 8,
  qualificationColdLead: 5,
  interestInterested: 9,
  interestUndecided: 6,
  interestNotInterested: 4,
  attendanceQualityAvg: 82,
  subjects: [
    { key: "graduacao", label: "graduação", count: 2 },
    { key: "educacao fisica", label: "Educação Física", count: 1 },
  ],
});

const trend = [day("2026-09-30", 2, 3, 1), day("2026-10-01", 1, 2, 2)];

function renderView() {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <CommentAnalysisConversations stats={stats} trend={trend} loading={false} />
    </NextIntlClientProvider>,
  );
}

describe("conversation analysis view", () => {
  it("lists each recurring subject exactly once", () => {
    renderView();
    expect(screen.getAllByText("graduação")).toHaveLength(1);
    expect(screen.getAllByText("Educação Física")).toHaveLength(1);
  });

  it("stacks the daily activity by lead temperature on a date axis", async () => {
    renderView();
    await waitFor(() => expect(chart.setOption).toHaveBeenCalled());
    const options = chart.setOption.mock.calls.map(([option]) => option as { xAxis?: { type?: string }; series?: Array<{ stack?: string; data?: unknown[] }> });
    const activity = options.find((option) => (option.series ?? []).filter((series) => series.stack === "conversations").length === 3);
    expect(activity).toBeDefined();
    expect(activity?.xAxis?.type).toBe("time");
    expect(activity?.series?.[0].data).toEqual([[Date.parse("2026-09-30T00:00:00Z"), 2], [Date.parse("2026-10-01T00:00:00Z"), 1]]);
  });

  it("shows a daily trend line inside the summary tiles", () => {
    const { container } = renderView();
    const titles = [...container.querySelectorAll('svg[role="img"] title')].map((node) => node.textContent);
    expect(titles.filter((title) => title === pt.denseCharts.dailyTrend).length).toBeGreaterThan(0);
  });
});
