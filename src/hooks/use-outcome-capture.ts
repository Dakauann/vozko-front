"use client";

import type { OutcomeCaptureSpec } from "@/lib/workspace/workspace-config/types";

import { useWorkspaceConfig } from "@/hooks/use-workspace-config";

export interface OutcomeCaptureState {
  capture: OutcomeCaptureSpec | null;
  loaded: boolean;
}

export function outcomeCaptureApplies(
  capture: OutcomeCaptureSpec | null,
  departmentId?: string | null,
): boolean {
  if (!capture?.enabled) return false;
  const scoped = capture.departmentIds ?? [];
  if (scoped.length === 0) return true;
  if (!departmentId) return false;
  return scoped.includes(departmentId);
}

export function outcomeIsRequired(
  capture: OutcomeCaptureSpec | null,
  departmentId?: string | null,
): boolean {
  return (
    outcomeCaptureApplies(capture, departmentId) &&
    Boolean(capture?.requireOnFinish) &&
    (capture?.outcomes?.length ?? 0) > 0
  );
}

export function useOutcomeCapture(workspaceId: string | undefined): OutcomeCaptureState {
  const { config, loaded } = useWorkspaceConfig(workspaceId);
  return { capture: config?.outcomeCapture ?? null, loaded };
}
