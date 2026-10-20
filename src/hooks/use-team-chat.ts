"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError, type ActionResult } from "@/app/actions/action-result";
import {
  getTeamChatSummaryAction,
  getTeamChatThreadAction,
  listTeamChatPeopleAction,
  listTeamChatThreadsAction,
} from "@/app/actions/team-chat";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionQuery } from "@/hooks/use-section-query";
import { SectionError } from "@/lib/analytics/section-query";
import { signalAttention } from "@/lib/attention/signal";
import { subscribeTeamChat, subscribeTeamChatConnection } from "@/lib/team-chat/bus";
import { openTeamChat, showTeamChatList, teamChatPanel } from "@/lib/team-chat/panel";
import { threadsAfterMessage, threadsAfterMessageChange, threadsAfterRead, upsertThread, withoutThread } from "@/lib/team-chat/threads";
import type { TeamChatMessage, TeamChatPerson, TeamChatSummary, TeamChatThread, TeamChatThreadPage } from "@/lib/team-chat/types";

const SUMMARY_REFRESH_MS = 60_000;

const SUMMARY_SETTLE_MS = 1_500;

const THREAD_PAGE = 30;

const PEOPLE_STALE_MS = 60_000;

export const teamChatKeys = {
  all: (workspaceId: string) => ["team-chat", workspaceId] as const,
  summary: (workspaceId: string) => ["team-chat", workspaceId, "summary"] as const,
  threads: (workspaceId: string) => ["team-chat", workspaceId, "threads"] as const,
  thread: (workspaceId: string, threadId: string) => ["team-chat", workspaceId, "thread", threadId] as const,
  people: (workspaceId: string) => ["team-chat", workspaceId, "people"] as const,
  scheduled: (workspaceId: string, threadId: string) => ["team-chat", workspaceId, "scheduled", threadId] as const,
};

export function useTeamChatWorkspace(): string {
  return useWorkspace().currentWorkspace?.id ?? "";
}

export function useTeamChatMe(): string {
  return useAuth().user?.id ?? "";
}

export function useTeamChatAccess() {
  const { can, currentWorkspace } = useWorkspace();
  const member = Boolean(currentWorkspace?.id);
  return { read: member, send: member, create: member && can("team_chat", "create") };
}

export async function sectionData<T>(result: Promise<ActionResult<T>>): Promise<T> {
  const settled = await result;
  if (isActionError(settled)) throw new SectionError(settled.error, settled.status, settled.code);
  return settled.data;
}

export function useTeamChatSummary(enabled: boolean) {
  const workspaceId = useTeamChatWorkspace();
  return useSectionQuery<TeamChatSummary>({
    queryKey: teamChatKeys.summary(workspaceId),
    queryFn: (signal) => sectionData(getTeamChatSummaryAction(signal)),
    enabled: enabled && workspaceId !== "",
    refetchInterval: SUMMARY_REFRESH_MS,
  });
}

function editThreads(client: QueryClient, workspaceId: string, change: (threads: TeamChatThread[]) => TeamChatThread[]) {
  client.setQueryData<TeamChatThreadPage>(teamChatKeys.threads(workspaceId), (page) => {
    if (!page) return page;
    const threads = change(page.threads);
    return threads === page.threads ? page : { ...page, threads };
  });
}

export function rememberThread(client: QueryClient, workspaceId: string, thread: TeamChatThread) {
  client.setQueryData(teamChatKeys.thread(workspaceId, thread.id), thread);
  editThreads(client, workspaceId, (threads) => upsertThread(threads, thread));
}

export function useTeamChatThreads(enabled: boolean) {
  const workspaceId = useTeamChatWorkspace();
  const client = useQueryClient();
  const [loadingMore, setLoadingMore] = useState(false);
  const query = useSectionQuery<TeamChatThreadPage>({
    queryKey: teamChatKeys.threads(workspaceId),
    queryFn: (signal) => sectionData(listTeamChatThreadsAction("", THREAD_PAGE, signal)),
    enabled: enabled && workspaceId !== "",
  });
  const next = query.data?.next ?? "";

  const loadMore = useCallback(async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    const result = await listTeamChatThreadsAction(next, THREAD_PAGE);
    setLoadingMore(false);
    if (isActionError(result)) return;
    client.setQueryData<TeamChatThreadPage>(teamChatKeys.threads(workspaceId), (page) => ({
      threads: result.data.threads.reduce(upsertThread, page?.threads ?? []),
      next: result.data.next,
    }));
  }, [client, loadingMore, next, workspaceId]);

  return { ...query, threads: query.data?.threads ?? [], hasMore: next !== "", loadMore, loadingMore };
}

