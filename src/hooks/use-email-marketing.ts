"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { isActionError, type ActionResult } from "@/app/actions/action-result";
import {
  checkEmailSubdomainAction,
  getEmailAddressStatusAction,
  getEmailOverviewAction,
  getEmailPricingAction,
  getEmailSetupAction,
  listEmailSuppressionsAction,
} from "@/app/actions/email-marketing";
import { useWorkspace } from "@/contexts/workspace-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SectionError, sectionRetryDelay, shouldRetrySection } from "@/lib/analytics/section-query";
import { setupPollDelay } from "@/lib/email-marketing/setup-progress";
import type { EmailOverviewDays, EmailSetup } from "@/lib/email-marketing/types";

export const EMAIL_LIVE_MS = 60_000;

export const EMAIL_QUERY_OPTIONS = {
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  retry: shouldRetrySection,
  retryDelay: sectionRetryDelay,
} as const;

export function unwrapEmailResult<T>(result: ActionResult<T>): T {
  if (isActionError(result)) throw new SectionError(result.error, result.status, result.code);
  return result.data;
}

export function useEmailWorkspaceId(): string {
  const { currentWorkspace } = useWorkspace();
  return currentWorkspace?.id ?? "";
}

export function emailQueryKey(workspaceId: string, ...parts: (string | number)[]) {
  return ["email-marketing", workspaceId, ...parts] as const;
}

export function useEmailSetup({ enabled = true, live = true }: { enabled?: boolean; live?: boolean } = {}) {
  const workspaceId = useEmailWorkspaceId();
  const settleDelay = useRef<number | null>(null);
  return useQuery({
    ...EMAIL_QUERY_OPTIONS,
    queryKey: emailQueryKey(workspaceId, "setup"),
    queryFn: async ({ signal }) => unwrapEmailResult(await getEmailSetupAction(signal)),
    enabled: enabled && workspaceId !== "",
    staleTime: 15_000,
    refetchInterval: (query) => {
      settleDelay.current = setupPollDelay(query.state.data, settleDelay.current);
      return settleDelay.current ?? (live ? EMAIL_LIVE_MS : false);
    },
  });
}

export const SUBDOMAIN_CHECK_DELAY_MS = 400;

export function useSubdomainCheck(slug: string, enabled = true) {
  const workspaceId = useEmailWorkspaceId();
  const settled = useDebouncedValue(slug, SUBDOMAIN_CHECK_DELAY_MS);
  const query = useQuery({
    ...EMAIL_QUERY_OPTIONS,
    queryKey: emailQueryKey(workspaceId, "subdomain-check", settled),
    queryFn: async ({ signal }) => unwrapEmailResult(await checkEmailSubdomainAction(settled, signal)),
    enabled: enabled && workspaceId !== "",
    staleTime: 10_000,
  });
  const current = settled === slug;
  return {
    check: current ? query.data : undefined,
    checking: !current || query.isFetching,
    error: current && query.isError ? query.error : null,
  };
}

export type SubdomainCheckState = ReturnType<typeof useSubdomainCheck>;

export function useEmailOverview(days: EmailOverviewDays, enabled: boolean) {
  const workspaceId = useEmailWorkspaceId();
  return useQuery({
    ...EMAIL_QUERY_OPTIONS,
    queryKey: emailQueryKey(workspaceId, "overview", days),
    queryFn: async ({ signal }) => unwrapEmailResult(await getEmailOverviewAction(days, signal)),
    enabled: enabled && workspaceId !== "",
    staleTime: 30_000,
    refetchInterval: EMAIL_LIVE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useEmailPricing(enabled = true) {
  const workspaceId = useEmailWorkspaceId();
  return useQuery({
    ...EMAIL_QUERY_OPTIONS,
    queryKey: emailQueryKey(workspaceId, "pricing"),
    queryFn: async ({ signal }) => unwrapEmailResult(await getEmailPricingAction(signal)),
    enabled: enabled && workspaceId !== "",
    staleTime: 5 * 60_000,
  });
}

export function useEmailSuppressions(page: number, pageSize: number, search: string, enabled: boolean) {
  const workspaceId = useEmailWorkspaceId();
  return useQuery({
    ...EMAIL_QUERY_OPTIONS,
    queryKey: emailQueryKey(workspaceId, "suppressions", page, pageSize, search.trim()),
    queryFn: async ({ signal }) => unwrapEmailResult(await listEmailSuppressionsAction(page, pageSize, search, signal)),
    enabled: enabled && workspaceId !== "",
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export const ADDRESS_STATUS_POLL_MS = 4000;

export function useEmailAddressStatus(address: string, enabled: boolean) {
  const workspaceId = useEmailWorkspaceId();
  const trimmed = address.trim();
  return useQuery({
    ...EMAIL_QUERY_OPTIONS,
    retry: false,
    queryKey: emailQueryKey(workspaceId, "address-status", trimmed.toLowerCase()),
    queryFn: async ({ signal }) => unwrapEmailResult(await getEmailAddressStatusAction(trimmed, signal)),
    enabled: enabled && workspaceId !== "" && trimmed !== "",
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.data?.verdict === "domain_pending" ? ADDRESS_STATUS_POLL_MS : false),
  });
}

export function useApplyEmailSetup() {
  const client = useQueryClient();
  const workspaceId = useEmailWorkspaceId();
  return useCallback(
    (setup: EmailSetup) => {
      client.setQueryData(emailQueryKey(workspaceId, "setup"), setup);
      void client.invalidateQueries({ queryKey: emailQueryKey(workspaceId) });
    },
    [client, workspaceId],
  );
}

export function useRefreshEmail() {
  const client = useQueryClient();
  const workspaceId = useEmailWorkspaceId();
  return useCallback(
    (...parts: string[]) => client.invalidateQueries({ queryKey: emailQueryKey(workspaceId, ...parts) }),
    [client, workspaceId],
  );
}
