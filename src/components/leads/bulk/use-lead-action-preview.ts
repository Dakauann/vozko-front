"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getLeadActionPreviewAction, previewLeadActionAction } from "@/app/actions/lead-actions";
import { useWorkspace } from "@/contexts/workspace-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SECTION_GC_MS, SectionError, sectionRetryDelay, shouldRetrySection } from "@/lib/analytics/section-query";
import type { CodedError } from "@/lib/api/coded-error";
import {
  LEAD_ACTION_PREVIEW_NOT_FOUND,
  leadActionPreviewProgress,
  type LeadActionPreview,
  type LeadActionPreviewProgress,
  type LeadActionRequest,
} from "@/lib/leads/actions";
import { pollUntil } from "@/lib/polling";

const DEBOUNCE_MS = 300;
const MAX_POLLS = 120;

export class LeadActionPreviewError extends SectionError {
  constructor(
    readonly refusal: CodedError,
    readonly countFailed = false,
  ) {
    super(refusal.message ?? refusal.code ?? "preview failed", refusal.status, refusal.code);
  }
}

function settled(preview: LeadActionPreview): LeadActionPreview {
  if (preview.status === "failed") throw new LeadActionPreviewError({ code: preview.failureCode }, true);
  return preview;
}

type PreviewWatcher = (preview: LeadActionPreview) => void;

function watched(read: () => ReturnType<typeof getLeadActionPreviewAction>, onRead?: PreviewWatcher) {
  return async () => {
    const answer = await read();
    if (answer.data) onRead?.(answer.data);
    return answer;
  };
}

export async function finishedLeadActionPreview(previewId: string, signal: AbortSignal, onRead?: PreviewWatcher): Promise<LeadActionPreview> {
  const read = watched(() => getLeadActionPreviewAction(previewId, signal), onRead);
  const last = await pollUntil<LeadActionPreview, CodedError>(read, (next) => next.status !== "running", {
    signal,
    maxPolls: MAX_POLLS,
  });
  switch (last.status) {
    case "aborted":
      throw signal.reason;
    case "failing":
      throw new LeadActionPreviewError(last.error);
    case "exhausted":
      throw new LeadActionPreviewError({ code: LEAD_ACTION_PREVIEW_NOT_FOUND });
  }
  return settled(last.value);
}

async function settledPreview(request: LeadActionRequest, signal: AbortSignal, onRead?: PreviewWatcher): Promise<LeadActionPreview> {
  const first = await previewLeadActionAction(request, signal);
  if (first.error) throw new LeadActionPreviewError(first.error);
  if (first.data.status !== "running") return settled(first.data);
  onRead?.(first.data);
  return finishedLeadActionPreview(first.data.id, signal, onRead);
}

function refusalOf(error: Error | null): CodedError | null {
  if (!error) return null;
  return error instanceof LeadActionPreviewError ? error.refusal : { message: error.message };
}

export type FinishedPreviewProblem = { kind: "expired" } | { kind: "failed"; refusal: CodedError } | { kind: "unavailable"; refusal: CodedError };

export function finishedPreviewProblem(error: Error | null): FinishedPreviewProblem | null {
  if (!error) return null;
  if (!(error instanceof LeadActionPreviewError)) return { kind: "unavailable", refusal: { message: error.message } };
  if (error.countFailed) return { kind: "failed", refusal: error.refusal };
  if (error.refusal.code === LEAD_ACTION_PREVIEW_NOT_FOUND) return { kind: "expired" };
  return { kind: "unavailable", refusal: error.refusal };
}

export function useFinishedLeadActionPreview(previewId: string | null, live: boolean) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const query = useQuery<LeadActionPreview, Error>({
    queryKey: ["lead-action-preview-finished", workspaceId, previewId ?? ""] as const,
    queryFn: ({ signal }) => finishedLeadActionPreview(previewId as string, signal),
    enabled: live && previewId !== null && previewId !== "" && workspaceId !== "",
    staleTime: Infinity,
    gcTime: SECTION_GC_MS,
    retry: shouldRetrySection,
    retryDelay: sectionRetryDelay,
    refetchOnWindowFocus: false,
  });
  return { preview: query.data ?? null, problem: finishedPreviewProblem(query.error), counting: query.isFetching, refetch: query.refetch };
}

function leadActionPreviewKey(workspaceId: string, request: LeadActionRequest | null) {
  return ["lead-action-preview", workspaceId, request ? JSON.stringify(request) : ""] as const;
}

export function useLeadActionPreview(request: LeadActionRequest | null) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const debounced = useDebouncedValue(request ? JSON.stringify(request) : "", DEBOUNCE_MS);
  const settledRequest = request && debounced === JSON.stringify(request) ? request : null;
  const queryKey = leadActionPreviewKey(workspaceId, settledRequest);
  const progressKey = JSON.stringify(queryKey);
  const [running, setRunning] = useState<{ key: string; progress: LeadActionPreviewProgress | null }>({ key: "", progress: null });
  const query = useQuery<LeadActionPreview, Error>({
    queryKey,
    queryFn: ({ signal }) => {
      setRunning({ key: progressKey, progress: null });
      return settledPreview(settledRequest as LeadActionRequest, signal, (current) => {
        if (!signal.aborted) setRunning({ key: progressKey, progress: leadActionPreviewProgress(current) });
      });
    },
    enabled: settledRequest !== null && workspaceId !== "",
    staleTime: 0,
    gcTime: 60_000,
    retry: shouldRetrySection,
    retryDelay: sectionRetryDelay,
    refetchOnWindowFocus: false,
  });
  const refusal = refusalOf(query.error);
  const loading = request !== null && (settledRequest === null || query.isFetching);
  return {
    preview: settledRequest ? (query.data ?? null) : null,
    refusal: settledRequest ? refusal : null,
    loading,
    progress: loading && settledRequest !== null && running.key === progressKey ? running.progress : null,
    refetch: query.refetch,
  };
}
