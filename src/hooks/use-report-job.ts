"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
    createReportAction,
    fetchReportFileAction,
    getReportAction,
} from "@/app/actions/reports";
import { downloadBlob } from "@/lib/browser/download";
import {
    isTerminalReportStatus,
    type CreateReportRequest,
    type ReportJob,
} from "@/lib/reports/types";

const FIRST_POLL_MS = 700;
const MAX_POLL_MS = 5_000;
const POLL_BACKOFF = 1.4;
const MAX_POLL_ATTEMPTS = 240;

export type ReportRequestOutcome =
    | { status: "done"; job: ReportJob }
    | { status: "failed"; job: ReportJob }
    | { status: "error"; error: string };

interface UseReportJobOptions {
    autoDownload?: boolean;

    onQueued?: (job: ReportJob) => void;
}

export function useReportJob(options: UseReportJobOptions = {}) {
    const autoDownload = options.autoDownload ?? true;

    const onQueued = useRef(options.onQueued);

    useEffect(() => {
        onQueued.current = options.onQueued;
    }, [options.onQueued]);

    const [job, setJob] = useState<ReportJob | null>(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cancelled = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = useCallback(() => {
        if (timer.current !== null) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    }, []);

    useEffect(() => {
        cancelled.current = false;
        return () => {
            cancelled.current = true;
            if (timer.current !== null) {
                clearTimeout(timer.current);
                timer.current = null;
            }
        };
    }, []);

    const waitFor = useCallback(
        (id: string): Promise<ReportJob | { error: string }> =>
            new Promise((resolve) => {
                let delay = FIRST_POLL_MS;
                let attempts = 0;

                const poll = async () => {
                    if (cancelled.current) {
                        resolve({ error: "cancelled" });
                        return;
                    }

                    attempts += 1;
                    const { data, error: pollError } = await getReportAction(id);

                    if (cancelled.current) {
                        resolve({ error: "cancelled" });
                        return;
                    }
                    if (pollError || !data) {
                        resolve({ error: pollError ?? "unknown" });
                        return;
                    }

                    setJob(data);

                    if (isTerminalReportStatus(data.status)) {
                        resolve(data);
                        return;
                    }
                    if (attempts >= MAX_POLL_ATTEMPTS) {
                        resolve({ error: "timeout" });
                        return;
                    }

                    delay = Math.min(Math.round(delay * POLL_BACKOFF), MAX_POLL_MS);
                    timer.current = setTimeout(() => void poll(), delay);
                };

                timer.current = setTimeout(() => void poll(), FIRST_POLL_MS);
            }),
        [],
    );

    const download = useCallback(async (id: string): Promise<string | null> => {
        const { data, error: fileError } = await fetchReportFileAction(id);
        if (fileError || !data) {
            return fileError ?? "unknown";
        }
        downloadBlob(data.blob, data.filename);
        return null;
    }, []);

    const wait = useCallback(
        async (id: string): Promise<ReportRequestOutcome> => {
            const settled = await waitFor(id);
            if ("error" in settled) {
                if (!cancelled.current) setError(settled.error);
                return { status: "error", error: settled.error };
            }
            if (settled.status !== "done") {
                return { status: "failed", job: settled };
            }
            return { status: "done", job: settled };
        },
        [waitFor],
    );

    const settle = useCallback(
        async (job: ReportJob): Promise<ReportRequestOutcome> => {
            if (!cancelled.current) setJob(job);
            if (!isTerminalReportStatus(job.status)) {
                onQueued.current?.(job);
            }

            const outcome = isTerminalReportStatus(job.status)
                ? job.status === "done"
                    ? ({ status: "done", job } as const)
                    : ({ status: "failed", job } as const)
                : await wait(job.id);

            if (outcome.status !== "done" || !autoDownload) {
                return outcome;
            }

            const downloadError = await download(outcome.job.id);
            if (downloadError) {
                if (!cancelled.current) setError(downloadError);
                return { status: "error", error: downloadError };
            }
            return outcome;
        },
        [autoDownload, download, wait],
    );

    const track = useCallback(
        async (job: ReportJob): Promise<ReportRequestOutcome> => {
            clearTimer();
            setError(null);
            setRunning(true);
            try {
                return await settle(job);
            } finally {
                if (!cancelled.current) setRunning(false);
            }
        },
        [clearTimer, settle],
    );

    const request = useCallback(
        async (input: CreateReportRequest): Promise<ReportRequestOutcome> => {
            clearTimer();
            setError(null);
            setRunning(true);
            setJob(null);

            try {
                const created = await createReportAction(input);
                if (created.error || !created.data) {
                    const message = created.error ?? "unknown";
                    if (!cancelled.current) setError(message);
                    return { status: "error", error: message };
                }
                return await settle(created.data);
            } finally {
                if (!cancelled.current) setRunning(false);
            }
        },
        [clearTimer, settle],
    );

    return { job, running, error, request, track, download };
}
