"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { isActionError, type ActionError, type ActionResult } from "@/app/actions/action-result";
import {
  getAudienceExitsAction,
  getDraftExitVerdictAction,
  getTemplateButtonActionsAction,
  getTemplateExitVerdictAction,
  saveTemplateButtonActionsAction,
} from "@/app/actions/template-exit";
import { useWorkspace } from "@/contexts/workspace-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SectionError } from "@/lib/analytics/section-query";
import { codedQueryError } from "@/lib/api/coded-query-error";
import type { TemplateActionsChange, TemplateButtonActions } from "@/lib/whatsapp-templates/exit";
import { draftAllowedKinds, type DraftVerdictRequest } from "@/lib/whatsapp-templates/exit-draft";

export const templateExitKeys = {
  template: (workspaceId: string, templateId: string) => ["template-exit", workspaceId, templateId] as const,
  verdict: (workspaceId: string, templateId: string, campaignId: string) =>
    [...templateExitKeys.template(workspaceId, templateId), "verdict", campaignId] as const,
  actions: (workspaceId: string, templateId: string) => [...templateExitKeys.template(workspaceId, templateId), "actions"] as const,
  draft: (workspaceId: string, draft: string) => ["template-exit", workspaceId, "draft", draft] as const,
  audience: (workspaceId: string, list: string) => ["template-exit", workspaceId, "audience", list] as const,
};

export const EXIT_READ_DEBOUNCE_MS = 500;

function listKey(numbers: readonly string[]): string {
  let hash = 2166136261;
  for (const number of numbers) {
    for (let i = 0; i < number.length; i++) hash = Math.imul(hash ^ number.charCodeAt(i), 16777619);
    hash = Math.imul(hash ^ 44, 16777619);
  }
  return `${numbers.length}:${(hash >>> 0).toString(36)}`;
}

function required<T>(result: ActionResult<T>): T {
  if (isActionError(result)) throw new SectionError(result.error, result.status, result.code);
  return result.data;
}

function useWorkspaceId(): string {
  const { currentWorkspace } = useWorkspace();
  return currentWorkspace?.id ?? "";
}

export function useTemplateExitVerdict(templateId: string, campaignId = "") {
  const workspaceId = useWorkspaceId();
  const enabled = workspaceId !== "" && templateId !== "";
  const query = useQuery({
    queryKey: templateExitKeys.verdict(workspaceId, templateId, campaignId),
    queryFn: async () => required(await getTemplateExitVerdictAction(templateId, campaignId || undefined)),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { refetch } = query;
  return {
    verdict: enabled ? (query.data ?? null) : null,
    loading: enabled && query.isPending,
    error: codedQueryError(query.error),
    reload: useCallback(() => void refetch(), [refetch]),
  };
}

export type TemplateActionsSave =
  | { status: "saved"; actions: TemplateButtonActions }
  | { status: "conflict"; current: TemplateButtonActions }
  | { status: "failed"; error: ActionError };

export function useTemplateButtonActions(templateId: string, enabled = true) {
  const workspaceId = useWorkspaceId();
  const client = useQueryClient();
  const active = enabled && workspaceId !== "" && templateId !== "";
  const key = templateExitKeys.actions(workspaceId, templateId);
  const query = useQuery({
    queryKey: key,
    queryFn: async () => required(await getTemplateButtonActionsAction(templateId)),
    enabled: active,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const current = query.data;

  const save = useCallback(
    async (change: TemplateActionsChange): Promise<TemplateActionsSave> => {
      if (!current) return { status: "failed", error: { error: "button actions not loaded" } };
      const result = await saveTemplateButtonActionsAction(templateId, current.version, change);
      if (result.status === "saved") client.setQueryData(templateExitKeys.actions(workspaceId, templateId), result.actions);
      if (result.status === "conflict") client.setQueryData(templateExitKeys.actions(workspaceId, templateId), result.current);
      if (result.status !== "failed") {
        await client.invalidateQueries({ queryKey: [...templateExitKeys.template(workspaceId, templateId), "verdict"] });
      }
      return result;
    },
    [client, current, templateId, workspaceId],
  );

  const { refetch } = query;
  return {
    actions: active ? (current ?? null) : null,
    loading: active && query.isPending,
    error: codedQueryError(query.error),
    reload: useCallback(() => void refetch(), [refetch]),
    save,
  };
}

export function useDraftExitVerdict(draft: DraftVerdictRequest | null) {
  const workspaceId = useWorkspaceId();
  const current = draft ? JSON.stringify(draft) : "";
  const settled = useDebouncedValue(current, EXIT_READ_DEBOUNCE_MS);
  const enabled = workspaceId !== "" && settled !== "";
  const query = useQuery({
    queryKey: templateExitKeys.draft(workspaceId, settled),
    queryFn: async () => required(await getDraftExitVerdictAction(JSON.parse(settled) as DraftVerdictRequest)),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });
  const draftVerdict = enabled ? (query.data ?? null) : null;
  const error = codedQueryError(query.error);
  const fresh = draftVerdict !== null && settled === current && query.isSuccess && !query.isPlaceholderData;
  return { draftVerdict, fresh, error, allowedKinds: draftAllowedKinds(error ? null : draftVerdict) };
}

export function useAudienceExits(numbers: readonly string[]) {
  const workspaceId = useWorkspaceId();
  const joined = numbers.map((number) => number.trim()).filter((number) => number !== "").join(",");
  const settledList = useDebouncedValue(joined, EXIT_READ_DEBOUNCE_MS);
  const settled = useMemo(() => (settledList === "" ? [] : settledList.split(",")), [settledList]);
  const key = useMemo(() => listKey(settled), [settled]);
  const enabled = workspaceId !== "" && settled.length > 0;
  const query = useQuery({
    queryKey: templateExitKeys.audience(workspaceId, key),
    queryFn: async () => required(await getAudienceExitsAction([...settled])),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { exits: enabled ? (query.data ?? null) : null, error: codedQueryError(query.error) };
}

export type AudienceExitsRead = ReturnType<typeof useAudienceExits>;
