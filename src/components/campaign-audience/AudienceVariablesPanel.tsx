"use client";

import { useLocale, useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { Sparkle } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { VariableChoice } from "@/lib/campaign-audience/draft";
import {
  LITERAL_AUDIENCE_SOURCE,
  type AudienceChannel,
  type BindableField,
  type MissingPolicy,
  type VariableCount,
} from "@/lib/campaign-audience/types";
import { cn } from "@/lib/utils";

import type { AudienceLeadFocus } from "./AudienceLeadsSheet";
import { isEmailChannel, slotTag, useAudienceSourceLabel, useMissingFieldText, useSlotName } from "./use-audience-copy";

interface VariableRowProps {
  channel: AudienceChannel;
  variable: VariableCount;
  choice: VariableChoice;
  fields: readonly BindableField[];
  onChoice: (patch: VariableChoice) => void;
  onOpen?: (focus: AudienceLeadFocus) => void;
  readOnly: boolean;
}

function SourceControl({ channel, variable, choice, fields, onChoice, readOnly }: VariableRowProps) {
  const t = useTranslations("leadSends.bindings");
  const tStep = useTranslations("campaignAudience.step.variables");
  const labelOf = useAudienceSourceLabel(channel, fields);
  const tag = useSlotName()(variable);
  const source = choice.source ?? variable.source ?? "";

  if (isEmailChannel(channel)) {
    return (
      <div className="flex h-10 min-w-0 items-center gap-2 rounded-[--radius] border border-border bg-muted px-3 text-sm text-foreground">
        <span className="truncate">{labelOf(variable.key)}</span>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-1">
      <ElevatedSelect
        label={t("source", { slot: tag })}
        aria-label={t("source", { slot: tag })}
        value={source}
        disabled={readOnly}
        onValueChange={(next) => onChoice(next === LITERAL_AUDIENCE_SOURCE ? { source: next, value: "" } : { source: next })}
        contentClassName="z-[200]"
      >
        <ElevatedSelectItem value={LITERAL_AUDIENCE_SOURCE}>{labelOf(LITERAL_AUDIENCE_SOURCE, LITERAL_AUDIENCE_SOURCE)}</ElevatedSelectItem>
        {fields.map((field) => (
          <ElevatedSelectItem key={field.source} value={field.source}>
            {labelOf(variable.key, field.source)}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      {variable.suggested && choice.source === undefined ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkle className="h-3 w-3" aria-hidden />
          {tStep("suggested")}
        </span>
      ) : null}
      {source === LITERAL_AUDIENCE_SOURCE ? (
        <ElevatedInput
          controlSize="sm"
          label={t("literalValue", { slot: tag })}
          aria-label={t("literalValue", { slot: tag })}
          value={choice.value ?? variable.value ?? ""}
          disabled={readOnly}
          onChange={(event) => onChoice({ source: LITERAL_AUDIENCE_SOURCE, value: event.target.value })}
        />
      ) : null}
    </div>
  );
}

function MissingMark({
  channel,
  variable,
  fields,
  onOpen,
}: {
  channel: AudienceChannel;
  variable: VariableCount;
  fields: readonly BindableField[];
  onOpen?: (focus: AudienceLeadFocus) => void;
}) {
  const t = useTranslations("campaignAudience.step.variables");
  const locale = useLocale();
  const missingText = useMissingFieldText(channel, fields);
  if (variable.missing === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-foreground">
        <span aria-hidden className="h-2 w-2 rounded-full bg-healthy" />
        {t("allHave")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-foreground">
      <span aria-hidden className="h-2 w-2 rounded-full bg-warning" />
      {onOpen ? (
        <button type="button" className="text-left underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onOpen({ variable: variable.key })}>
          <b className="readout font-semibold">{variable.missing.toLocaleString(locale)}</b> {missingText(variable.key, variable.source)}
        </button>
      ) : (
        <>
          <b className="readout font-semibold">{variable.missing.toLocaleString(locale)}</b>
          {missingText(variable.key, variable.source)}
        </>
      )}
    </span>
  );
}

function policyOf(variable: VariableCount, choice: VariableChoice): MissingPolicy | "" {
  if (choice.missing) return choice.missing;
  if (variable.policy) return variable.policy;
  return isFallbackText(variable) ? "text" : "";
}

function isFallbackText(variable: VariableCount): boolean {
  return !variable.choiceRequired && variable.policy === "" && Boolean(variable.fallback);
}

function MissingChoice({ channel, variable, choice, fields, onChoice, readOnly }: VariableRowProps) {
  const t = useTranslations("campaignAudience.step.variables");
  const missingText = useMissingFieldText(channel, fields);
  const slot = useSlotName()(variable);
  const policy = policyOf(variable, choice);
  const pending = variable.choiceRequired && policy === "";
  const text = choice.text ?? variable.text ?? variable.fallback ?? "";
  return (
    <div className="col-start-2 grid gap-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="legend min-w-[3.5rem]">{t("ifMissing")}</span>
        <ElevatedPillToggle<MissingPolicy | "">
          aria-label={t("ifMissingLabel", { slot })}
          value={policy}
          onChange={(missing) => (missing === "" ? undefined : onChoice(missing === "text" ? { missing, text } : { missing }))}
          className={cn(pending && "border-warning")}
          options={[
            { value: "text", label: t("useText"), disabled: readOnly },
            { value: "exclude", label: t("exclude"), disabled: readOnly },
          ]}
        />
        {policy === "text" ? (
          <ElevatedInput
            controlSize="sm"
            className="w-44"
            label={t("textLabel")}
            aria-label={t("textLabelFor", { slot })}
            value={text}
            disabled={readOnly}
            onChange={(event) => onChoice({ missing: "text", text: event.target.value })}
          />
        ) : null}
        {policy === "exclude" ? <span className="text-xs text-muted-foreground">{t("excludeHint", { count: variable.missing })}</span> : null}
      </div>
      {pending ? (
        <Notice tone="warning" title={t("choiceTitle", { slot })}>
          <p>{t(channel === "whatsapp" ? "choiceMeta" : "choiceBody", { count: variable.missing, field: missingText(variable.key, variable.source) })}</p>
        </Notice>
      ) : null}
    </div>
  );
}

function VariableRow(props: VariableRowProps) {
  const { channel, variable, fields } = props;
  const tSlot = useTranslations("campaignAudience.step.slot");
  return (
    <div className="grid grid-cols-[minmax(4rem,auto)_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span className="mt-2.5 grid w-fit justify-items-start gap-1">
        <span className="readout rounded-[--radius] bg-muted px-1.5 font-mono text-xs font-semibold text-foreground">{slotTag(variable)}</span>
        {variable.header ? <span className="rounded-[--radius] border border-border bg-card px-1.5 text-2xs font-semibold text-muted-foreground">{tSlot("header")}</span> : null}
      </span>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
        <SourceControl {...props} />
        <MissingMark channel={channel} variable={variable} fields={fields} onOpen={props.onOpen} />
      </div>
      {variable.missing > 0 ? <MissingChoice {...props} /> : null}
    </div>
  );
}

export function AudienceVariablesPanel({
  channel,
  variables,
  choices,
  fields,
  onChoice,
  onOpen,
  readOnly = false,
}: {
  channel: AudienceChannel;
  variables: readonly VariableCount[];
  choices: Record<string, VariableChoice>;
  fields: readonly BindableField[];
  onChoice: (key: string, patch: VariableChoice) => void;
  onOpen?: (focus: AudienceLeadFocus) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations("campaignAudience.step.variables");
  const tMerge = useTranslations("emailEditor.mergeTags");
  if (variables.length === 0) return null;
  const email = isEmailChannel(channel);
  return (
    <PanelSection
      boxed
      title={email ? tMerge("title") : t("title")}
      description={email ? tMerge("description") : t("description")}
      legend={t(`legend.${channel}`, { count: variables.length })}
    >
      {variables.map((variable) => (
        <VariableRow
          key={variable.key}
          channel={channel}
          variable={variable}
          choice={choices[variable.key] ?? {}}
          fields={fields}
          onChoice={(patch) => onChoice(variable.key, patch)}
          onOpen={onOpen}
          readOnly={readOnly}
        />
      ))}
    </PanelSection>
  );
}
