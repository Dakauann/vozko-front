"use client";

import { useQuery } from "@tanstack/react-query";

import { getEmailLogEntryAction, listEmailLogAction, listEmailWebhookDeliveriesAction, listEmailWebhooksAction } from "@/app/actions/email-api";
import { EMAIL_QUERY_OPTIONS, emailQueryKey, unwrapEmailResult, useEmailWorkspaceId } from "@/hooks/use-email-marketing";
import { useSectionPagesQuery } from "@/hooks/use-section-query";
import type { EmailLogFilters } from "@/lib/email-api/types";

export const EMAIL_API_LIVE_MS = 30_000;

export function useEmailLog(filters: EmailLogFilters, enabled = true) {
  const workspaceId = useEmailWorkspaceId();
  return useSectionPagesQuery({
    queryKey: emailQueryKey(workspaceId, "api-log", filters.status, filters.recipient.trim(), filters.tagName.trim(), filters.tagValue.trim()),
    queryFn: async (cursor, signal) => unwrapEmailResult(await listEmailLogAction(filters, cursor, signal)),
    nextCursor: (page) => page.next_cursor,
    enabled: enabled && workspaceId !== "",
  });
}

export function useEmailLogEntry(messageId: string) {
  const workspaceId = useEmailWorkspaceId();
  return useQuery({
    ...EMAIL_QUERY_OPTIONS,
    queryKey: emailQueryKey(workspaceId, "api-log-entry", messageId),
    queryFn: async ({ signal }) => unwrapEmailResult(await getEmailLogEntryAction(messageId, signal)),
    enabled: workspaceId !== "" && messageId !== "",
    staleTime: 10_000,
    refetchInterval: EMAIL_API_LIVE_MS,
  });
}

export function useEmailWebhooks() {
  const workspaceId = useEmailWorkspaceId();
  return useQuery({
    ...EMAIL_QUERY_OPTIONS,
    queryKey: emailQueryKey(workspaceId, "webhooks"),
    queryFn: async ({ signal }) => unwrapEmailResult(await listEmailWebhooksAction(signal)),
    enabled: workspaceId !== "",
    staleTime: 15_000,
    refetchInterval: EMAIL_API_LIVE_MS,
  });
}

export function useEmailWebhookDeliveries(endpointId: string, enabled: boolean) {
  const workspaceId = useEmailWorkspaceId();
  return useSectionPagesQuery({
    queryKey: emailQueryKey(workspaceId, "webhook-deliveries", endpointId),
    queryFn: async (cursor, signal) => unwrapEmailResult(await listEmailWebhookDeliveriesAction(endpointId, cursor, signal)),
    nextCursor: (page) => page.next_cursor,
    enabled: enabled && workspaceId !== "" && endpointId !== "",
  });
}
