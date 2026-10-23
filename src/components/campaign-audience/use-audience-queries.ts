"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  countAudienceAction,
  listAudienceLeadsAction,
  listAudienceFieldsAction,
  listTemplateFieldsAction,
  previewAudienceListAction,
  searchAudienceRowsAction,
} from "@/app/actions/campaign-audience";
import { useWorkspace } from "@/contexts/workspace-context";
import { SectionError } from "@/lib/analytics/section-query";
import type { ParsedAnswer } from "@/lib/api/parsed-request";
import type { AudienceChannel, AudienceLeadQuery, AudienceSpec, ChannelFields, ListContext, RowQuery } from "@/lib/campaign-audience/types";

const QUERY_OPTIONS = { refetchOnWindowFocus: false, retry: false } as const;

function useWorkspaceId(): string {
  const { currentWorkspace } = useWorkspace();
  return currentWorkspace?.id ?? "";
}

export function campaignAudienceRoot(workspaceId: string, channel: AudienceChannel | "template") {
  return ["campaign-audience", workspaceId, channel] as const;
}

export function campaignAudienceListRoot(workspaceId: string, channel: AudienceChannel, listId: string) {
  return [...campaignAudienceRoot(workspaceId, channel), "list", listId] as const;
}

export function campaignAudienceCountRoot(workspaceId: string, channel: AudienceChannel) {
  return [...campaignAudienceRoot(workspaceId, channel), "count"] as const;
}

export function answered<T>(answer: ParsedAnswer<T>): T {
  if (answer.error) throw new SectionError(answer.error.message ?? "", answer.error.status, answer.error.code);
  return answer.data;
}

export function useAudienceFields(channel: AudienceChannel) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: [...campaignAudienceRoot(workspaceId, channel), "fields"],
    queryFn: async () => answered(await listAudienceFieldsAction(channel)),
    enabled: workspaceId !== "",
    staleTime: 60_000,
    ...QUERY_OPTIONS,
  });
}

export function useTemplateFields() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: [...campaignAudienceRoot(workspaceId, "template"), "fields"],
    queryFn: async () => answered(await listTemplateFieldsAction()),
    enabled: workspaceId !== "",
    staleTime: 60_000,
    ...QUERY_OPTIONS,
  });
}

export function useAudienceCountQuery(channel: AudienceChannel, spec: AudienceSpec | null, fields: ChannelFields, enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: [...campaignAudienceCountRoot(workspaceId, channel), spec, fields],
    queryFn: async ({ signal }) => answered(await countAudienceAction(channel, spec as AudienceSpec, fields, signal)),
    enabled: enabled && spec !== null && workspaceId !== "",
    placeholderData: keepPreviousData,
    ...QUERY_OPTIONS,
  });
}

export function useListPreviewQuery(channel: AudienceChannel, listId: string | null, context: ListContext) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: [...campaignAudienceListRoot(workspaceId, channel, listId ?? ""), "preview", context],
    queryFn: async () => answered(await previewAudienceListAction(channel, listId as string, context)),
    enabled: listId !== null && workspaceId !== "",
    placeholderData: keepPreviousData,
    ...QUERY_OPTIONS,
  });
}

export function listPreviewKey(workspaceId: string, channel: AudienceChannel, listId: string, context: ListContext) {
  return [...campaignAudienceListRoot(workspaceId, channel, listId), "preview", context] as const;
}

export function useListRowsQuery(channel: AudienceChannel, listId: string | null, context: ListContext, query: RowQuery) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: [...campaignAudienceListRoot(workspaceId, channel, listId ?? ""), "rows", context, query],
    queryFn: async () => answered(await searchAudienceRowsAction(channel, listId as string, context, query)),
    enabled: listId !== null && workspaceId !== "",
    placeholderData: keepPreviousData,
    ...QUERY_OPTIONS,
  });
}

export function campaignAudienceLeadsRoot(workspaceId: string, channel: AudienceChannel) {
  return [...campaignAudienceRoot(workspaceId, channel), "leads"] as const;
}

export function useAudienceLeadsQuery(channel: AudienceChannel, spec: AudienceSpec | null, fields: ChannelFields, query: AudienceLeadQuery) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: [...campaignAudienceLeadsRoot(workspaceId, channel), spec, fields, query],
    queryFn: async () => answered(await listAudienceLeadsAction(channel, spec as AudienceSpec, fields, query)),
    enabled: spec !== null && workspaceId !== "",
    placeholderData: keepPreviousData,
    ...QUERY_OPTIONS,
  });
}

export { useWorkspaceId as useAudienceWorkspaceId };
