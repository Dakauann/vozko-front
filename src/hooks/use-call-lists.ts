"use client";

import { useCallback } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import {
  getCallListAction,
  listCallListItemsAction,
  listCallListsAction,
  type CallListsQuery,
} from "@/app/actions/call-lists";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionPagesQuery, useSectionQuery } from "@/hooks/use-section-query";
import { SectionError } from "@/lib/analytics/section-query";
import type { CodedError } from "@/lib/api/coded-error";
import type { ParsedAnswer } from "@/lib/api/parsed-request";
import { decodeItemsCursor, encodeItemsCursor, type CallList, type CallListItemState, type CallListPage } from "@/lib/call-lists/types";

export const CALL_LIST_ITEMS_PAGE_SIZE = 50;
export const CALL_LIST_BUILD_POLL_MS = 4_000;

function itemsOf(workspaceId: string, listId: string) {
  return ["call-lists", workspaceId, "items", listId] as const;
}

export const callListKeys = {
  all: (workspaceId: string) => ["call-lists", workspaceId] as const,
  page: (workspaceId: string, query: CallListsQuery) => ["call-lists", workspaceId, "page", query.page, query.pageSize, query.status ?? ""] as const,
  list: (workspaceId: string, listId: string) => ["call-lists", workspaceId, "list", listId] as const,
  itemsOf,
  items: (workspaceId: string, listId: string, state: CallListItemState) => [...itemsOf(workspaceId, listId), state] as const,
};

export function callListSectionError(error: CodedError): SectionError {
  return new SectionError(error.code ?? error.message ?? "call list request failed", error.status, error.code);
}

function required<T>(answer: ParsedAnswer<T>): T {
  if (answer.error) throw callListSectionError(answer.error);
  return answer.data;
}

function buildingPoll(building: boolean): number | false {
  return building ? CALL_LIST_BUILD_POLL_MS : false;
}

export function useCallListsPage(query: CallListsQuery) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const sameWorkspace = useCallback((previous: QueryKey) => previous[1] === workspaceId, [workspaceId]);
  return useSectionQuery<CallListPage>({
    queryKey: callListKeys.page(workspaceId, query),
    queryFn: async (signal) => required(await listCallListsAction(query, signal)),
    enabled: workspaceId !== "",
    refetchInterval: (data) => buildingPoll(Boolean(data?.items.some((list) => list.status === "building"))),
    keepPreviousWhen: sameWorkspace,
  });
}

export function useCallList(listId: string) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return useSectionQuery<CallList>({
    queryKey: callListKeys.list(workspaceId, listId),
    queryFn: async (signal) => required(await getCallListAction(listId, signal)),
    enabled: workspaceId !== "" && listId !== "",
    refetchInterval: (data) => buildingPoll(data?.status === "building"),
  });
}

export function useCallListItems(listId: string, state: CallListItemState, enabled: boolean) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return useSectionPagesQuery({
    queryKey: callListKeys.items(workspaceId, listId, state),
    queryFn: async (cursor, signal) =>
      required(await listCallListItemsAction(listId, { state, cursor: decodeItemsCursor(cursor), limit: CALL_LIST_ITEMS_PAGE_SIZE }, signal)),
    nextCursor: (page) => (page.next ? encodeItemsCursor(page.next) : undefined),
    enabled: enabled && workspaceId !== "" && listId !== "",
  });
}

export function useCallListCache() {
  const client = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";

  const store = useCallback(
    (list: CallList) => {
      client.setQueryData(callListKeys.list(workspaceId, list.id), list);
      void client.invalidateQueries({ queryKey: [...callListKeys.all(workspaceId), "page"] });
    },
    [client, workspaceId],
  );

  const refreshItems = useCallback(
    (listId: string) => {
      void client.invalidateQueries({ queryKey: callListKeys.itemsOf(workspaceId, listId) });
      void client.invalidateQueries({ queryKey: callListKeys.list(workspaceId, listId) });
    },
    [client, workspaceId],
  );

  const forget = useCallback(
    (listId: string) => {
      client.removeQueries({ queryKey: callListKeys.list(workspaceId, listId) });
      client.removeQueries({ queryKey: callListKeys.itemsOf(workspaceId, listId) });
      void client.invalidateQueries({ queryKey: [...callListKeys.all(workspaceId), "page"] });
    },
    [client, workspaceId],
  );

  return { store, refreshItems, forget };
}
