"use client";

import { useEffect, useState } from "react";

import type { WorkspaceConfig } from "@/lib/workspace/workspace-config/types";

import { getWorkspaceConfigAction } from "@/app/actions/workspace-config";

export interface WorkspaceConfigState {
  config: WorkspaceConfig | null;
  loaded: boolean;
}

export function useWorkspaceConfig(workspaceId: string | undefined | null): WorkspaceConfigState {
  const [config, setConfig] = useState<WorkspaceConfig | null>(null);
  const [loadedWorkspace, setLoadedWorkspace] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void getWorkspaceConfigAction(workspaceId).then((result) => {
      if (cancelled) return;
      setConfig(result.config);
      setLoadedWorkspace(workspaceId);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return { config, loaded: Boolean(workspaceId) && loadedWorkspace === workspaceId };
}
