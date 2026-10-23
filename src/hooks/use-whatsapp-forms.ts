"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import {
  fieldDistributionAction,
  formAutomationsAction,
  formOptionsAction,
  formResponseAction,
  formStatsAction,
  formVersionsAction,
  getFormAction,
  listFormResponsesAction,
  listFormSendsAction,
  listFormsAction,
  publishTargetsAction,
  type FormListQuery,
  type PeriodQuery,
  type ResponseListQuery,
} from "@/app/actions/whatsapp-forms";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionPagesQuery, useSectionQuery } from "@/hooks/use-section-query";
import { codedSectionError, SectionError } from "@/lib/analytics/section-query";
import type { ParsedAnswer } from "@/lib/api/parsed-request";
import { formAccess } from "@/lib/whatsapp-forms/access";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";

const RESPONSE_PAGE = 50;
const SEND_PAGE = 50;

function required<T>(answer: ParsedAnswer<T>, what: string): T {
  if (answer.error) throw codedSectionError(answer.error, what);
  return answer.data;
}

export function useFormAccess() {
  const { currentWorkspace, can } = useWorkspace();
  const access = useMemo(() => formAccess(can), [can]);
  return { workspaceId: currentWorkspace?.id ?? "", ...access };
}

export const formKeys = {
  all: (workspaceId: string) => ["whatsapp-forms", workspaceId] as const,
  options: (workspaceId: string) => ["whatsapp-forms", workspaceId, "options"] as const,
  list: (workspaceId: string, query: FormListQuery) => ["whatsapp-forms", workspaceId, "list", query.search?.trim() ?? "", query.archived === true] as const,
  form: (workspaceId: string, formId: string) => ["whatsapp-forms", workspaceId, "form", formId] as const,
  versions: (workspaceId: string, formId: string) => ["whatsapp-forms", workspaceId, "form", formId, "versions"] as const,
  responses: (workspaceId: string, formId: string, query: ResponseListQuery) => ["whatsapp-forms", workspaceId, "form", formId, "responses", query] as const,
  response: (workspaceId: string, responseId: string) => ["whatsapp-forms", workspaceId, "response", responseId] as const,
  stats: (workspaceId: string, formId: string, period: PeriodQuery) => ["whatsapp-forms", workspaceId, "form", formId, "stats", period.from ?? "", period.to ?? ""] as const,
  distribution: (workspaceId: string, formId: string, fieldKey: string, period: PeriodQuery) =>
    ["whatsapp-forms", workspaceId, "form", formId, "distribution", fieldKey, period.from ?? "", period.to ?? ""] as const,
  sends: (workspaceId: string, formId: string) => ["whatsapp-forms", workspaceId, "form", formId, "sends"] as const,
  automations: (workspaceId: string, formId: string) => ["whatsapp-forms", workspaceId, "form", formId, "automations"] as const,
  phones: (workspaceId: string) => ["whatsapp-forms", workspaceId, "phones"] as const,
  publishTargets: (workspaceId: string) => ["whatsapp-forms", workspaceId, "publish-targets"] as const,
};

export function useFormOptions() {
  const { workspaceId, view } = useFormAccess();
  return useSectionQuery({
    queryKey: formKeys.options(workspaceId),
    queryFn: async (signal) => required(await formOptionsAction(signal), "form options"),
    enabled: view && workspaceId !== "",
  });
}

export function useFormsList(query: FormListQuery) {
  const { workspaceId, view } = useFormAccess();
  return useSectionQuery({
    queryKey: formKeys.list(workspaceId, query),
    queryFn: async (signal) => required(await listFormsAction(query, signal), "forms"),
    enabled: view && workspaceId !== "",
    keepPreviousWhen: (previous) => previous[1] === workspaceId,
  });
}

export function useFormDetail(formId: string) {
  const { workspaceId, view } = useFormAccess();
  return useSectionQuery({
    queryKey: formKeys.form(workspaceId, formId),
    queryFn: async (signal) => required(await getFormAction(formId, signal), "form"),
    enabled: view && workspaceId !== "" && formId !== "",
  });
}

