"use client";

import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { getFormAction } from "@/app/actions/whatsapp-forms";
import { CircleNotch } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Notice } from "@/components/ui/notice";
import { fieldPrompt } from "@/lib/whatsapp-forms/answers";
import { documentFields } from "@/lib/whatsapp-forms/document-edit";
import type { Answer, Document, Field } from "@/lib/whatsapp-forms/types";
import { formRunAnswers, isMaskedFormField, type SimFormDraft } from "@/lib/workflows/sim-form";
import type { SimCustomerReply } from "@/lib/workflows/sim-replies";

interface LoadedForm {
  key: string;
  document: Document | null;
}

const INPUT_TYPES: Partial<Record<Field["kind"], string>> = {
  email: "email",
  phone: "tel",
  number: "number",
  date: "date",
};

type SetAnswer = (answer: Answer) => void;

function ChoiceLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs text-foreground">
      {children}
    </label>
  );
}

function FieldInput({ field, label, answer, onAnswer }: { field: Field; label: string; answer: Answer | undefined; onAnswer: SetAnswer }) {
  const t = useTranslations("workflowDebug.form");
  const id = useId();
  const base = { key: field.key, kind: field.kind };
  switch (field.kind) {
    case "long_text":
      return <ElevatedTextarea label={label} controlSize="sm" value={answer?.text ?? ""} onChange={(event) => onAnswer({ ...base, text: event.target.value })} />;
    case "single_choice_radio":
    case "single_choice_dropdown":
      return (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-foreground">{label}</legend>
          <RadioGroup value={answer?.optionIds?.[0] ?? ""} onValueChange={(optionId) => onAnswer({ ...base, optionIds: [optionId] })}>
            {(field.options ?? []).map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <RadioGroupItem id={`${id}-${option.id}`} value={option.id} />
                <ChoiceLabel htmlFor={`${id}-${option.id}`}>{option.title}</ChoiceLabel>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
      );
    case "multi_choice_checkbox":
    case "multi_choice_chips": {
      const chosen = answer?.optionIds ?? [];
      const toggle = (optionId: string, on: boolean) =>
        onAnswer({ ...base, optionIds: on ? [...chosen, optionId] : chosen.filter((current) => current !== optionId) });
      return (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-foreground">{label}</legend>
          {(field.options ?? []).map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <Checkbox id={`${id}-${option.id}`} checked={chosen.includes(option.id)} onCheckedChange={(on) => toggle(option.id, on === true)} />
              <ChoiceLabel htmlFor={`${id}-${option.id}`}>{option.title}</ChoiceLabel>
            </div>
          ))}
        </fieldset>
      );
    }
    case "opt_in":
      return (
        <div className="flex items-center gap-2">
          <Checkbox id={id} checked={answer?.checked === true} onCheckedChange={(on) => onAnswer({ ...base, checked: on === true })} />
          <ChoiceLabel htmlFor={id}>{label}</ChoiceLabel>
        </div>
      );
    case "date_range": {
      const range = answer?.range ?? { start: "", end: "" };
      return (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-foreground">{label}</legend>
          <div className="grid grid-cols-2 gap-1.5">
            <ElevatedInput label={t("rangeStart")} type="date" controlSize="sm" value={range.start} onChange={(event) => onAnswer({ ...base, range: { ...range, start: event.target.value } })} />
            <ElevatedInput label={t("rangeEnd")} type="date" controlSize="sm" value={range.end} onChange={(event) => onAnswer({ ...base, range: { ...range, end: event.target.value } })} />
          </div>
        </fieldset>
      );
    }
    case "photo":
    case "document":
      return (
        <ElevatedInput
          label={label}
          placeholder={t("fileName")}
          controlSize="sm"
          value={answer?.files?.[0]?.name ?? ""}
          onChange={(event) => onAnswer({ ...base, files: event.target.value.trim() ? [{ id: field.key, name: event.target.value, mimeType: "" }] : [] })}
        />
      );
    default:
      return (
        <ElevatedInput
          label={label}
          type={INPUT_TYPES[field.kind] ?? "text"}
          controlSize="sm"
          value={answer?.text ?? ""}
          onChange={(event) => onAnswer({ ...base, text: event.target.value })}
        />
      );
  }
}

export function SimFormReply({ formId, onReply }: { formId: string; onReply: (reply: SimCustomerReply) => void }) {
  const t = useTranslations("workflowDebug.form");
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<LoadedForm | null>(null);
  const [draft, setDraft] = useState<SimFormDraft>({});
  const key = `${formId}|${reload}`;

  useEffect(() => {
    const controller = new AbortController();
    void getFormAction(formId, controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      const version = res.data ? (res.data.published ?? res.data.draft) : null;
      setLoaded({ key, document: version?.document ?? null });
    });
    return () => controller.abort();
  }, [formId, key]);

  const loading = loaded?.key !== key;
  const document = loading ? null : (loaded?.document ?? null);
  const fields = useMemo(() => (document ? documentFields(document).map((ref) => ref.field) : []), [document]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (document) onReply({ kind: "form", answers: formRunAnswers(document, draft) });
  };
  const answerWith = (answer: Answer) => setDraft((current) => ({ ...current, [answer.key]: answer }));
  const noReply = (
    <ElevatedButton type="button" variant="ghost" size="sm" title={t("noReply")} onClick={() => onReply({ kind: "form_unanswered" })} />
  );

  return (
    <section aria-label={t("title")} className="max-h-[50vh] flex-shrink-0 space-y-2 overflow-y-auto border-t border-border px-3 py-2">
      <p className="text-xs font-semibold text-foreground">{t("title")}</p>
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
      {loading && <CircleNotch size={14} className="animate-spin text-muted-foreground" />}
      {!loading && !document && (
        <div className="space-y-2">
          <Notice tone="fault">{t("loadFailed")}</Notice>
          <div className="flex gap-1.5">
            <ElevatedButton type="button" variant="outline-subtle" size="sm" title={t("retry")} onClick={() => setReload((n) => n + 1)} />
            {noReply}
          </div>
        </div>
      )}
      {document && (
        <form onSubmit={submit} className="space-y-2.5">
          {fields.map((field) => {
            const prompt = fieldPrompt(field) || field.key;
            return (
              <div key={field.key} className="space-y-1">
                <FieldInput field={field} label={field.required ? t("required", { label: prompt }) : prompt} answer={draft[field.key]} onAnswer={answerWith} />
                {isMaskedFormField(field) && <p className="text-2xs text-muted-foreground">{t("masked")}</p>}
              </div>
            );
          })}
          <div className="flex gap-1.5">
            <ElevatedButton type="submit" variant="primary" size="sm" title={t("submit")} className="flex-1" />
            {noReply}
          </div>
        </form>
      )}
    </section>
  );
}
