"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { createLeadFormAction } from "@/app/actions/advertising-forms";
import { isAdsError } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { ArrowDown, ArrowUp, Plus, Trash, X } from "@/components/icons";
import {
  MAX_OPTIONS,
  MAX_QUESTIONS,
  STANDARD_QUESTIONS,
  buildFormDraft,
  customQuestion,
  emptyFormBuilder,
  hasContactQuestion,
  hasQuestion,
  moveQuestion,
  questionIssuePrefix,
  questionKey,
  toggleStandard,
  type BuilderQuestion,
  type FormBuilderState,
  type LeadForm,
  type StandardQuestion,
} from "@/lib/advertising/forms";
import { issuesAt, issuesUnder, type ExpectedIssues } from "@/lib/advertising/issues";
import type { AdAccount, AdPage } from "@/lib/advertising/types";

import { IssueList } from "../field-issue";
import { IconAction } from "../icon-action";
import { Section } from "../wizard/choice-row";
import { FormPreview } from "./form-preview";

type TextField = "name" | "headline" | "privacyUrl" | "privacyText" | "thankYouTitle" | "thankYouBody" | "thankYouUrl";

export function FormBuilderDialog({
  account,
  page,
  onClose,
  onCreated,
}: {
  account: AdAccount;
  page: AdPage;
  onClose: () => void;
  onCreated: (form: LeadForm) => void;
}) {
  const t = useTranslations("adsForms.builder");
  const tq = useTranslations("adsForms.questions");
  const [state, setState] = useState<FormBuilderState>(emptyFormBuilder);
  const [expected, setExpected] = useState<ExpectedIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const full = state.questions.length >= MAX_QUESTIONS;

  const patch = (change: Partial<FormBuilderState>) => setState((current) => ({ ...current, ...change }));
  const setQuestions = (change: (questions: BuilderQuestion[]) => BuilderQuestion[]) =>
    setState((current) => ({ ...current, questions: change(current.questions) }));
  const patchQuestion = (id: string, change: Partial<BuilderQuestion>) =>
    setQuestions((questions) => questions.map((question) => (question.id === id ? { ...question, ...change } : question)));

  const submit = async () => {
    setSaving(true);
    setFailure(null);
    const outcome = await createLeadFormAction(buildFormDraft(state, account.id, page.pageId));
    setSaving(false);
    if (isAdsError(outcome)) {
      setExpected(outcome.expected ?? {});
      setFailure(outcome.expected ? null : outcome.error);
      return;
    }
    onCreated(outcome.data);
  };

  const setText = (field: TextField, value: string) => setState((current) => ({ ...current, [field]: value }));

  const text = (field: TextField, label: string, multiline = false) => (
    <div className="space-y-1">
      {multiline ? (
        <ElevatedTextarea
          label={label}
          placeholder=" "
          value={state[field]}
          onChange={(event) => setText(field, event.target.value)}
          autoResize
        />
      ) : (
        <ElevatedInput label={label} placeholder=" " value={state[field]} onChange={(event) => setText(field, event.target.value)} />
      )}
      <IssueList namespace="adsForms" issues={issuesAt(expected, field)} />
    </div>
  );

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent className="max-w-5xl">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description", { page: page.name })}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-6">
              <Section title={t("basicsTitle")}>
                {text("name", t("name"))}
                {text("headline", t("headline"))}
                <IssueList namespace="adsForms" issues={[...issuesAt(expected, "pageId"), ...issuesAt(expected, "adAccountId")]} />
              </Section>

              <Section title={t("questionsTitle")} description={t("questionsDescription")}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STANDARD_QUESTIONS.map((type) => (
                    <StandardToggle
                      key={type}
                      label={tq(type)}
                      checked={hasQuestion(state.questions, type)}
                      disabled={full && !hasQuestion(state.questions, type)}
                      onToggle={() => setQuestions((questions) => toggleStandard(questions, type as StandardQuestion))}
                    />
                  ))}
                </div>
                {!hasContactQuestion(state.questions) ? <p className="text-xs text-warning-ink">{t("needsContact")}</p> : null}
                <IssueList namespace="adsForms" issues={issuesAt(expected, "questions")} />

                <ol className="space-y-2">
                  {state.questions.map((question, index) => (
                    <li key={question.id} className="space-y-2 rounded-[--radius] border border-border bg-card px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {question.type === "CUSTOM" ? question.label || t("customUntitled") : tq(question.type)}
                          </p>
                          <p className="truncate font-mono text-2xs text-muted-foreground">{t("key", { key: questionKey(question, index) })}</p>
                        </div>
                        <IconAction label={t("moveUp")} onClick={() => setQuestions((questions) => moveQuestion(questions, index, -1))} disabled={index === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </IconAction>
                        <IconAction
                          label={t("moveDown")}
                          onClick={() => setQuestions((questions) => moveQuestion(questions, index, 1))}
                          disabled={index === state.questions.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </IconAction>
                        <IconAction
                          label={t("remove")}
                          onClick={() => setQuestions((questions) => questions.filter((candidate) => candidate.id !== question.id))}
                          danger
                        >
                          <Trash className="h-4 w-4" />
                        </IconAction>
                      </div>
                      {question.type === "CUSTOM" ? (
                        <CustomQuestionEditor question={question} onChange={(change) => patchQuestion(question.id, change)} />
                      ) : null}
                      <IssueList namespace="adsForms" issues={issuesUnder(expected, questionIssuePrefix(index))} />
                    </li>
                  ))}
                </ol>
                <Button
                  variant="secondary"
                  title={t("addCustom")}
                  icon={<Plus className="h-4 w-4" />}
                  iconVisible
                  iconSide="left"
                  disabled={full}
                  onClick={() => setQuestions((questions) => [...questions, customQuestion()])}
                />
              </Section>

              <Section title={t("privacyTitle")} description={t("privacyDescription")}>
                {text("privacyUrl", t("privacyUrl"))}
                {text("privacyText", t("privacyText"))}
              </Section>

              <Section title={t("thanksTitle")}>
                {text("thankYouTitle", t("thankYouTitle"))}
                {text("thankYouBody", t("thankYouBody"), true)}
                {text("thankYouUrl", t("thankYouUrl"))}
              </Section>

              <ElevatedSwitch
                checked={state.higherIntent}
                onCheckedChange={(higherIntent) => patch({ higherIntent })}
                label={t("higherIntent")}
                description={t("higherIntentHint")}
              />
              {failure ? <p className="text-sm text-destructive-ink">{failure}</p> : null}
            </div>
            <div className="lg:sticky lg:top-0 lg:self-start">
              <FormPreview state={state} page={page} />
            </div>
          </div>
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("cancel")} onClick={onClose} />
          <Button
            variant="primary"
            title={saving ? t("creating") : t("create")}
            onClick={submit}
            disabled={saving || state.questions.length === 0}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

function StandardToggle({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2.5 rounded-[--radius] border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
    >
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={onToggle} />
      {label}
    </label>
  );
}

function CustomQuestionEditor({ question, onChange }: { question: BuilderQuestion; onChange: (change: Partial<BuilderQuestion>) => void }) {
  const t = useTranslations("adsForms.builder");
  const setOption = (index: number, value: string) =>
    onChange({ options: question.options.map((option, current) => (current === index ? value : option)) });

  return (
    <div className="space-y-2 pl-7">
      <ElevatedInput
        label={t("customLabel")}
        placeholder=" "
        value={question.label}
        onChange={(event) => onChange({ label: event.target.value })}
        controlSize="sm"
      />
      {question.options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <ElevatedInput
            placeholder={t("optionPlaceholder", { number: index + 1 })}
            aria-label={t("optionPlaceholder", { number: index + 1 })}
            value={option}
            onChange={(event) => setOption(index, event.target.value)}
            controlSize="sm"
            className="flex-1"
          />
          <IconAction label={t("removeOption")} onClick={() => onChange({ options: question.options.filter((_, current) => current !== index) })}>
            <X className="h-4 w-4" />
          </IconAction>
        </div>
      ))}
      <button
        type="button"
        disabled={question.options.length >= MAX_OPTIONS}
        onClick={() => onChange({ options: [...question.options, ""] })}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary-ink hover:underline disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {question.options.length === 0 ? t("addChoices") : t("addOption")}
      </button>
      {question.options.length === 0 ? <p className="text-2xs text-muted-foreground">{t("freeTextHint")}</p> : null}
    </div>
  );
}
