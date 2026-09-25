import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();
vi.mock("@/lib/api/browser-client", () => ({
  apiClient: (...args: unknown[]) => apiClient(...args),
}));

import { fetchDispatchReportSection } from "./dispatch-report";
import { SectionError } from "@/lib/analytics/section-query";

const period = { dateFrom: "2026-09-01", dateTo: "2026-09-07" };

describe("fetchDispatchReportSection", () => {
  beforeEach(() => apiClient.mockReset());

  it("asks the attendance campaign route with the period and scope", async () => {
    apiClient.mockResolvedValue({ data: {} });

    await fetchDispatchReportSection("daily", { ...period, campaignId: "c1" });
    await fetchDispatchReportSection("campaigns", { ...period, departmentId: "d1" });

    expect(apiClient.mock.calls[0][0]).toBe(
      "/attendance/campaigns/daily?date_from=2026-09-01&date_to=2026-09-07&campaign_id=c1",
    );
    expect(apiClient.mock.calls[1][0]).toBe(
      "/attendance/campaigns/campaigns?date_from=2026-09-01&date_to=2026-09-07&department_id=d1",
    );
  });

  it("raises the server status so a busy section is retried and a refused one is not", async () => {
    apiClient.mockResolvedValue({ error: { message: "busy", status: 503 } });

    await expect(fetchDispatchReportSection("tags", period)).rejects.toMatchObject({ status: 503 });
    await expect(fetchDispatchReportSection("tags", period)).rejects.toBeInstanceOf(SectionError);
  });

  it("treats an empty body as a failure rather than an empty report", async () => {
    apiClient.mockResolvedValue({ data: null });

    await expect(fetchDispatchReportSection("summary", period)).rejects.toBeInstanceOf(SectionError);
  });
});
