"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { getLeadImportAction, listLeadImportsAction } from "@/app/actions/lead-imports";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { LeadImportTracker, type TrackedLeadImport } from "@/lib/leads/import-tracker";
import type { LeadImportLimits, LeadImportSummary } from "@/lib/leads/imports";

const SESSION_SCOPE = "session";

const NOTHING_TRACKED: readonly TrackedLeadImport[] = [];

const trackers = new Map<string, LeadImportTracker>();

export function leadImportTrackerFor(workspaceId: string | undefined, userId: string | undefined): LeadImportTracker {
  const scope = workspaceId && userId ? `${workspaceId}:${userId}` : SESSION_SCOPE;
  let tracker = trackers.get(scope);
  if (!tracker) {
    tracker = new LeadImportTracker({
      fetchJob: getLeadImportAction,
      fetchList: scope === SESSION_SCOPE ? null : listLeadImportsAction,
    });
    trackers.set(scope, tracker);
  }
  return tracker;
}

export function useLeadImportTracker(): LeadImportTracker {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  return leadImportTrackerFor(currentWorkspace?.id, user?.id);
}

export function useTrackedImports(tracker: LeadImportTracker): readonly TrackedLeadImport[] {
  return useSyncExternalStore(tracker.subscribe, tracker.getSnapshot, () => NOTHING_TRACKED);
}

export function useTrackedImport(tracker: LeadImportTracker, id: string | null): TrackedLeadImport | null {
  const tracked = useTrackedImports(tracker);
  const entry = id ? (tracked.find((current) => current.id === id) ?? null) : null;
  const missingDetail = Boolean(entry && entry.job === null);
  useEffect(() => {
    if (id && missingDetail) tracker.load(id);
  }, [tracker, id, missingDetail]);
  return entry;
}

export function useLeadImportLimits(tracker: LeadImportTracker): LeadImportLimits | null {
  return useSyncExternalStore(tracker.subscribe, tracker.getLimits, () => null);
}

export function useLeadImportSettled(tracker: LeadImportTracker, onSettled: (job: LeadImportSummary) => void): void {
  const latest = useRef(onSettled);
  useEffect(() => {
    latest.current = onSettled;
  }, [onSettled]);
  useEffect(() => tracker.onSettled((job) => latest.current(job)), [tracker]);
}
