"use client";

import { useTranslations } from "next-intl";

import type { SendableQuery } from "@/app/actions/whatsapp-forms";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { useSendableForms } from "@/hooks/use-sendable-forms";
import type { FlowAction } from "@/lib/whatsapp-templates/types";

export interface FlowButtonChoice {
  flowId: string;
  flowAction: FlowAction;
  navigateScreen: string;
  formName: string;
}

export function FlowFormPicker({
  query,
  flowId,
  onPick,
}: {
  query: SendableQuery | null;
  flowId?: string;
  onPick: (choice: FlowButtonChoice) => void;
}) {
  const t = useTranslations("whatsappTemplates.form.editor.buttons.flow");
  const { forms, loading, error } = useSendableForms(query);
  const selected = forms.find((form) => form.metaFlowId === flowId);
  const missing = Boolean(flowId) && !loading && !error && !selected;

  return (
    <div className="space-y-1">
      <ElevatedCommandSelect
        label={t("form")}
        value={selected?.formId ?? ""}
        options={forms.map((form) => ({ value: form.formId, label: form.name }))}
        onValueChange={(formId) => {
          const form = forms.find((candidate) => candidate.formId === formId);
          if (!form) return;
          onPick({ flowId: form.metaFlowId, flowAction: "navigate", navigateScreen: form.firstScreen, formName: form.name });
        }}
        searchPlaceholder={t("search")}
        emptyMessage={query ? t("empty") : t("needsNumber")}
        isLoading={loading}
        disabled={!query}
      />
      {!query ? <p className="text-2xs text-muted-foreground">{t("needsNumber")}</p> : null}
      {error ? <p className="text-2xs text-destructive-ink">{t("loadFailed")}</p> : null}
      {missing ? <p className="text-2xs text-muted-foreground">{t("notPublished")}</p> : null}
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
