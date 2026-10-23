"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { Info } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  declaredReadIssues,
  exampleText,
  hasExamplesToFill,
  triggerFieldControl,
  triggerIssueView,
  withExamples,
  withFieldValue,
  withJsonText,
  type TriggerInputDraft,
  type TriggerInputField,
  type TriggerInputIssue,
  type TriggerInputSpec,
} from "@/lib/workflows/trigger-input";

const NO_OPTION = "__none__";
const NO_ISSUES: readonly TriggerInputIssue[] = [];
const NO_KEYS: readonly string[] = [];
const EVENT_NOT_ACCEPTED = "event_not_accepted";

const JSON_AREA =
  "w-full resize-y rounded-[--radius] border border-control-edge bg-background p-2 font-mono text-2xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function useTriggerIssueText(): (code: string) => string {
  const t = useTranslations("workflowDebug.triggerInput");
  return useCallback((code: string) => (t.has(`issues.${code}`) ? t(`issues.${code}`) : t("unknownIssue", { code })), [t]);
}

function MarkLine({ tone, children }: { tone: "fault" | "warning"; children: string }) {
  return (
    <p className="flex items-center gap-1.5 text-2xs text-foreground">
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone === "fault" ? "bg-destructive" : "bg-warning")} />
      {children}
    </p>
  );
}

function InfoLine({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-muted-foreground">
      <Info size={12} weight="fill" aria-hidden className="mt-px shrink-0 text-info-ink" />
      <span>{children}</span>
    </p>
  );
}

