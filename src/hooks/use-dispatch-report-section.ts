"use client";

import { fetchDispatchReportSection } from "@/app/actions/dispatch-report";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionQuery } from "@/hooks/use-section-query";
import {
  dispatchReportSectionKey,
  type DispatchReportParams,
  type DispatchReportPayloads,
  type DispatchReportSection,
} from "@/lib/whatsapp-campaigns/dispatch-report";

export function useDispatchReportSection<S extends DispatchReportSection>(
  section: S,
  params: DispatchReportParams,
  options: { enabled: boolean },
) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";

  return useSectionQuery<DispatchReportPayloads[S]>({
    queryKey: dispatchReportSectionKey(workspaceId, section, params),
    queryFn: (signal) => fetchDispatchReportSection(section, params, signal),
    enabled: options.enabled && workspaceId !== "",
  });
}