export function useFormVersions(formId: string) {
  const { workspaceId, view } = useFormAccess();
  return useSectionQuery({
    queryKey: formKeys.versions(workspaceId, formId),
    queryFn: async (signal) => required(await formVersionsAction(formId, signal), "form versions"),
    enabled: view && workspaceId !== "" && formId !== "",
  });
}

export function useFormResponses(formId: string, query: ResponseListQuery) {
  const { workspaceId, responses } = useFormAccess();
  return useSectionPagesQuery({
    queryKey: formKeys.responses(workspaceId, formId, query),
    queryFn: async (cursor, signal) =>
      required(await listFormResponsesAction(formId, { ...query, after: cursor || undefined, limit: RESPONSE_PAGE }, signal), "form responses"),
    nextCursor: (page) => page.next,
    enabled: responses && workspaceId !== "" && formId !== "",
  });
}

export function useFormResponse(responseId: string) {
  const { workspaceId, responses } = useFormAccess();
  return useSectionQuery({
    queryKey: formKeys.response(workspaceId, responseId),
    queryFn: async (signal) => required(await formResponseAction(responseId, signal), "form response"),
    enabled: responses && workspaceId !== "" && responseId !== "",
  });
}

export function useFormStats(formId: string, period: PeriodQuery) {
  const { workspaceId, responses } = useFormAccess();
  return useSectionQuery({
    queryKey: formKeys.stats(workspaceId, formId, period),
    queryFn: async (signal) => required(await formStatsAction(formId, period, signal), "form stats"),
    enabled: responses && workspaceId !== "" && formId !== "",
  });
}

export function useFieldDistribution(formId: string, fieldKey: string, period: PeriodQuery) {
  const { workspaceId, responses } = useFormAccess();
  return useSectionQuery({
    queryKey: formKeys.distribution(workspaceId, formId, fieldKey, period),
    queryFn: async (signal) => required(await fieldDistributionAction(formId, fieldKey, period, signal), "field distribution"),
    enabled: responses && workspaceId !== "" && formId !== "" && fieldKey !== "",
  });
}

export function useFormSends(formId: string) {
  const { workspaceId, view } = useFormAccess();
  return useSectionPagesQuery({
    queryKey: formKeys.sends(workspaceId, formId),
    queryFn: async (cursor, signal) => required(await listFormSendsAction(formId, { after: cursor || undefined, limit: SEND_PAGE }, signal), "form sends"),
    nextCursor: (page) => page.next,
    enabled: view && workspaceId !== "" && formId !== "",
  });
}

export function useFormAutomations(formId: string) {
  const { workspaceId, view } = useFormAccess();
  return useSectionQuery({
    queryKey: formKeys.automations(workspaceId, formId),
    queryFn: async (signal) => required(await formAutomationsAction(formId, signal), "form automations"),
    enabled: view && workspaceId !== "" && formId !== "",
  });
}

export function useOwnedPhones() {
  const { workspaceId, view } = useFormAccess();
  return useSectionQuery<WhatsAppBusinessPhone[]>({
    queryKey: formKeys.phones(workspaceId),
    queryFn: async () => {
      const result = await listBusinessPhonesAction({ ownership: "owned", pageSize: 100 });
      if (result.error) throw new SectionError(result.error);
      return result.phones;
    },
    enabled: view && workspaceId !== "",
  });
}

export function usePublishTargets() {
  const { workspaceId, publish } = useFormAccess();
  return useSectionQuery({
    queryKey: formKeys.publishTargets(workspaceId),
    queryFn: async (signal) => required(await publishTargetsAction(signal), "form publish targets"),
    enabled: publish && workspaceId !== "",
  });
}

export function useRefreshForms() {
  const client = useQueryClient();
  const { workspaceId } = useFormAccess();
  return useCallback(
    (formId?: string) => client.invalidateQueries({ queryKey: formId ? formKeys.form(workspaceId, formId) : formKeys.all(workspaceId) }),
    [client, workspaceId],
  );
}