function ReadByLink({
  readBy,
  nodeLabel,
  onFocusNode,
}: {
  readBy: readonly string[];
  nodeLabel?: (nodeId: string) => string | undefined;
  onFocusNode?: (nodeId: string) => void;
}) {
  const t = useTranslations("workflowDebug.triggerInput");
  const [open, setOpen] = useState(false);
  const text = t("usedIn", { count: readBy.length });
  if (!onFocusNode || readBy.length === 0) return <span className="shrink-0 text-2xs text-muted-foreground">{text}</span>;
  const linkClass = "text-2xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  if (readBy.length === 1) {
    return (
      <button type="button" onClick={() => onFocusNode(readBy[0])} className={cn("shrink-0", linkClass)}>
        {text}
      </button>
    );
  }
  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5">
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={linkClass}>
        {text}
      </button>
      {open && (
        <span className="flex flex-col items-end gap-0.5">
          {readBy.map((nodeId) => (
            <button key={nodeId} type="button" onClick={() => onFocusNode(nodeId)} className={linkClass}>
              {nodeLabel?.(nodeId) ?? nodeId}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function FieldControl({
  field,
  draft,
  invalid,
  inputId,
  onDraftChange,
}: {
  field: TriggerInputField;
  draft: TriggerInputDraft;
  invalid: boolean;
  inputId: string;
  onDraftChange: (draft: TriggerInputDraft) => void;
}) {
  const t = useTranslations("workflowDebug.triggerInput");
  const value = draft.values[field.key];
  const text = typeof value === "string" ? value : "";
  const set = (next: string | boolean) => onDraftChange(withFieldValue(draft, field.key, next));
  const example = exampleText(field.example);
  const placeholder = example ? t("example", { example }) : undefined;

  switch (triggerFieldControl(field)) {
    case "switch":
      return (
        <div className="flex items-center gap-2">
          <ElevatedSwitch id={inputId} aria-label={field.key} checked={value === true} onCheckedChange={(checked) => set(checked)} />
          <span className="text-xs text-foreground">{value === true ? t("yes") : t("no")}</span>
        </div>
      );
    case "select":
      return (
        <ElevatedSelect
          aria-label={field.key}
          value={text || NO_OPTION}
          onValueChange={(next) => set(next === NO_OPTION ? "" : next)}
        >
          <ElevatedSelectItem value={NO_OPTION}>{placeholder ?? " "}</ElevatedSelectItem>
          {(field.options ?? []).map((option) => (
            <ElevatedSelectItem key={option.value} value={option.value}>
              {option.label}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      );
    case "json":
      return (
        <textarea
          id={inputId}
          aria-label={field.key}
          aria-invalid={invalid}
          value={text}
          placeholder={placeholder}
          onChange={(event) => set(event.target.value)}
          spellCheck={false}
          rows={4}
          className={JSON_AREA}
        />
      );
    case "number":
      return (
        <ElevatedInput
          id={inputId}
          aria-label={field.key}
          aria-invalid={invalid}
          type="number"
          step="any"
          inputMode="decimal"
          controlSize="sm"
          value={text}
          placeholder={placeholder}
          onChange={(event) => set(event.target.value)}
        />
      );
    case "date":
      return (
        <ElevatedInput
          id={inputId}
          aria-label={field.key}
          aria-invalid={invalid}
          type="date"
          controlSize="sm"
          value={text}
          onChange={(event) => set(event.target.value)}
        />
      );
    case "text":
      return (
        <ElevatedInput
          id={inputId}
          aria-label={field.key}
          aria-invalid={invalid}
          controlSize="sm"
          value={text}
          placeholder={placeholder}
          onChange={(event) => set(event.target.value)}
        />
      );
  }
}

export interface TriggerInputEditorProps {
  spec: TriggerInputSpec;
  draft: TriggerInputDraft;
  onDraftChange: (draft: TriggerInputDraft) => void;
  issues?: readonly TriggerInputIssue[];
  syntax?: readonly string[];
  nodeLabel?: (nodeId: string) => string | undefined;
  onFocusNode?: (nodeId: string) => void;
}

export function TriggerInputEditor({
  spec,
  draft,
  onDraftChange,
  issues = NO_ISSUES,
  syntax = NO_KEYS,
  nodeLabel,
  onFocusNode,
}: TriggerInputEditorProps) {
  const t = useTranslations("workflowDebug.triggerInput");
  const issueText = useTriggerIssueText();
  const baseId = useId();
  const view = useMemo(() => triggerIssueView(spec, issues), [spec, issues]);
  const undeclared = useMemo(() => declaredReadIssues(spec), [spec]);
  const extraKeys = Object.keys(draft.extra);
  const canFillExamples = hasExamplesToFill(spec, draft);
  const eventRefused = spec.acceptedEvents.length > 0 && issues.some((issue) => issue.code === EVENT_NOT_ACCEPTED);

  if (spec.shape !== "fields" && spec.shape !== "json") return null;

  return (
    <div className="space-y-3" data-testid="trigger-input-editor">
      {canFillExamples && (
        <button
          type="button"
          onClick={() => onDraftChange(withExamples(spec, draft))}
          className="text-2xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("fillExamples")}
        </button>
      )}
      {spec.shape === "fields" &&
        spec.fields.map((field, index) => {
          const fieldIssues = view.byField[field.key] ?? [];
          const syntaxError = syntax.includes(field.key);
          const masked = draft.masked.includes(field.key);
          const inputId = `${baseId}-${index}`;
          return (
            <div key={field.key} className="space-y-1" data-field={field.key}>
              <div className="flex items-start justify-between gap-2">
                <label htmlFor={inputId} className="min-w-0 break-all font-mono text-xs text-foreground">
                  {field.key}
                  {field.required && (
                    <span className="ml-1 font-sans text-2xs text-muted-foreground" title={t("required")}>
                      ({t("required")})
                    </span>
                  )}
                </label>
                <ReadByLink readBy={field.readBy} nodeLabel={nodeLabel} onFocusNode={onFocusNode} />
              </div>
              <FieldControl field={field} draft={draft} invalid={fieldIssues.length > 0 || syntaxError} inputId={inputId} onDraftChange={onDraftChange} />
              {field.description && <p className="text-2xs leading-relaxed text-muted-foreground">{field.description}</p>}
              {masked && <MarkLine tone="warning">{t("masked")}</MarkLine>}
              {syntaxError && <MarkLine tone="fault">{t("syntax")}</MarkLine>}
              {fieldIssues.map((code) => (
                <MarkLine key={code} tone="fault">
                  {issueText(code)}
                </MarkLine>
              ))}
            </div>
          );
        })}

      {spec.shape === "json" && (
        <div className="space-y-1">
          <label htmlFor={`${baseId}-body`} className="text-xs text-foreground">
            {t("body")}
          </label>
          <textarea
            id={`${baseId}-body`}
            aria-invalid={syntax.length > 0}
            value={draft.json}
            onChange={(event) => onDraftChange(withJsonText(draft, event.target.value))}
            spellCheck={false}
            rows={8}
            className={JSON_AREA}
          />
          {syntax.length > 0 && <MarkLine tone="fault">{t("syntax")}</MarkLine>}
          {draft.masked.length > 0 && <MarkLine tone="warning">{t("maskedPaths", { keys: draft.masked.join(", ") })}</MarkLine>}
          {spec.readKeys.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-2xs text-muted-foreground">{t("readKeys")}</p>
              <ul className="flex flex-wrap gap-1">
                {spec.readKeys.map((key) => (
                  <li key={key} className="rounded-[--radius] border border-border px-1.5 py-0.5 font-mono text-2xs text-foreground">
                    {key}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {extraKeys.length > 0 && <InfoLine>{t("extraKeys", { keys: extraKeys.join(", ") })}</InfoLine>}
      {undeclared.map((key) => (
        <InfoLine key={key}>{t("readNotDeclared", { key })}</InfoLine>
      ))}
      {view.general.length > 0 && (
        <div className="space-y-1">
          {view.general.map((issue, index) => (
            <MarkLine key={`${issue.code}:${issue.key}:${index}`} tone="fault">
              {issue.key ? t("generalIssue", { key: issue.key, issue: issueText(issue.code) }) : issueText(issue.code)}
            </MarkLine>
          ))}
        </div>
      )}
      {eventRefused && <InfoLine>{t("acceptedEvents", { events: spec.acceptedEvents.join(", ") })}</InfoLine>}
    </div>
  );
}