export function useTeamChatThread(threadId: string | null) {
  const workspaceId = useTeamChatWorkspace();
  return useSectionQuery<TeamChatThread>({
    queryKey: teamChatKeys.thread(workspaceId, threadId ?? ""),
    queryFn: (signal) => sectionData(getTeamChatThreadAction(threadId ?? "", signal)),
    enabled: Boolean(threadId) && workspaceId !== "",
  });
}

export function useTeamChatPeople(enabled: boolean) {
  const workspaceId = useTeamChatWorkspace();
  return useQuery<TeamChatPerson[]>({
    queryKey: teamChatKeys.people(workspaceId),
    queryFn: ({ signal }) => sectionData(listTeamChatPeopleAction(signal)),
    enabled: enabled && workspaceId !== "",
    staleTime: PEOPLE_STALE_MS,
  });
}

export function useTeamChatRealtime(enabled: boolean) {
  const workspaceId = useTeamChatWorkspace();
  const me = useTeamChatMe();
  const client = useQueryClient();
  const t = useTranslations("teamChat.attention");
  const ts = useTranslations("teamChat.scheduled");

  useEffect(() => {
    if (!enabled || workspaceId === "" || me === "") return;
    let summaryTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshSummary = () => {
      clearTimeout(summaryTimer);
      summaryTimer = setTimeout(() => void client.invalidateQueries({ queryKey: teamChatKeys.summary(workspaceId) }), SUMMARY_SETTLE_MS);
    };

    const forget = (threadId: string) => {
      editThreads(client, workspaceId, (threads) => withoutThread(threads, threadId));
      client.removeQueries({ queryKey: teamChatKeys.thread(workspaceId, threadId) });
      if (teamChatPanel().threadId === threadId) showTeamChatList();
    };

    const refetchThread = async (threadId: string) => {
      const result = await getTeamChatThreadAction(threadId);
      if (!isActionError(result)) rememberThread(client, workspaceId, result.data);
      else if (result.status === 404) forget(threadId);
    };

    const alert = (message: TeamChatMessage) => {
      if (message.kind !== "text" || message.author_id === me || message.deleted_at) return;
      const thread = client.getQueryData<TeamChatThreadPage>(teamChatKeys.threads(workspaceId))?.threads.find((x) => x.id === message.thread_id);
      const mentioned = message.mentions.includes(me);
      signalAttention({
        id: `team:${message.id}`,
        source: "team_message",
        group: message.thread_id,
        title: thread?.kind === "group" ? t("inGroup", { name: message.author_name, group: thread.title }) : message.author_name,
        body: mentioned ? t("mentioned", { body: message.body }) : message.body,
        quiet: Boolean(thread?.me.muted) && !mentioned,
        open: () => openTeamChat(message.thread_id),
      });
    };

    const leaveEvents = subscribeTeamChat((event) => {
      switch (event.type) {
        case "team_chat:message": {
          const { message } = event.payload;
          let known = true;
          editThreads(client, workspaceId, (threads) => {
            const next = threadsAfterMessage(threads, message, me);
            if (next === null) known = false;
            return next ?? threads;
          });
          client.setQueryData<TeamChatThread>(teamChatKeys.thread(workspaceId, message.thread_id), (thread) =>
            thread ? threadsAfterMessage([thread], message, me)?.[0] ?? thread : thread,
          );
          if (!known) void refetchThread(message.thread_id);
          refreshSummary();
          alert(message);
          break;
        }
        case "team_chat:message_updated":
          editThreads(client, workspaceId, (threads) => threadsAfterMessageChange(threads, event.payload.message));
          break;
        case "team_chat:read":
          editThreads(client, workspaceId, (threads) => threadsAfterRead(threads, event.payload, me));
          client.setQueryData<TeamChatThread>(teamChatKeys.thread(workspaceId, event.payload.thread_id), (thread) =>
            thread ? threadsAfterRead([thread], event.payload, me)[0] : thread,
          );
          if (event.payload.user_id === me) refreshSummary();
          break;
        case "team_chat:thread":
          void refetchThread(event.payload.thread_id);
          refreshSummary();
          break;
        case "team_chat:thread_removed":
          forget(event.payload.thread_id);
          refreshSummary();
          break;
        case "team_chat:scheduled": {
          const { scheduled } = event.payload;
          if (scheduled.status === "failed") {
            const reason = `failedReason.${scheduled.failure_reason ?? ""}`;
            toast.error(ts.has(reason) ? ts(reason) : ts("failedReason.unknown"));
          }
          break;
        }
      }
    });

    const leaveConnection = subscribeTeamChatConnection((connected) => {
      if (connected) void client.invalidateQueries({ queryKey: teamChatKeys.all(workspaceId) });
    });

    return () => {
      clearTimeout(summaryTimer);
      leaveEvents();
      leaveConnection();
    };
  }, [client, enabled, me, t, ts, workspaceId]);
}
