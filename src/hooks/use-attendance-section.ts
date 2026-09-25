"use client";

import { fetchAttendanceSection } from "@/app/actions/attendance";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionQuery } from "@/hooks/use-section-query";
import {
  attendanceSectionKey,
  type AttendanceSection,
  type AttendanceSectionPayloads,
} from "@/lib/attendance/sections";
import type { AttendanceOverviewParams } from "@/lib/attendance/types";

export function useAttendanceSection<S extends AttendanceSection>(
  section: S,
  params: AttendanceOverviewParams,
  options: { enabled: boolean; refetchInterval?: number },
) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";

  return useSectionQuery<AttendanceSectionPayloads[S]>({
    queryKey: attendanceSectionKey(workspaceId, section, params),
    queryFn: (signal) => fetchAttendanceSection(section, params, signal),
    enabled: options.enabled && workspaceId !== "",
    refetchInterval: options.refetchInterval,
  });
}
