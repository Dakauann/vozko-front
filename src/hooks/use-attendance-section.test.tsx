import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAttendanceSection = vi.fn();
vi.mock("@/app/actions/attendance", () => ({
  fetchAttendanceSection: (...args: unknown[]) => fetchAttendanceSection(...args),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }),
}));

import { useAttendanceSection } from "./use-attendance-section";
import type { AttendanceSection } from "@/lib/attendance/sections";
import type { AttendanceOverviewParams } from "@/lib/attendance/types";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useAttendanceSection", () => {
  beforeEach(() => {
    fetchAttendanceSection.mockReset();
    fetchAttendanceSection.mockImplementation(async (section: string) => ({ section }));
  });

  it("does not ask the server while the section is off screen", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useAttendanceSection("backlog", {}, { enabled }),
      { wrapper: wrapper(), initialProps: { enabled: false } },
    );
    expect(result.current.isPending).toBe(true);
    expect(fetchAttendanceSection).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data).toEqual({ section: "backlog" }));
    expect(fetchAttendanceSection).toHaveBeenCalledTimes(1);
  });

  it("refetches only the team when the ranking metric changes", async () => {
    const { result, rerender } = renderHook(
      ({ params }: { params: AttendanceOverviewParams }) => ({
        summary: useAttendanceSection("summary", params, { enabled: true }),
        team: useAttendanceSection("team", params, { enabled: true }),
      }),
      { wrapper: wrapper(), initialProps: { params: { rankMetric: "resolved" } } },
    );
    await waitFor(() => expect(result.current.team.data).toBeDefined());
    await waitFor(() => expect(result.current.summary.data).toBeDefined());

    rerender({ params: { rankMetric: "volume" } });
    await waitFor(() => expect(fetchAttendanceSection).toHaveBeenCalledTimes(3));

    const sections = fetchAttendanceSection.mock.calls.map((call) => call[0] as AttendanceSection);
    expect(sections.filter((s) => s === "summary")).toHaveLength(1);
    expect(sections.filter((s) => s === "team")).toHaveLength(2);
  });
});
