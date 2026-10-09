"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { listAssignableMembersAction, type AssignableMember } from "@/app/actions/workspace";
import { useWorkspace } from "@/contexts/workspace-context";

const MEMBERS_STALE_MS = 60_000;
const MEMBERS_PAGE_SIZE = 200;

export function memberDisplayName(member: AssignableMember): string {
  return member.username?.trim() || member.email?.trim() || member.userId;
}

export function useAssignableMembers(enabled: boolean, search = "") {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const term = search.trim();
  const query = useQuery({
    queryKey: ["assignable-members", workspaceId, term],
    queryFn: async () => {
      const result = await listAssignableMembersAction(workspaceId, { pageSize: MEMBERS_PAGE_SIZE, search: term });
      if (result.error) throw new Error(result.error);
      return result.members;
    },
    enabled: enabled && workspaceId !== "",
    staleTime: MEMBERS_STALE_MS,
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === workspaceId ? previous : undefined),
  });
  const members = useMemo(() => query.data ?? [], [query.data]);
  const names = useMemo(() => new Map(members.map((member) => [member.userId, memberDisplayName(member)])), [members]);
  const { refetch } = query;
  const reload = useCallback(() => void refetch(), [refetch]);
  return { members, names, loading: query.isFetching, pending: query.isLoading, failed: query.isError, reload };
}
