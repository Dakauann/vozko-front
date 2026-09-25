import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();
vi.mock("@/lib/api/browser-client", () => ({ apiClient: (...args: unknown[]) => apiClient(...args) }));

import { fetchAttendanceSection } from "./attendance";
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
