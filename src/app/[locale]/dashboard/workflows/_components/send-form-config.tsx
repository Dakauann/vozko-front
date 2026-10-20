"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";

import { listFormsAction } from "@/app/actions/whatsapp-forms";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { FORM_COPY_LIMITS } from "@/lib/conversations/form-send";
import { publishedForms, readSendFormConfig } from "@/lib/workflows/form-node";
import type { FormSummary } from "@/lib/whatsapp-forms/types";

import { VariableCommandInput } from "./variable-command-input";

type AvailableVars = ComponentProps<typeof VariableCommandInput>["availableVars"];

interface FormList {
  forms: FormSummary[];
  loading: boolean;
  failed: boolean;
}

export function usePublishedForms(): FormList {
  const [list, setList] = useState<FormList>({ forms: [], loading: true, failed: false });
  useEffect(() => {
    const controller = new AbortController();
    listFormsAction({}, controller.signal).then((answer) => {
      if (controller.signal.aborted) return;
      setList({ forms: publishedForms(answer.data ?? []), loading: false, failed: Boolean(answer.error) });
    });
    return () => controller.abort();
  }, []);
  return list;
}

function Counter({ count, limit }: { count: number; limit: number }) {
  const t = useTranslations("workflowsPage.sendForm");
  return (
    <p className={count > limit ? "mt-1 text-2xs tabular-nums text-destructive-ink" : "mt-1 text-2xs tabular-nums text-muted-foreground"}>
      {t("count", { count, limit })}
    </p>
  );
}

export function SendFormConfigSection({
  config,
  onChange,
  availableVars,
  fallbackTemplate,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  availableVars: AvailableVars;
  fallbackTemplate: ReactNode;
}) {
  const t = useTranslations("workflowsPage.sendForm");
  const { forms, loading, failed } = usePublishedForms();
  const form = readSendFormConfig(config);
  const savedName = typeof config._display_form_id === "string" ? config._display_form_id : "";
  const options = forms.map((item) => ({ value: item.form.id, label: item.form.name }));
  const withSaved =
    form.form_id && !options.some((option) => option.value === form.form_id)
      ? [{ value: form.form_id, label: savedName || form.form_id }, ...options]
      : options;
  const minutes = Math.round(form.timeout_seconds / 60);

  const pickForm = (formId: string) => {
    const picked = forms.find((item) => item.form.id === formId);
    onChange({
      form_id: formId,
      _display_form_id: picked?.form.name ?? "",
      ...(form.body.trim() ? {} : { body: t("defaultBody") }),
      ...(form.cta.trim() ? {} : { cta: t("defaultCta") }),
    });
  };

  return (
    <div className="space-y-3 rounded-[--radius] border border-border bg-mist p-3" data-testid="send-form-config">
      <div className="space-y-1">
        <ElevatedCommandSelect
          label={t("form")}
          value={form.form_id}
          options={withSaved}
          onValueChange={pickForm}
          searchPlaceholder={t("search")}
          emptyMessage={failed ? t("loadFailed") : t("empty")}
          isLoading={loading}
        />
        {!form.form_id ? <p className="text-2xs text-destructive-ink">{t("required")}</p> : null}
        <p className="text-2xs text-muted-foreground">{t("formHint")}</p>
      </div>

      <div>
        <VariableCommandInput label={t("header")} value={form.header} onChange={(header) => onChange({ header })} controlSize="sm" availableVars={availableVars} />
        <Counter count={form.header.length} limit={FORM_COPY_LIMITS.header} />
      </div>
      <div>
        <VariableCommandInput label={`${t("body")} *`} value={form.body} onChange={(body) => onChange({ body })} controlSize="sm" availableVars={availableVars} multiline />
        <Counter count={form.body.length} limit={FORM_COPY_LIMITS.body} />
      </div>
      <div>
        <VariableCommandInput label={t("footer")} value={form.footer} onChange={(footer) => onChange({ footer })} controlSize="sm" availableVars={availableVars} />
        <Counter count={form.footer.length} limit={FORM_COPY_LIMITS.footer} />
      </div>
      <div>
        <ElevatedInput label={`${t("cta")} *`} value={form.cta} onChange={(event) => onChange({ cta: event.target.value })} controlSize="sm" />
        <Counter count={form.cta.length} limit={FORM_COPY_LIMITS.cta} />
      </div>

      <div className="space-y-1">
        <ElevatedInput
          label={t("timeout")}
          type="number"
          min={1}
          value={String(minutes)}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next) && next > 0) onChange({ timeout_seconds: Math.round(next * 60) });
          }}
          controlSize="sm"
        />
        <p className="text-2xs text-muted-foreground">{t("timeoutHint")}</p>
      </div>

      <div className="space-y-1">
        {fallbackTemplate}
        <p className="text-2xs text-muted-foreground">{t("fallbackHint")}</p>
      </div>
    </div>
  );
}
