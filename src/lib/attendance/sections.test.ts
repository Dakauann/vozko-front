import { describe, expect, it } from "vitest";

import {
  ATTENDANCE_SECTIONS,
  AttendanceSectionError,
  attendanceSectionKey,
  sectionQueryParams,
  sectionRetryDelay,
  shouldRetrySection,
} from "./sections";
import type { AttendanceOverviewParams } from "./types";

const params: AttendanceOverviewParams = {
  dateFrom: "2026-09-19",
  dateTo: "2026-09-25",
  departmentId: "d1",
  memberId: "m1",
  campaignId: "c1",
  campaignType: "whatsapp",
  channel: "whatsapp",
  includeAi: true,
  rankMetric: "volume",
  trendBuckets: 13,
};

describe("sectionQueryParams", () => {
  it("sends every scoping filter to every section", () => {
    for (const section of ATTENDANCE_SECTIONS) {
      expect(sectionQueryParams(section, params)).toMatchObject({
        date_from: "2026-09-19",
        date_to: "2026-09-25",
        department_id: "d1",
        member_id: "m1",
        campaign_id: "c1",
        campaign_type: "whatsapp",
        channel: "whatsapp",
      });
    }
  });

  it("sends the ranking metric and the AI toggle only to the team", () => {
    expect(sectionQueryParams("team", params)).toMatchObject({ rank_metric: "volume", include_ai: "true" });
    for (const section of ATTENDANCE_SECTIONS.filter((s) => s !== "team")) {
      const query = sectionQueryParams(section, params);
      expect(query.rank_metric).toBeUndefined();
      expect(query.include_ai).toBeUndefined();
    }
  });

  it("sends the trend depth only to the trend", () => {
    expect(sectionQueryParams("trend", params).trend_buckets).toBe("13");
    expect(sectionQueryParams("summary", params).trend_buckets).toBeUndefined();
  });

  it("sends include_ai=false when AI is hidden, not an absent flag the server reads as true", () => {
    expect(sectionQueryParams("team", { ...params, includeAi: false }).include_ai).toBe("false");
  });

  it("drops empty filters", () => {
    const query = sectionQueryParams("summary", { dateFrom: "2026-09-19", departmentId: "" });
    expect(query).toEqual({ date_from: "2026-09-19" });
  });
});

describe("attendanceSectionKey", () => {
  it("keeps the summary cached when only the ranking metric changes", () => {
    expect(attendanceSectionKey("ws1", "summary", params)).toEqual(
      attendanceSectionKey("ws1", "summary", { ...params, rankMetric: "resolved" }),
    );
    expect(attendanceSectionKey("ws1", "team", params)).not.toEqual(
      attendanceSectionKey("ws1", "team", { ...params, rankMetric: "resolved" }),
    );
  });

  it("never shares a cache entry across workspaces or periods", () => {
    expect(attendanceSectionKey("ws1", "summary", params)).not.toEqual(
      attendanceSectionKey("ws2", "summary", params),
    );
    expect(attendanceSectionKey("ws1", "summary", params)).not.toEqual(
      attendanceSectionKey("ws1", "summary", { ...params, dateFrom: "2026-08-27" }),
    );
  });

  it("starts with the prefix a refresh invalidates", () => {
    expect(attendanceSectionKey("ws1", "stages", params).slice(0, 2)).toEqual(["attendance-section", "ws1"]);
  });
});

describe("retry policy", () => {
  it("retries a busy server a few times", () => {
    const busy = new AttendanceSectionError("busy", 503);
    expect(shouldRetrySection(0, busy)).toBe(true);
    expect(shouldRetrySection(2, busy)).toBe(true);
    expect(shouldRetrySection(3, busy)).toBe(false);
    expect(sectionRetryDelay(0, busy)).toBe(5_000);
  });

  it("never retries a request the server rejected", () => {
    for (const status of [400, 401, 403, 404]) {
      expect(shouldRetrySection(0, new AttendanceSectionError("no", status))).toBe(false);
    }
  });

  it("retries a network failure or timeout once", () => {
    const network = new AttendanceSectionError("offline");
    expect(shouldRetrySection(0, network)).toBe(true);
    expect(shouldRetrySection(1, network)).toBe(false);
    expect(shouldRetrySection(0, new AttendanceSectionError("slow", 504))).toBe(true);
  });
});
