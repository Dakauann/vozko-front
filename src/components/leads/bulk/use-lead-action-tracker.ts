"use client";

import { createElement, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getLeadActionRunAction, getLeadAudienceAction } from "@/app/actions/lead-actions";
import { getReportAction } from "@/app/actions/reports";
import { useOptionalCrm } from "@/contexts/crm-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useReportJob } from "@/hooks/use-report-job";
import { Link } from "@/i18n/routing";
import type { CodedError } from "@/lib/api/coded-error";
import {
  LEAD_ACTION_FAILURE_CODES,
  isTerminalAudience,
  isTerminalRun,
  type LeadActionRun,
  type LeadActionStart,
  type LeadAudienceJob,
} from "@/lib/leads/actions";
import {
  browserStorage,
  forgetFollowed,
  readFollowed,
  rememberFollowed,
  type FollowedJob,
  type FollowedKind,
} from "@/lib/leads/followed-runs";
import { pollUntil, type PollAnswer, type PollOutcome, type PollWake } from "@/lib/polling";
import { pathForScreen } from "@/lib/navigation/routes";
import { isTerminalReportStatus, type ReportJob } from "@/lib/reports/types";

const MAX_POLLS = 720;
const MAX_REPORT_POLLS = 240;
const RESUMED_TOAST_ID = "lead-bulk-resumed";

const KNOWN_FAILURES: readonly string[] = LEAD_ACTION_FAILURE_CODES;
const GONE_CODES: readonly string[] = ["lead_action_run_not_found", "lead_action_audience_not_found", "not_found"];

interface Lifetime {
  controller: AbortController;
  following: Set<string>;
}

async function readReport(id: string): Promise<PollAnswer<ReportJob, string>> {
  const answer = await getReportAction(id);
  return answer.data ? { data: answer.data, error: null } : { data: null, error: answer.error ?? "unknown" };
}

function settledOutcome<T>(value: T): PollOutcome<T, never> {
  return { status: "over", value };
}

function isGone(outcome: PollOutcome<unknown, CodedError>): boolean {
  return outcome.status === "failing" && GONE_CODES.includes(outcome.error.code ?? "");
}

function followKey(kind: FollowedKind, id: string): string {
  return `${kind}:${id}`;
}

