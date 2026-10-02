"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isActionError, type ActionError } from "@/app/actions/action-result";
import { getImageGenerationAction, requestImageGenerationAction } from "@/app/actions/image-generation";
import {
  CLIENT_TIMEOUT_MS,
  MAX_CONSECUTIVE_POLL_ERRORS,
  imageJobOutcome,
  nextPollDelay,
} from "@/lib/image-generation/polling";
import type { ImageAspect, ImageGenerationJob } from "@/lib/image-generation/types";

export type ImageGenerationStatus = "idle" | "generating" | "done" | "failed";

export interface ImageGenerationResult {
  mediaId: string;
  mediaUrl: string;
}

export interface ImageGenerationError {
  code: string;
  message: string;
}

export const POLL_FAILED = "poll_failed";
export const TIMED_OUT = "timed_out";
export const REQUEST_FAILED = "request_failed";

type Settled =
  | { status: "done"; result: ImageGenerationResult }
  | { status: "failed"; error: ImageGenerationError };

type GenerationState = { status: "idle" | "generating" } | Settled;

interface PollRun {
  jobId: string | null;
  deadline: number;
  delay: number | null;
  errors: number;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  cancelled: boolean;
  settle: (settled: Settled) => void;
}

interface UseImageGenerationOptions {
  onDone?: (result: ImageGenerationResult) => void;
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

function follow(run: PollRun, job: ImageGenerationJob) {
  const outcome = imageJobOutcome(job);
  if (outcome.kind === "done") {
    run.settle({ status: "done", result: { mediaId: outcome.mediaId, mediaUrl: outcome.mediaUrl } });
    return;
  }
  if (outcome.kind === "failed") {
    run.settle(failure(outcome.code));
    return;
  }
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
  const result = await getImageGenerationAction(run.jobId);
  run.inFlight = false;
  if (run.cancelled) return;
  if (isActionError(result)) {
    retry(run, result);
    return;
  }
  run.errors = 0;
  follow(run, result.data);
}

function resume(run: PollRun) {
  if (run.cancelled || run.inFlight || run.jobId === null) return;
  if (run.timer !== null) clearTimeout(run.timer);
  void poll(run);
}

export function useImageGeneration(options: UseImageGenerationOptions = {}) {
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

  const start = useCallback(
    async (prompt: string, aspect: ImageAspect, referenceMediaIds: string[] = []) => {
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
      };
      runRef.current = run;
      setState({ status: "generating" });

      const created = await requestImageGenerationAction(prompt, aspect, referenceMediaIds);
      if (run.cancelled) return;
      if (isActionError(created)) {
        run.settle(failure(created.code ?? REQUEST_FAILED, created.error));
        return;
      }
      run.jobId = created.data.id;
      follow(run, created.data);
    },
    [stop],
  );

  const reset = useCallback(() => {
    stop();
    setState({ status: "idle" });
  }, [stop]);

  return {
    start,
    reset,
    status: state.status,
    result: state.status === "done" ? state.result : undefined,
    error: state.status === "failed" ? state.error : undefined,
  };
}
