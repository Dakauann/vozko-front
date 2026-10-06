"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getAdPublishJobAction, isAdsError } from "@/app/actions/advertising";
import { jobIsTerminal } from "@/lib/advertising/delivery";
import { MAX_CONSECUTIVE_POLL_ERRORS, nextPollDelay } from "@/lib/media-generation/polling";
import { jobOutcome } from "@/lib/advertising/publish";
import type { AdPublishJob } from "@/lib/advertising/types";

export function usePublishJob(onPublished: (job: AdPublishJob) => void, initial: AdPublishJob | null = null) {
  const [job, setJob] = useState<AdPublishJob | null>(initial);
  const [pollError, setPollError] = useState<string | null>(null);
  const [pollRun, setPollRun] = useState(0);
  const published = useRef(onPublished);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    published.current = onPublished;
  }, [onPublished]);

  const jobId = job?.id ?? null;
  const settled = job ? jobIsTerminal(job.status) : true;

  useEffect(() => {
    if (!jobId || settled) return;
    let cancelled = false;
    let delay: number | null = null;
    let errors = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      delay = nextPollDelay(delay);
      timer = setTimeout(() => void poll(), delay);
    };
    const poll = async () => {
      const result = await getAdPublishJobAction(jobId);
      if (cancelled) return;
      if (isAdsError(result)) {
        errors += 1;
        if (result.status === 404 || errors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          setPollError(result.error);
          return;
        }
        schedule();
        return;
      }
      errors = 0;
      setPollError(null);
      setJob(result.data);
      if (!jobIsTerminal(result.data.status)) schedule();
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [jobId, settled, pollRun]);

  useEffect(() => {
    if (!job || jobOutcome(job.status) !== "published" || handled.current === job.id) return;
    handled.current = job.id;
    published.current(job);
  }, [job]);

  const retryPoll = useCallback(() => {
    setPollError(null);
    setPollRun((run) => run + 1);
  }, []);

  const reset = useCallback(() => {
    setJob(null);
    setPollError(null);
  }, []);

  return { job, start: setJob, reset, pollError, retryPoll };
}