export function useLeadActionTracker({ onSettled }: { onSettled: () => void }) {
  const t = useTranslations("leadsPage.bulk");
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const { download } = useReportJob({ autoDownload: false });
  const lifetime = useRef<Lifetime | null>(null);
  const settled = useRef(onSettled);
  const runWakers = useRef(new Map<string, Set<() => void>>());
  const subscribeBulk = useOptionalCrm()?.subscribeLeadsBulkUpdates;

  useEffect(() => {
    settled.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    const current: Lifetime = { controller: new AbortController(), following: new Set() };
    lifetime.current = current;
    return () => current.controller.abort();
  }, []);

  useEffect(() => subscribeBulk?.((event) => runWakers.current.get(event.runId)?.forEach((wake) => wake())), [subscribeBulk]);

  const wakeRun = useCallback(
    (id: string): PollWake =>
      (listener) => {
        const wakers = runWakers.current.get(id) ?? new Set<() => void>();
        wakers.add(listener);
        runWakers.current.set(id, wakers);
        return () => {
          wakers.delete(listener);
          if (wakers.size === 0 && runWakers.current.get(id) === wakers) runWakers.current.delete(id);
        };
      },
    [],
  );

  const follow = useCallback(
    <T, E>(read: () => Promise<PollAnswer<T, E>>, isOver: (value: T) => boolean, maxPolls: number, wake?: PollWake): Promise<PollOutcome<T, E>> => {
      const signal = lifetime.current?.controller.signal;
      if (!signal || signal.aborted) return Promise.resolve({ status: "aborted" });
      return pollUntil(read, isOver, { signal, maxPolls, wake });
    },
    [],
  );

  const claim = useCallback((kind: FollowedKind, id: string): Lifetime | null => {
    const current = lifetime.current;
    const key = followKey(kind, id);
    if (!current || current.controller.signal.aborted || current.following.has(key)) return null;
    current.following.add(key);
    return current;
  }, []);

  const remember = useCallback(
    (kind: FollowedKind, id: string) => {
      const now = Date.now();
      rememberFollowed(browserStorage(), workspaceId, { id, kind, since: now }, now);
    },
    [workspaceId],
  );

  const forget = useCallback(
    (kind: FollowedKind, id: string) => forgetFollowed(browserStorage(), workspaceId, kind, id, Date.now()),
    [workspaceId],
  );

  const failureText = useCallback(
    (code: string | undefined) => t(`failures.${code && KNOWN_FAILURES.includes(code) ? code : "unknown"}`),
    [t],
  );

  const finishRun = useCallback(
    (outcome: PollOutcome<LeadActionRun, CodedError>, resumed: boolean) => {
      settled.current();
      if (outcome.status !== "over") {
        if (!(resumed && isGone(outcome))) toast.message(t("runLost"));
        return;
      }
      const last = outcome.value;
      if (last.status === "failed") {
        toast.error(failureText(last.failureCode));
        return;
      }
      const skipped = Object.values(last.result.skipped).reduce((sum, count) => sum + count, 0);
      toast.success(t("runDone", { changed: last.result.changed, skipped }));
    },
    [t, failureText],
  );

  const followRun = useCallback(
    async (id: string, first: LeadActionRun | null) => {
      const owner = claim("run", id);
      if (!owner) return;
      try {
        const outcome =
          first && isTerminalRun(first.status)
            ? settledOutcome(first)
            : await follow<LeadActionRun, CodedError>(() => getLeadActionRunAction(id), (value) => isTerminalRun(value.status), MAX_POLLS, wakeRun(id));
        if (outcome.status === "aborted") return;
        forget("run", id);
        finishRun(outcome, first === null);
      } finally {
        owner.following.delete(followKey("run", id));
      }
    },
    [claim, follow, forget, finishRun, wakeRun],
  );

  const finishAudience = useCallback(
    (outcome: PollOutcome<LeadAudienceJob, CodedError>, resumed: boolean) => {
      if (outcome.status !== "over") {
        if (!(resumed && isGone(outcome))) toast.message(t("audienceLost"));
        return;
      }
      const last = outcome.value;
      if (last.status === "failed") {
        toast.error(t.has(`errors.${last.failureCode ?? ""}`) ? t(`errors.${last.failureCode}`) : failureText(last.failureCode));
        return;
      }
      toast.success(t("audienceDone", { matched: last.matched }));
    },
    [t, failureText],
  );

  const followAudience = useCallback(
    async (id: string, first: LeadAudienceJob | null) => {
      const owner = claim("audience", id);
      if (!owner) return;
      try {
        const outcome =
          first && isTerminalAudience(first.status)
            ? settledOutcome(first)
            : await follow<LeadAudienceJob, CodedError>(() => getLeadAudienceAction(id), (value) => isTerminalAudience(value.status), MAX_POLLS);
        if (outcome.status === "aborted") return;
        forget("audience", id);
        finishAudience(outcome, first === null);
      } finally {
        owner.following.delete(followKey("audience", id));
      }
    },
    [claim, follow, forget, finishAudience],
  );

  const trackReport = useCallback(
    async (job: ReportJob) => {
      const outcome = isTerminalReportStatus(job.status)
        ? settledOutcome(job)
        : await follow<ReportJob, string>(() => readReport(job.id), (value) => isTerminalReportStatus(value.status), MAX_REPORT_POLLS);
      if (outcome.status === "aborted") return;
      if (outcome.status !== "over") {
        toast.error(t("exportFailed"));
        return;
      }
      const last = outcome.value;
      if (last.status !== "done") {
        toast.error(last.failureCode === "empty_result" ? t("exportEmpty") : t("exportFailed"));
        return;
      }
      const failed = await download(last.id);
      if (lifetime.current?.controller.signal.aborted) return;
      if (failed) {
        toast.error(t("exportFailed"));
        return;
      }
      toast.success(t("exportDone", { count: last.rowCount ?? 0 }));
    },
    [follow, download, t],
  );

  useEffect(() => {
    const pending: FollowedJob[] = readFollowed(browserStorage(), workspaceId, Date.now());
    if (pending.length === 0) return;
    toast.message(t("runResumed"), { id: RESUMED_TOAST_ID });
    for (const job of pending) {
      if (job.kind === "run") void followRun(job.id, null);
      else void followAudience(job.id, null);
    }
  }, [workspaceId, t, followRun, followAudience]);

  return useCallback(
    (start: LeadActionStart) => {
      if (start.run) {
        toast.message(t("runQueued"));
        if (!isTerminalRun(start.run.status)) remember("run", start.run.id);
        void followRun(start.run.id, start.run);
      } else if (start.report) {
        toast.message(t("exportQueued"));
        void trackReport(start.report);
      } else if (start.audience) {
        toast.message(t("audienceQueued"));
        if (!isTerminalAudience(start.audience.status)) remember("audience", start.audience.id);
        void followAudience(start.audience.id, start.audience);
      } else if (start.callList) {
        const path = pathForScreen("call_list_detail", { listId: start.callList.id });
        toast.success(t("callListQueued"), path ? { action: createElement(Link, { href: path, className: "font-medium underline underline-offset-2" }, t("callListOpen")) } : undefined);
      }
    },
    [t, remember, followRun, trackReport, followAudience],
  );
}
