import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { CreateReportRequest, ReportJob } from "@/lib/reports/types";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

type Outcome = { status: "done"; job: ReportJob } | { status: "failed"; job: ReportJob } | { status: "error"; error: string };
const reportJob = vi.hoisted(() => ({
  onQueued: undefined as undefined | ((job: ReportJob) => void),
  request: vi.fn(),
}));
vi.mock("@/hooks/use-report-job", () => ({
  useReportJob: (options: { onQueued?: (job: ReportJob) => void }) => {
    reportJob.onQueued = options.onQueued;
    return { request: reportJob.request };
  },
}));

import { useLimitReport } from "./use-limit-report";

const job = { id: "r1", status: "queued", kind: "whatsapp_dispatch" } as ReportJob;
const request: CreateReportRequest = { kind: "whatsapp_dispatch", format: "csv", params: { dateFrom: "2025-01-01", dateTo: "2026-09-30" } };

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

function deferred() {
  let resolve: (outcome: Outcome) => void = () => {};
  const promise = new Promise<Outcome>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("useLimitReport", () => {
  beforeEach(() => {
    reportJob.request.mockReset();
    toast.mockReset();
    toast.error.mockReset();
  });

  it("creates the job for the whole period and says it is queued", async () => {
    const pending = deferred();
    reportJob.request.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useLimitReport("a", () => request), { wrapper });

    act(() => result.current.onRequest());
    expect(result.current.state).toBe("requesting");
    expect(reportJob.request).toHaveBeenCalledWith(request);

    act(() => reportJob.onQueued?.(job));
    expect(result.current.state).toBe("queued");

    await act(async () => pending.resolve({ status: "done", job: { ...job, status: "done" } }));
    expect(result.current.state).toBe("queued");
    expect(toast).toHaveBeenCalledWith("Relatório pronto, o download começou");
  });

  it("lets the person try again after a failure, with the reason", async () => {
    reportJob.request.mockResolvedValue({ status: "failed", job: { ...job, status: "failed", failureCode: "empty_result" } });
    const { result } = renderHook(() => useLimitReport("b", () => request), { wrapper });

    await act(async () => result.current.onRequest());

    expect(result.current.state).toBe("idle");
    expect(toast.error).toHaveBeenCalledWith("Não foi possível gerar o relatório", { description: "Não há dados no período escolhido." });
  });

  it("starts over for another period", async () => {
    reportJob.request.mockReturnValue(new Promise(() => {}));
    const { result, rerender } = renderHook(({ key }: { key: string }) => useLimitReport(key, () => request), { wrapper, initialProps: { key: "c" } });

    act(() => result.current.onRequest());
    rerender({ key: "d" });

    expect(result.current.state).toBe("idle");
  });
});
