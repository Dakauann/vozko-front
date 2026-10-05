"use client";

import { fetchMemberActivity } from "@/app/actions/attendance";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionQuery } from "@/hooks/use-section-query";
import {
  memberActivityKey,
  type MemberActivityReport,
  type MemberActivitySubject,
} from "@/lib/attendance/member-activity";
import type { PeriodRange } from "@/lib/attendance/period";
import { browserTimezone } from "@/lib/working-hours/types";

export function useMemberActivity(subject: MemberActivitySubject | null, period: PeriodRange) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const asked: MemberActivitySubject = subject ?? { mode: "self" };

  return useSectionQuery<MemberActivityReport>({
    queryKey: memberActivityKey(workspaceId, asked, period),
    queryFn: (signal) => fetchMemberActivity(asked, period, browserTimezone(), signal),
    enabled: subject !== null && workspaceId !== "",
  });
}
