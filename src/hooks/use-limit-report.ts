"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { PeriodLimitReport, PeriodLimitReportState } from "@/lib/period-limit/period-limit";
import { useReportJob } from "@/hooks/use-report-job";
import type { CreateReportRequest } from "@/lib/reports/types";

const CANCELLED = "cancelled";

export function useLimitReport(periodKey: string, build: () => CreateReportRequest): PeriodLimitReport {
  const texp = useTranslations("metricsOps.export");
  const [progress, setProgress] = useState<{ key: string; state: PeriodLimitReportState }>({ key: periodKey, state: "idle" });
  const requestedKey = useRef(periodKey);
  const mark = useCallback((key: string, state: PeriodLimitReportState) => setProgress({ key, state }), []);
  const { request } = useReportJob({ onQueued: () => mark(requestedKey.current, "queued") });

  const onRequest = useCallback(async () => {
    const key = periodKey;
    requestedKey.current = key;
    mark(key, "requesting");
    const outcome = await request(build());
    if (outcome.status === "done") {
      mark(key, "queued");
      toast(texp("ready"));
      return;
    }
    mark(key, "idle");
    if (outcome.status === "error" && outcome.error === CANCELLED) return;
    toast.error(texp("failed"), {
      description: outcome.status === "failed" ? texp(`failure.${outcome.job.failureCode ?? "render_failed"}`) : outcome.error,
    });
  }, [build, mark, periodKey, request, texp]);

  return {
    state: progress.key === periodKey ? progress.state : "idle",
    onRequest: () => void onRequest(),
  };
}
