"use client";

import { useQuery } from "@tanstack/react-query";

import { findLeadByNumberAction, findLeadsByNameAction, type LeadLookupMatch } from "@/app/actions/leads";
import { useWorkspace } from "@/contexts/workspace-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { leadLookupFor, type LeadLookup } from "@/lib/leads/lookup";

const LOOKUP_DEBOUNCE_MS = 300;
const LOOKUP_STALE_MS = 30_000;

function lookupValue(lookup: LeadLookup | null): string {
  if (!lookup) return "";
  return lookup.kind === "number" ? lookup.number : lookup.name;
}

export function useLeadLookup(text: string, enabled: boolean) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const typed = text.trim();
  const settledText = useDebouncedValue(typed, LOOKUP_DEBOUNCE_MS);
  const lookup = leadLookupFor(settledText);
  const query = useQuery({
    queryKey: ["lead-lookup", workspaceId, lookup?.kind ?? "", lookupValue(lookup)],
    queryFn: async ({ signal }): Promise<LeadLookupMatch[]> => {
      if (!lookup) return [];
      const result = lookup.kind === "number" ? await findLeadByNumberAction(lookup.number, signal) : await findLeadsByNameAction(lookup.name);
      if (result.error) throw new Error(result.error.code ?? result.error.message ?? "lead lookup failed");
      return result.matches;
    },
    enabled: enabled && workspaceId !== "" && lookup !== null,
    staleTime: LOOKUP_STALE_MS,
    refetchOnWindowFocus: false,
  });
  const current = enabled && lookup !== null && settledText === typed;
  return {
    byNumber: lookup?.kind === "number",
    searching: enabled && leadLookupFor(typed) !== null && (!current || query.isFetching),
    failed: current && query.isError,
    matches: current && query.isSuccess ? query.data : [],
    settled: current && query.isSuccess,
  };
}
