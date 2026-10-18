"use client";

import { useCallback, useEffect } from "react";
import { useQueryClient, type InfiniteData, type QueryClient, type QueryKey } from "@tanstack/react-query";

import { isActionError, type ActionError, type ActionResult } from "@/app/actions/action-result";
import {
  getNotificationPreferencesAction,
  getNotificationSummaryAction,
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationsReadAction,
  markNotificationsUnreadAction,
  saveNotificationPreferencesAction,
} from "@/app/actions/notifications";
import {
  listBroadcastRecipientsAction,
  listNotificationBroadcastsAction,
  previewNotificationBroadcastAction,
} from "@/app/actions/admin-notifications";
import { useWorkspace } from "@/contexts/workspace-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSectionPagesQuery, useSectionQuery } from "@/hooks/use-section-query";
import { SectionError } from "@/lib/analytics/section-query";
import { subscribeNotificationCreated } from "@/lib/notifications/bus";
import {
  isUnread,
  matchesFilter,
  pagesAfterAllRead,
  pagesAfterArrival,
  pagesAfterReadChange,
  summaryAfterAllRead,
  summaryAfterArrival,
  summaryAfterReadChange,
  type NotificationCategoryFilter,
  type NotificationFilter,
  type ReadChange,
} from "@/lib/notifications/inbox";
import {
  broadcastReachKey,
  type Broadcast,
  type BroadcastPage,
  type BroadcastReach,
  type BroadcastRecipientPage,
  type BroadcastRecipientStatus,
  type BroadcastRequest,
} from "@/lib/notifications/broadcast";
import type {
  NotificationCategory,
  NotificationItem,
  NotificationPage,
  NotificationPreferenceChoice,
  NotificationPreferences,
  NotificationSummary,
} from "@/lib/notifications/types";

const NOTIFICATION_PAGE_SIZE = 20;

const NOTIFICATION_SUMMARY_REFRESH_MS = 60_000;

const BROADCAST_PAGE_SIZE = 20;

const BROADCAST_RECIPIENT_PAGE_SIZE = 30;

const BROADCAST_REACH_SETTLE_MS = 400;

const broadcastKeys = {
  list: () => ["notification-broadcasts"] as const,
  reach: (reachKey: string) => ["notification-broadcast-reach", reachKey] as const,
  recipients: (broadcastId: string, status: BroadcastRecipientStatus) => ["notification-broadcast-recipients", broadcastId, status] as const,
};

export const notificationKeys = {
  all: (workspaceId: string) => ["notifications", workspaceId] as const,
  summary: (workspaceId: string) => ["notifications", workspaceId, "summary"] as const,
  lists: (workspaceId: string) => ["notifications", workspaceId, "list"] as const,
  list: (workspaceId: string, filter: NotificationFilter) => ["notifications", workspaceId, "list", filter.category, filter.unreadOnly] as const,
  preferences: (workspaceId: string) => ["notifications", workspaceId, "preferences"] as const,
};

type NotificationPages = InfiniteData<NotificationPage, string>;

function useWorkspaceId(): string {
  return useWorkspace().currentWorkspace?.id ?? "";
}

async function sectionData<T>(result: Promise<ActionResult<T>>): Promise<T> {
  const settled = await result;
  if (isActionError(settled)) throw new SectionError(settled.error, settled.status, settled.code);
  return settled.data;
}

function filterOfKey(key: QueryKey): NotificationFilter {
  return { category: key[3] as NotificationCategoryFilter, unreadOnly: key[4] === true };
}

function updateLists(client: QueryClient, workspaceId: string, change: (pages: NotificationPage[], filter: NotificationFilter) => NotificationPage[]) {
  for (const [key, data] of client.getQueriesData<NotificationPages>({ queryKey: notificationKeys.lists(workspaceId) })) {
    if (!data) continue;
    const pages = change(data.pages, filterOfKey(key));
    if (pages !== data.pages) client.setQueryData<NotificationPages>(key, { ...data, pages });
  }
}

function updateSummary(client: QueryClient, workspaceId: string, change: (summary: NotificationSummary) => NotificationSummary) {
  client.setQueryData<NotificationSummary>(notificationKeys.summary(workspaceId), (summary) => (summary ? change(summary) : summary));
}

export function useNotificationSummary() {
  const workspaceId = useWorkspaceId();
  return useSectionQuery<NotificationSummary>({
    queryKey: notificationKeys.summary(workspaceId),
    queryFn: (signal) => sectionData(getNotificationSummaryAction(signal)),
    enabled: workspaceId !== "",
    refetchInterval: NOTIFICATION_SUMMARY_REFRESH_MS,
  });
}

export function useNotificationList(filter: NotificationFilter, enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useSectionPagesQuery<NotificationPage>({
    queryKey: notificationKeys.list(workspaceId, filter),
    queryFn: (cursor, signal) =>
      sectionData(
        listNotificationsAction(
          {
            category: filter.category === "all" ? undefined : filter.category,
            unread: filter.unreadOnly,
            cursor: cursor || undefined,
            limit: NOTIFICATION_PAGE_SIZE,
          },
          signal,
        ),
      ),
    nextCursor: (page) => page.next,
    enabled: enabled && workspaceId !== "",
  });
}

