"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { quoteEmailOutreachAction } from "@/app/actions/email-outreach";
import { useWorkspace } from "@/contexts/workspace-context";
import { emailQueryKey, useEmailSetup } from "@/hooks/use-email-marketing";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import { SectionError } from "@/lib/analytics/section-query";
import { readableFields } from "@/lib/crm/custom-fields";
import type { CustomField } from "@/lib/email-design/merge-tags";
import { sendableSenders } from "@/lib/email-marketing/ladder";

export function useEmailOutreachAvailability() {
  const { can } = useWorkspace();
  const allowed = can("email_marketing", "start");
  const setup = useEmailSetup({ enabled: allowed, live: false });
  const senders = useMemo(() => (setup.data ? sendableSenders(setup.data) : []), [setup.data]);
  return { available: allowed && senders.length > 0, senders, loading: allowed && setup.isPending };
}

export function useEmailOutreachQuote(enabled = true) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return useQuery({
    queryKey: emailQueryKey(workspaceId, "outreach-quote"),
    queryFn: async ({ signal }) => {
      const { quote, error } = await quoteEmailOutreachAction(signal);
      if (error || !quote) throw new SectionError(error?.message ?? "", error?.status, error?.code ?? "email_pricing_failed");
      return quote;
    },
    enabled: enabled && workspaceId !== "",
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useEmailMergeFields(enabled = true): CustomField[] {
  const fields = useLeadFieldDefinitions(enabled);
  return useMemo(
    () => readableFields(fields.definitions).filter((field) => !field.sensitive).map((field) => ({ key: field.key, label: field.label })),
    [fields.definitions],
  );
}
