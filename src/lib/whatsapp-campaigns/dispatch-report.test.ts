import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  dispatchReportPath,
  dispatchReportQuery,
  dispatchReportRequest,
  dispatchReportSectionKey,
  DISPATCH_EXPORT_MAX_DAYS,
  DISPATCH_REPORT_MAX_DAYS,
  funnelStages,
  type DispatchFunnel,
} from "./dispatch-report";

const funnel: DispatchFunnel = {
  base: 10_000,
  sent: 9_950,
  delivered: 9_620,
  read: 7_840,
  replied: 1_430,
  failed: 280,
  awaitingDelivery: 50,
  pending: 0,
  notEligible: 0,
  trackedSince: null,
};

const period = { dateFrom: "2026-09-01", dateTo: "2026-09-07" };
const periodQuery = { date_from: "2026-09-01", date_to: "2026-09-07" };

describe("funnelStages", () => {
  it("reads every stage against the base and against the stage before it", () => {
    const stages = funnelStages(funnel, 920);

    expect(stages.map((s) => s.key)).toEqual(["base", "sent", "delivered", "read", "replied", "interested"]);
    const read = stages.find((s) => s.key === "read")!;
    expect(read.pctOfBase).toBeCloseTo(78.4);
    expect(read.pctOfPrevious).toBeCloseTo((7_840 / 9_620) * 100);
    expect(stages[0].pctOfPrevious).toBeNull();
  });

  it("leaves interest out when the view has no source for it", () => {
    expect(funnelStages(funnel).map((s) => s.key)).toEqual(["base", "sent", "delivered", "read", "replied"]);
  });

  it("marks a stage whose source is unavailable as unknown, never as zero", () => {
    const interested = funnelStages(funnel, null).find((s) => s.key === "interested")!;

    expect(interested.value).toBeNull();
    expect(interested.pctOfBase).toBeNull();
  });

  it("has no rate over an empty stage", () => {
    const empty = { ...funnel, base: 0, sent: 0, delivered: 0, read: 0, replied: 0 };

    expect(funnelStages(empty, 0).every((s) => s.pctOfBase === null)).toBe(true);
  });
});

describe("dispatch report requests", () => {
  it("lives beside the attendance sections, one route per section", () => {
    expect(dispatchReportPath("summary")).toBe("/attendance/campaigns/summary");
    expect(dispatchReportPath("campaigns")).toBe("/attendance/campaigns/campaigns");
  });

  it("uses the attendance query names and never sends a timezone", () => {
    expect(dispatchReportQuery({ ...period, departmentId: "d1" })).toEqual({ ...periodQuery, department_id: "d1" });
    expect(dispatchReportQuery({ ...period, campaignId: "c1", departmentId: "d1" })).toEqual({ ...periodQuery, campaign_id: "c1" });
  });

  it("keys each section by workspace, scope, section and query", () => {
    expect(dispatchReportSectionKey("ws1", "summary", { ...period, campaignId: "c1" })).toEqual([
      "dispatch-report", "ws1", "c1", "summary", { ...periodQuery, campaign_id: "c1" },
    ]);
    expect(dispatchReportSectionKey("ws1", "campaigns", period)).toEqual([
      "dispatch-report", "ws1", "all", "campaigns", periodQuery,
    ]);
  });
});

describe("dispatchReportRequest", () => {
  it("asks for the whole chosen period of the all-campaigns view in the chosen department", () => {
    expect(dispatchReportRequest({ departmentId: "d1", dateFrom: "2025-01-01", dateTo: "2026-09-30" }, "pt")).toEqual({
      kind: "whatsapp_dispatch",
      format: "csv",
      locale: "pt",
      params: { dateFrom: "2025-01-01", dateTo: "2026-09-30", departmentId: "d1" },
    });
  });

  it("asks for one campaign without a department, as the block does", () => {
    expect(dispatchReportRequest({ campaignId: "c1", departmentId: "d1", dateFrom: "2025-01-01", dateTo: "2026-09-30" }, "en").params).toEqual({
      dateFrom: "2025-01-01",
      dateTo: "2026-09-30",
      campaignId: "c1",
    });
  });

  it("reaches further than the block can chart", () => {
    expect(DISPATCH_EXPORT_MAX_DAYS).toBeGreaterThan(DISPATCH_REPORT_MAX_DAYS);
  });

  it("mirrors the server limits, which no response carries yet", () => {
    const source = readFileSync(resolve(__dirname, "../../../../vozko-back/domain/whatsapp_campaign_entry/dispatch_report.go"), "utf8");
    const serverLimit = (name: string) => Number(new RegExp(`\\b${name}\\s*=\\s*(\\d+)`).exec(source)?.[1]);
    expect(DISPATCH_REPORT_MAX_DAYS).toBe(serverLimit("MaxReportDays"));
    expect(DISPATCH_EXPORT_MAX_DAYS).toBe(serverLimit("MaxExportDays"));
  });
});
