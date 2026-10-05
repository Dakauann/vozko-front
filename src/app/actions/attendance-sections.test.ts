import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();
vi.mock("@/lib/api/browser-client", () => ({ apiClient: (...args: unknown[]) => apiClient(...args) }));

import { fetchAttendanceSection, fetchMemberActivity } from "./attendance";
import { AttendanceSectionError } from "@/lib/attendance/sections";

describe("fetchAttendanceSection", () => {
  beforeEach(() => apiClient.mockReset());

  it("asks the section route with only that section's filters and the caller's signal", async () => {
    apiClient.mockResolvedValue({ data: { stages: { funnels: [] } } });
    const controller = new AbortController();

    const out = await fetchAttendanceSection(
      "stages",
      { dateFrom: "2026-09-19", dateTo: "2026-09-25", rankMetric: "volume" },
      controller.signal,
    );

    expect(out).toEqual({ stages: { funnels: [] } });
    const [url, init] = apiClient.mock.calls[0];
    expect(url).toBe("/attendance/overview/stages?date_from=2026-09-19&date_to=2026-09-25");
    expect(init).toMatchObject({ method: "GET", signal: controller.signal });
  });

  it("raises the server's status so the caller can decide to retry", async () => {
    apiClient.mockResolvedValue({ error: { message: "busy", status: 503 } });

    const failure = await fetchAttendanceSection("summary", {}).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AttendanceSectionError);
    expect((failure as AttendanceSectionError).status).toBe(503);
  });

  it("treats an empty body as a failure, not as a section with no data", async () => {
    apiClient.mockResolvedValue({});
    await expect(fetchAttendanceSection("summary", {})).rejects.toBeInstanceOf(AttendanceSectionError);
  });
});

describe("fetchMemberActivity", () => {
  beforeEach(() => apiClient.mockReset());

  it("asks a teammate's activity with the period and timezone", async () => {
    apiClient.mockResolvedValue({ data: { timezone: "America/Sao_Paulo", days: [] } });
    const controller = new AbortController();

    const out = await fetchMemberActivity(
      { mode: "member", memberId: "u1" },
      { dateFrom: "2026-09-29", dateTo: "2026-10-05" },
      "America/Sao_Paulo",
      controller.signal,
    );

    expect(out).toEqual({ timezone: "America/Sao_Paulo", days: [] });
    const [url, init] = apiClient.mock.calls[0];
    expect(url).toBe("/attendance/members/u1/activity?date_from=2026-09-29&date_to=2026-10-05&timezone=America%2FSao_Paulo");
    expect(init).toMatchObject({ method: "GET", signal: controller.signal });
  });

  it("uses the self route in self mode", async () => {
    apiClient.mockResolvedValue({ data: { days: [] } });
    await fetchMemberActivity({ mode: "self" }, { dateFrom: "2026-09-29", dateTo: "2026-10-05" }, "UTC");
    expect(apiClient.mock.calls[0][0]).toMatch(/^\/attendance\/members\/me\/activity\?/);
  });

  it("keeps the out of scope status so the sheet can explain it", async () => {
    apiClient.mockResolvedValue({ error: { message: "Member not found in your departments", status: 404 } });
    const failure = await fetchMemberActivity({ mode: "member", memberId: "u2" }, { dateFrom: "2026-09-29", dateTo: "2026-10-05" }, "UTC").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AttendanceSectionError);
    expect((failure as AttendanceSectionError).status).toBe(404);
  });

  it("treats an empty body as a failure", async () => {
    apiClient.mockResolvedValue({});
    await expect(fetchMemberActivity({ mode: "self" }, { dateFrom: "2026-09-29", dateTo: "2026-10-05" }, "UTC")).rejects.toBeInstanceOf(AttendanceSectionError);
  });
});
