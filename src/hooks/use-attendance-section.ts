"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchAttendanceSection } from "@/app/actions/attendance";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  attendanceSectionKey,
  sectionRetryDelay,
  shouldRetrySection,
  type AttendanceSection,
} from "@/lib/attendance/sections";
import type { AttendanceOverviewParams } from "@/lib/attendance/types";

const SECTION_STALE_MS = 60_000;
const SECTION_GC_MS = 5 * 60_000;

export function useAttendanceSection<S extends AttendanceSection>(
  section: S,
  params: AttendanceOverviewParams,
  options: { enabled: boolean },
) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";

  return useQuery({
    queryKey: attendanceSectionKey(workspaceId, section, params),
    queryFn: ({ signal }) => fetchAttendanceSection(section, params, signal),
    enabled: options.enabled && workspaceId !== "",
    staleTime: SECTION_STALE_MS,
    gcTime: SECTION_GC_MS,
    refetchOnWindowFocus: false,
    retry: shouldRetrySection,
    retryDelay: sectionRetryDelay,
  });
}