export function useNotificationPreferences(enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useSectionQuery<NotificationPreferences>({
    queryKey: notificationKeys.preferences(workspaceId),
    queryFn: (signal) => sectionData(getNotificationPreferencesAction(signal)),
    enabled: enabled && workspaceId !== "",
  });
}

export function useNotificationRealtime() {
  const workspaceId = useWorkspaceId();
  const client = useQueryClient();

  useEffect(() => {
    if (workspaceId === "") return;
    return subscribeNotificationCreated((event) => {
      if (event.workspaceId !== workspaceId) return;
      updateLists(client, workspaceId, (pages, filter) => (matchesFilter(event.item, filter) ? pagesAfterArrival(pages, event.item) : pages));
      updateSummary(client, workspaceId, (summary) => summaryAfterArrival(summary, event.item));
    });
  }, [client, workspaceId]);
}

export function useNotificationActions() {
  const workspaceId = useWorkspaceId();
  const client = useQueryClient();

  const settle = useCallback(
    async (request: Promise<ActionResult<unknown>>): Promise<ActionError | null> => {
      const result = await request;
      if (!isActionError(result)) return null;
      void client.invalidateQueries({ queryKey: notificationKeys.all(workspaceId) });
      return result;
    },
    [client, workspaceId],
  );

  const changeRead = useCallback(
    async (items: NotificationItem[], change: ReadChange): Promise<ActionError | null> => {
      const affected = items.filter((item) => isUnread(item) === (change === "read"));
      if (affected.length === 0) return null;
      const ids = affected.map((item) => item.id);
      const readAt = change === "read" ? new Date().toISOString() : null;
      updateLists(client, workspaceId, (pages) => pagesAfterReadChange(pages, new Set(ids), readAt));
      updateSummary(client, workspaceId, (summary) => summaryAfterReadChange(summary, affected, change));
      return settle(change === "read" ? markNotificationsReadAction(ids) : markNotificationsUnreadAction(ids));
    },
    [client, settle, workspaceId],
  );

  const markRead = useCallback((items: NotificationItem[]) => changeRead(items, "read"), [changeRead]);

  const markUnread = useCallback((items: NotificationItem[]) => changeRead(items, "unread"), [changeRead]);

  const markAllRead = useCallback(
    (category: NotificationCategory | null) => {
      const readAt = new Date().toISOString();
      updateLists(client, workspaceId, (pages) => pagesAfterAllRead(pages, category, readAt));
      updateSummary(client, workspaceId, (summary) => summaryAfterAllRead(summary, category));
      return settle(markAllNotificationsReadAction(category));
    },
    [client, settle, workspaceId],
  );

  const savePreferences = useCallback(
    async (choice: NotificationPreferenceChoice): Promise<ActionError | null> => {
      const key = notificationKeys.preferences(workspaceId);
      const before = client.getQueryData<NotificationPreferences>(key);
      if (before) client.setQueryData<NotificationPreferences>(key, { ...before, ...choice });
      const result = await saveNotificationPreferencesAction(choice);
      if (isActionError(result)) {
        client.setQueryData(key, before);
        return result;
      }
      client.setQueryData(key, result.data);
      return null;
    },
    [client, workspaceId],
  );

  return { markRead, markUnread, markAllRead, savePreferences };
}

export function useNotificationBroadcasts() {
  return useSectionPagesQuery<BroadcastPage>({
    queryKey: broadcastKeys.list(),
    queryFn: (cursor, signal) => sectionData(listNotificationBroadcastsAction({ cursor: cursor || undefined, limit: BROADCAST_PAGE_SIZE }, signal)),
    nextCursor: (page) => page.next,
    enabled: true,
  });
}

export function useBroadcastArrival() {
  const client = useQueryClient();
  return useCallback(
    (broadcast: Broadcast) =>
      client.setQueryData<InfiniteData<BroadcastPage, string>>(broadcastKeys.list(), (data) =>
        data ? { ...data, pages: pagesAfterArrival(data.pages, broadcast) } : data,
      ),
    [client],
  );
}

export function useBroadcastReach(request: BroadcastRequest | null) {
  const reachKey = request ? broadcastReachKey(request) : null;
  const settledKey = useDebouncedValue(reachKey, BROADCAST_REACH_SETTLE_MS);
  const settled = reachKey !== null && settledKey === reachKey;
  const query = useSectionQuery<BroadcastReach>({
    queryKey: broadcastKeys.reach(settledKey ?? ""),
    queryFn: (signal) => sectionData(previewNotificationBroadcastAction(request as BroadcastRequest, signal)),
    enabled: settled,
  });
  return { query, settling: reachKey !== null && !settled };
}

export function useBroadcastRecipients(broadcastId: string | null, status: BroadcastRecipientStatus) {
  return useSectionPagesQuery<BroadcastRecipientPage>({
    queryKey: broadcastKeys.recipients(broadcastId ?? "", status),
    queryFn: (cursor, signal) =>
      sectionData(listBroadcastRecipientsAction(broadcastId ?? "", { status, cursor: cursor || undefined, limit: BROADCAST_RECIPIENT_PAGE_SIZE }, signal)),
    nextCursor: (page) => page.next,
    enabled: broadcastId !== null,
  });
}
