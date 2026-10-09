"use client";

import { fetchLeadSection } from "@/app/actions/leads";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionQuery } from "@/hooks/use-section-query";
import {
  isSameLeadSection,
  leadSectionKey,
  type LeadSection,
  type LeadSectionParams,
  type LeadSectionPayloads,
} from "@/lib/leads/sections";

export function useLeadSection<S extends LeadSection>(
  section: S,
  params: LeadSectionParams,
  options: { enabled: boolean },
) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";

  const queryKey = leadSectionKey(workspaceId, section, params);
  return useSectionQuery<LeadSectionPayloads[S]>({
    queryKey,
    queryFn: (signal) => fetchLeadSection(section, params, signal),
    enabled: options.enabled && workspaceId !== "",
    keepPreviousWhen: (previousKey) => isSameLeadSection(previousKey, queryKey),
  });
}
