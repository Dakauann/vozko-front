"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { listLeadsQueryAction } from "@/app/actions/leads";
import { useWorkspace } from "@/contexts/workspace-context";
import { emptyCrmFilter } from "@/lib/crm/board";
import { withSet } from "@/lib/filters/controls";
import { leadNameLines } from "@/lib/leads/display";

const LEAD_NAMES_STALE_MS = 60_000;
const LEAD_ID_FIELD = "id";

export interface LeadNames {
  names: ReadonlyMap<string, string>;
  pending: boolean;
  failed: boolean;
}

export function useLeadNames(ids: readonly string[]): LeadNames {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const wanted = useMemo(() => [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort(), [ids]);
  const query = useQuery({
    queryKey: ["lead-names", workspaceId, wanted.join(",")],
    queryFn: async () => {
      const result = await listLeadsQueryAction({
        filter: withSet(emptyCrmFilter, LEAD_ID_FIELD, wanted),
        page: 1,
        pageSize: wanted.length,
      });
      if (result.error) throw new Error(result.errorCode ?? result.error);
      return result.items;
    },
    enabled: workspaceId !== "" && wanted.length > 0,
    staleTime: LEAD_NAMES_STALE_MS,
    refetchOnWindowFocus: false,
  });
  const names = useMemo(
    () => new Map((query.data ?? []).map((item) => [item.id, leadNameLines({ realName: item.realName, number: item.number }).title])),
    [query.data],
  );
  return { names, pending: wanted.length > 0 && query.isPending, failed: query.isError };
}
