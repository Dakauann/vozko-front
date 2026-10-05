import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { AttendanceSectionError } from "@/lib/attendance/sections";
import type { MemberActivityReport } from "@/lib/attendance/member-activity";

const fetchMemberActivity = vi.fn();
vi.mock("@/app/actions/attendance", () => ({
  fetchMemberActivity: (...args: unknown[]) => fetchMemberActivity(...args),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }),
}));
vi.mock("@/components/charts/dense-charts", () => ({
  DataChart: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}));

import { MemberActivitySheet } from "./member-activity-sheet";

const t = ptMessages.metricsOps.attendance.memberActivity;

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <MemberActivitySheet subject={{ mode: "member", memberId: "u1" }} name="Clara Nunes" onOpenChange={vi.fn()} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function report(overrides: Partial<MemberActivityReport> = {}): MemberActivityReport {
  return {
    timezone: "America/Sao_Paulo",
    usual_start: "08:30",
    connected_ms: 6 * 3_600_000,
    on_call_ms: 30 * 60_000,
    days: [
      {
        date: "2026-10-05",
        weekday: 1,
        connected_ms: 6 * 3_600_000,
        on_call_ms: 30 * 60_000,
        sessions: [{ start: "2026-10-05T12:00:00Z", end: "2026-10-05T18:00:00Z", on_call_ms: 30 * 60_000, open: true }],
        flags: ["late_start"],
      },
    ],
    heatmap_minutes: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
    received: { inbound_rr: 3 },
    received_while_offline: 0,
    ...overrides,
  };
}

describe("MemberActivitySheet", () => {
  beforeEach(() => {
    fetchMemberActivity.mockReset();
  });

  it("explains a member outside the caller's departments instead of showing numbers", async () => {
    fetchMemberActivity.mockImplementation(async () => {
      throw new AttendanceSectionError("Member not found in your departments", 404);
    });
    renderSheet();
    expect(await screen.findByText(t.outOfScope)).toBeInTheDocument();
    expect(screen.queryByText(t.kpi.connected)).not.toBeInTheDocument();
  });

  it("shows an error, never zeros, when the report fails", async () => {
    fetchMemberActivity.mockImplementation(async () => {
      throw new AttendanceSectionError("boom", 500);
    });
    renderSheet();
    expect(await screen.findByRole("alert", undefined, { timeout: 3000 })).toHaveTextContent(ptMessages.metricsOps.common.sectionError);
    expect(screen.queryByText(t.kpi.connected)).not.toBeInTheDocument();
  });

  it("renders the day with its flag and the live session", async () => {
    fetchMemberActivity.mockResolvedValue(report());
    renderSheet();
    expect(await screen.findByText(t.flags.late_start)).toBeInTheDocument();
    expect(screen.getByText(t.timeline.connectedNow)).toBeInTheDocument();
    expect(screen.getByText("08:30")).toBeInTheDocument();
    expect(screen.queryByText(t.offlineNotice.title.replace("{count}", "0"))).not.toBeInTheDocument();
  });

  it("warns when the roulette handed conversations to an offline member", async () => {
    fetchMemberActivity.mockResolvedValue(report({ received_while_offline: 2 }));
    renderSheet();
    expect(await screen.findByText(t.offlineNotice.title.replace("{count}", "2"))).toBeInTheDocument();
  });
});
