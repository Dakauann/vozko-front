"use client";

import { useQuery } from "@tanstack/react-query";

import { countAudienceAction } from "@/app/actions/campaign-audience";
import { answered } from "@/components/campaign-audience/use-audience-queries";
import { useWorkspace } from "@/contexts/workspace-context";
import { codedQueryError } from "@/lib/api/coded-query-error";
import type { CodedError } from "@/lib/api/coded-error";
import type { AudienceSelection, AudienceSpec, VariableCount } from "@/lib/campaign-audience/types";
import type { LeadSelection } from "@/lib/leads/actions";

export interface TemplateSlot {
  name: string;
  header: boolean;
}

export interface TemplateSlots {
  slots: TemplateSlot[] | null;
  loading: boolean;
  error: CodedError | null;
  reload: () => void;
}

function pickedSelection(selection: LeadSelection): AudienceSelection {
  const picked: Record<string, unknown> = { mode: selection.mode };
  if (selection.ids) picked.ids = selection.ids;
  if (selection.filter) picked.filter = selection.filter;
  if (selection.sort) picked.sort = selection.sort;
  if (selection.limit) picked.limit = selection.limit;
  return picked as unknown as AudienceSelection;
}

function slotOf(variable: VariableCount): TemplateSlot {
  return { name: variable.name, header: variable.header };
}

export function useTemplateSlots({ selection, templateId, businessPhoneId }: { selection: LeadSelection; templateId: string; businessPhoneId: string }): TemplateSlots {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const spec: AudienceSpec = { source: "leads", selection: pickedSelection(selection) };
  const query = useQuery({
    queryKey: ["lead-send-template-slots", workspaceId, templateId, businessPhoneId, spec],
    queryFn: async () => answered(await countAudienceAction("whatsapp", spec, { templateId, businessPhoneId })).variables.map(slotOf),
    enabled: workspaceId !== "" && templateId !== "",
    refetchOnWindowFocus: false,
    retry: false,
  });
  return {
    slots: query.data ?? null,
    loading: query.isFetching,
    error: codedQueryError(query.error),
    reload: () => void query.refetch(),
  };
}
