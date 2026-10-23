"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getTemplateSuggestionsAction, saveTemplateSuggestionsAction } from "@/app/actions/campaign-audience";
import { answered, useAudienceWorkspaceId } from "@/components/campaign-audience/use-audience-queries";
import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { codedQueryError } from "@/lib/api/coded-query-error";
import { draftSuggestions } from "@/lib/whatsapp-templates/suggestions";

function suggestionsKey(workspaceId: string, templateId: string) {
  return ["whatsapp-template-suggestions", workspaceId, templateId] as const;
}

export function useTemplateSuggestions(templateId: string) {
  const workspaceId = useAudienceWorkspaceId();
  const query = useQuery({
    queryKey: suggestionsKey(workspaceId, templateId),
    queryFn: async () => answered(await getTemplateSuggestionsAction(templateId)),
    enabled: workspaceId !== "",
    refetchOnWindowFocus: false,
    retry: false,
  });
  return { suggestions: query.data?.suggestions ?? null, error: codedQueryError(query.error), reload: () => void query.refetch() };
}

export function useSaveTemplateSuggestions() {
  const t = useTranslations("whatsappTemplates.form.editor.body");
  const tErrors = useTranslations("campaignAudience");
  const workspaceId = useAudienceWorkspaceId();
  const client = useQueryClient();
  return useCallback(
    async (templateId: string, components: readonly DraggableComponent[], clearing: boolean): Promise<void> => {
      const suggestions = draftSuggestions(components);
      if (suggestions.length === 0 && !clearing) return;
      const answer = await saveTemplateSuggestionsAction(templateId, suggestions);
      if (answer.error) {
        toast.error(t("suggestionsSaveFailed"), { description: codedErrorMessage(tErrors, answer.error, answer.error.message || t("suggestionsSaveFailed")) });
        return;
      }
      client.setQueryData(suggestionsKey(workspaceId, templateId), answer.data);
    },
    [t, tErrors, client, workspaceId],
  );
}
