"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useOptionalCrm } from "@/contexts/crm-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { forgetLeadQueries, refreshLeadQueries } from "@/hooks/use-lead-records";
import { isNewerVersion } from "@/lib/leads/version";

export const LEAD_ANONYMIZED_FIELD = "anonymized";

export function useLeadChangeRefetch(leadId: string, { version, onAnonymized }: { version: number | undefined; onAnonymized: () => void }) {
  const crm = useOptionalCrm();
  const subscribe = crm?.subscribeLeadUpdates;
  const live = crm?.status === "connected";
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const client = useQueryClient();
  const versionRef = useRef(version);
  const anonymizedRef = useRef(onAnonymized);

  useEffect(() => {
    versionRef.current = version;
    anonymizedRef.current = onAnonymized;
  }, [version, onAnonymized]);

  useEffect(() => {
    if (!subscribe || !leadId) return;
    return subscribe((event) => {
      if (event.leadId !== leadId) return;
      if (event.fields.includes(LEAD_ANONYMIZED_FIELD)) {
        forgetLeadQueries(client, workspaceId, leadId);
        anonymizedRef.current();
        return;
      }
      if (!isNewerVersion(event.version, versionRef.current)) return;
      refreshLeadQueries(client, workspaceId, leadId);
    });
  }, [subscribe, leadId, client, workspaceId]);

  useEffect(() => {
    if (live || !leadId) return;
    const refresh = () => refreshLeadQueries(client, workspaceId, leadId);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [live, leadId, client, workspaceId]);
}
