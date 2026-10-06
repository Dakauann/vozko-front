"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isActionError, type ActionError, type ActionResult } from "@/app/actions/action-result";
import { getMediaGenerationAction, requestMediaGenerationAction } from "@/app/actions/media-generation";
import {
  CLIENT_TIMEOUT_MS,
  MAX_CONSECUTIVE_POLL_ERRORS,
  mediaJobOutcome,
  nextPollDelay,
} from "@/lib/media-generation/polling";
import type { MediaGenerationInput, MediaGenerationJob, MediaJobStatus } from "@/lib/media-generation/types";

export type MediaGenerationStatus = "idle" | "generating" | "done" | "failed";

export interface MediaGenerationResult {
  mediaId: string;
  mediaUrl: string;
}

export interface MediaGenerationError {
  code: string;
  message: string;
}

export const POLL_FAILED = "poll_failed";
export const TIMED_OUT = "timed_out";
export const REQUEST_FAILED = "request_failed";

type Settled =
  | { status: "done"; result: MediaGenerationResult }
  | { status: "failed"; error: MediaGenerationError };

type PendingJobStatus = Exclude<MediaJobStatus, "done" | "failed">;

type GenerationState = { status: "idle" } | { status: "generating"; settling: boolean; jobStatus: PendingJobStatus | null } | Settled;

interface PollRun {
  jobId: string | null;
  deadline: number;
  delay: number | null;
  errors: number;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  cancelled: boolean;
  settle: (settled: Settled) => void;
  progress: (jobStatus: PendingJobStatus) => void;
}

interface UseMediaGenerationOptions {
  onDone?: (result: MediaGenerationResult) => void;
}

function failure(code: string, message: string = code): Settled {
  return { status: "failed", error: { code, message } };
}

function pageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function cancelRun(run: PollRun) {
  run.cancelled = true;
  if (run.timer !== null) clearTimeout(run.timer);
  run.timer = null;
}

function scheduleNext(run: PollRun) {
  if (Date.now() >= run.deadline) {
    run.settle(failure(TIMED_OUT));
    return;
  }
  run.delay = nextPollDelay(run.delay);
  run.timer = setTimeout(() => void poll(run), run.delay);
}

function followJob(run: PollRun, job: MediaGenerationJob) {
  const outcome = mediaJobOutcome(job);
  if (outcome.kind === "done") {
    run.settle({ status: "done", result: { mediaId: outcome.mediaId, mediaUrl: outcome.mediaUrl } });
    return;
  }
  if (outcome.kind === "failed") {
    run.settle(failure(outcome.code));
    return;
  }
  run.progress(job.status as PendingJobStatus);
  scheduleNext(run);
}

function retry(run: PollRun, error: ActionError) {
  run.errors += 1;
  if (error.status === 404 || run.errors >= MAX_CONSECUTIVE_POLL_ERRORS) {
    run.settle(failure(POLL_FAILED, error.error));
    return;
  }
  scheduleNext(run);
}

async function poll(run: PollRun) {
  run.timer = null;
  if (run.cancelled || run.inFlight || run.jobId === null || pageHidden()) return;
  run.inFlight = true;
  const result = await getMediaGenerationAction(run.jobId);
  run.inFlight = false;
  if (run.cancelled) return;
  if (isActionError(result)) {
    retry(run, result);
    return;
  }
  run.errors = 0;
  followJob(run, result.data);
}

function resume(run: PollRun) {
  if (run.cancelled || run.inFlight || run.jobId === null) return;
  if (run.timer !== null) clearTimeout(run.timer);
  void poll(run);
}

export function useMediaGeneration(options: UseMediaGenerationOptions = {}) {
  const [state, setState] = useState<GenerationState>({ status: "idle" });
  const runRef = useRef<PollRun | null>(null);
  const onDone = useRef(options.onDone);

  useEffect(() => {
    onDone.current = options.onDone;
  }, [options.onDone]);

  const stop = useCallback(() => {
    if (runRef.current) cancelRun(runRef.current);
    runRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (runRef.current && !pageHidden()) resume(runRef.current);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const follow = useCallback(
    async (request: () => Promise<ActionResult<MediaGenerationJob>>) => {
      stop();
      const run: PollRun = {
        jobId: null,
        deadline: Date.now() + CLIENT_TIMEOUT_MS,
        delay: null,
        errors: 0,
        timer: null,
        inFlight: false,
        cancelled: false,
        settle: (settled) => {
          cancelRun(run);
          if (runRef.current !== run) return;
          runRef.current = null;
          setState(settled);
          if (settled.status === "done") onDone.current?.(settled.result);
        },
        progress: (jobStatus) => {
          if (runRef.current !== run) return;
          const settling = jobStatus === "settling";
          setState((current) => (current.status === "generating" && current.jobStatus === jobStatus ? current : { status: "generating", settling, jobStatus }));
        },
      };
      runRef.current = run;
      setState({ status: "generating", settling: false, jobStatus: null });

      const created = await request();
      if (run.cancelled) return;
      if (isActionError(created)) {
        run.settle(failure(created.code ?? REQUEST_FAILED, created.error));
        return;
      }
      run.jobId = created.data.id;
      followJob(run, created.data);
    },
    [stop],
  );

  const start = useCallback((input: MediaGenerationInput) => follow(() => requestMediaGenerationAction(input)), [follow]);

  const reset = useCallback(() => {
    stop();
    setState({ status: "idle" });
  }, [stop]);

  return {
    start,
    follow,
    reset,
    status: state.status,
    settling: state.status === "generating" && state.settling,
    jobStatus: state.status === "generating" ? state.jobStatus : null,
    result: state.status === "done" ? state.result : undefined,
    error: state.status === "failed" ? state.error : undefined,
  };
}
