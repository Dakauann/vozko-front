"use client";

import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { isActionError, type ActionError } from "@/app/actions/action-result";
import {
  cancelScheduledTeamMessageAction,
  listScheduledTeamMessagesAction,
  rescheduleTeamMessageAction,
  scheduleTeamMessageAction,
} from "@/app/actions/team-chat";
import { subscribeTeamChat } from "@/lib/team-chat/bus";
import type { TeamChatScheduled } from "@/lib/team-chat/types";

import { sectionData, teamChatKeys, useTeamChatWorkspace } from "./use-team-chat";

function withScheduled(list: TeamChatScheduled[], scheduled: TeamChatScheduled): TeamChatScheduled[] {
  const rest = list.filter((s) => s.id !== scheduled.id);
  if (scheduled.status !== "pending") return rest;
  return [...rest, scheduled].sort((a, b) => a.send_at.localeCompare(b.send_at));
}

export function useTeamChatScheduled(threadId: string | null, enabled: boolean) {
  const workspaceId = useTeamChatWorkspace();
  const client = useQueryClient();
  const key = teamChatKeys.scheduled(workspaceId, threadId ?? "");
  const query = useQuery<TeamChatScheduled[]>({
    queryKey: key,
    queryFn: ({ signal }) => sectionData(listScheduledTeamMessagesAction(threadId ?? "", signal)),
    enabled: enabled && Boolean(threadId) && workspaceId !== "",
  });

  const remember = useCallback(
    (scheduled: TeamChatScheduled) => client.setQueryData<TeamChatScheduled[]>(key, (list) => withScheduled(list ?? [], scheduled)),
    [client, key],
  );

  useEffect(
    () =>
      subscribeTeamChat((event) => {
        if (event.type === "team_chat:scheduled" && event.payload.thread_id === threadId) remember(event.payload.scheduled);
      }),
    [remember, threadId],
  );

  const schedule = useCallback(
    async (draft: { body: string; mentions: string[]; reply_to_id?: string; send_at: string }): Promise<ActionError | null> => {
      if (!threadId) return null;
      const result = await scheduleTeamMessageAction(threadId, draft);
      if (isActionError(result)) return result;
      remember(result.data);
      return null;
    },
    [remember, threadId],
  );

  const reschedule = useCallback(
    async (scheduledId: string, change: { body?: string; send_at?: string }): Promise<ActionError | null> => {
      const result = await rescheduleTeamMessageAction(scheduledId, change);
      if (isActionError(result)) return result;
      remember(result.data);
      return null;
    },
    [remember],
  );

  const cancel = useCallback(
    async (scheduled: TeamChatScheduled): Promise<ActionError | null> => {
      const result = await cancelScheduledTeamMessageAction(scheduled.id);
      if (isActionError(result)) return result;
      remember({ ...scheduled, status: "canceled" });
      return null;
    },
    [remember],
  );

  return { scheduled: query.data ?? [], loading: query.isLoading, schedule, reschedule, cancel };
}
