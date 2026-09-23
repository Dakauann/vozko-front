"use client";

import { useCallback, useEffect, useState } from "react";

import type { OutcomeCaptureSpec } from "@/lib/workspace/workspace-config/types";

import { getWorkspaceConfigAction } from "@/app/actions/workspace-config";

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
  const [capture, setCapture] = useState<OutcomeCaptureSpec | null>(null);
  const [loadedWorkspace, setLoadedWorkspace] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const result = await getWorkspaceConfigAction(id);
    return result.config?.outcomeCapture ?? null;
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void load(workspaceId).then((policy) => {
      if (cancelled) return;
      setCapture(policy);
      setLoadedWorkspace(workspaceId);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, load]);

  return { capture, loaded: loadedWorkspace === workspaceId };
}
