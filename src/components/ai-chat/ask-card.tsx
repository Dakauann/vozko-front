"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

import { ChatCircleDots, Check, PaperPlaneRight, PencilSimple } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { askQuestions, composeAnswers, nextOpenStep, readAnswers, type AskTurn } from "@/lib/aichat/ask";
import type { AskCard, AskQuestion } from "@/lib/aichat/types";
import { cn } from "@/lib/utils";

export const AskTurnContext = createContext<AskTurn | null>(null);

const CLOSED: AskTurn = { state: "open", answer: null };

const ARROWS: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

const OPTION =
  "group flex w-full items-start gap-3 rounded-[--radius] border border-border bg-card px-3 py-2.5 text-left transition-colors duration-DEFAULT hover:border-control-edge hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-control-edge aria-pressed:bg-muted disabled:pointer-events-none disabled:opacity-40";

const KEY =
  "mt-px inline-flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-control-edge bg-card px-1 font-sans text-2xs font-semibold tabular-nums text-muted-foreground transition-colors duration-DEFAULT group-aria-pressed:border-transparent group-aria-pressed:bg-primary group-aria-pressed:text-primary-foreground";

export function AskCardView({ card }: { card: AskCard }) {
  const turn = useContext(AskTurnContext) ?? CLOSED;
  const [sent, setSent] = useState<string[] | null>(null);
  const questions = askQuestions(card);
  if (questions.length === 0) return null;
  if (sent) return <AskSummary questions={questions} answers={sent} />;
  if (turn.state === "answered") return <AskSummary questions={questions} answers={readAnswers(questions, turn.reply)} />;
  return <AskForm questions={questions} answer={turn.answer} onSent={setSent} />;
}

function AskSummary({ questions, answers }: { questions: AskQuestion[]; answers: string[] | null }) {
  const t = useTranslations("aiChatPage.ask");
  const label = answers ? t("answered") : t(questions.length > 1 ? "formLabel" : "label");
  return (
    <section aria-label={label} className="rounded-lg border border-border bg-card px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {answers ? (
          <Check className="h-3.5 w-3.5 text-primary-ink" aria-hidden />
        ) : (
          <ChatCircleDots className="h-3.5 w-3.5" aria-hidden />
        )}
        {label}
      </p>
      <ul className="mt-2 space-y-2">
        {questions.map((question, i) => (
          <li key={question.text} className="min-w-0">
            <p className="text-xs leading-snug text-muted-foreground">{question.text}</p>
            {answers ? <p className="break-words text-sm font-medium leading-snug text-foreground">{answers[i]}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AskForm({
  questions,
  answer,
  onSent,
}: {
  questions: AskQuestion[];
  answer: ((text: string) => boolean) | null;
  onSent: (answers: string[]) => void;
}) {
  const t = useTranslations("aiChatPage.ask");
  const single = questions.length === 1;
  const [answers, setAnswers] = useState<(string | null)[]>(() => questions.map(() => null));
  const [step, setStep] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const reviewing = step === questions.length;

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    body.current?.querySelector<HTMLElement>("[data-ask-focus]")?.focus();
  }, [step]);

  const goTo = (next: number) => {
    moved.current = true;
    setStep(next);
  };

  const choose = (value: string) => {
    if (!answer) return;
    if (single) {
      if (answer(value)) onSent([value]);
      return;
    }
    const updated = answers.map((current, i) => (i === step ? value : current));
    setAnswers(updated);
    goTo(nextOpenStep(updated, step));
  };

  const submit = () => {
    const complete = answers.filter((value): value is string => value !== null);
    if (!answer || complete.length !== questions.length) return;
    if (answer(composeAnswers(questions, complete))) onSent(complete);
  };

  return (
    <section aria-label={t(single ? "label" : "formLabel")} className="rounded-lg border border-border bg-card shadow-sm">
      {single ? null : <AskProgress questions={questions} answers={answers} step={step} disabled={!answer} onGo={goTo} />}
      <div ref={body} className="p-3.5">
        {reviewing ? (
          <AskReview questions={questions} answers={answers} disabled={!answer} onEdit={goTo} onSubmit={submit} />
        ) : (
          <AskStep key={step} question={questions[step]} selected={answers[step]} disabled={!answer} form={!single} onChoose={choose} />
        )}
      </div>
    </section>
  );
}

function AskProgress({
  questions,
  answers,
  step,
  disabled,
  onGo,
}: {
  questions: AskQuestion[];
  answers: (string | null)[];
  step: number;
  disabled: boolean;
  onGo: (step: number) => void;
}) {
  const t = useTranslations("aiChatPage.ask");
  const reviewing = step === questions.length;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-1.5">
      <p aria-live="polite" className="text-xs font-medium tabular-nums text-muted-foreground">
        {reviewing ? t("review") : t("progress", { current: step + 1, total: questions.length })}
      </p>
      <ol aria-label={t("steps")} className="flex items-center">
        {questions.map((question, i) => (
          <li key={question.text}>
            <button
              type="button"
              disabled={disabled}
              aria-current={i === step ? "step" : undefined}
              aria-label={t("goTo", { number: i + 1 })}
              onClick={() => onGo(i)}
              className="group flex h-7 items-center px-1 focus-visible:outline-none disabled:pointer-events-none"
            >
              <span
                className={cn(
                  "block h-1.5 w-5 rounded-full transition-colors duration-DEFAULT group-hover:bg-muted-foreground/60 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-card",
                  i === step ? "bg-primary group-hover:bg-primary" : answers[i] !== null ? "bg-foreground/45" : "bg-muted-foreground/25",
                )}
              />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AskStep({
  question,
  selected,
  disabled,
  form,
  onChoose,
}: {
  question: AskQuestion;
  selected: string | null;
  disabled: boolean;
  form: boolean;
  onChoose: (value: string) => void;
}) {
  const t = useTranslations("aiChatPage.ask");
  const titleId = useId();
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const picked = question.options.findIndex((option) => option.label === selected);
  const [draft, setDraft] = useState(selected !== null && picked < 0 ? selected : "");
  const focusAt = Math.max(0, picked);
  const count = question.options.length;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement || event.ctrlKey || event.metaKey || event.altKey) return;
    const number = Number(event.key);
    if (Number.isInteger(number) && number >= 1 && number <= count) {
      event.preventDefault();
      if (!disabled) onChoose(question.options[number - 1].label);
      return;
    }
    const delta = ARROWS[event.key];
    const current = options.current.findIndex((el) => el === event.target);
    if (!delta || current < 0) return;
    event.preventDefault();
    options.current[(current + delta + count) % count]?.focus();
  };

  const sendDraft = () => {
    const value = draft.trim();
    if (value && !disabled) onChoose(value);
  };

  return (
    <div onKeyDown={onKeyDown}>
      <p id={titleId} className="flex items-start gap-2 text-pretty text-sm font-semibold leading-snug text-foreground">
        <ChatCircleDots className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-ink" aria-hidden />
        {question.text}
      </p>
      <div role="group" aria-labelledby={titleId} className="mt-3 grid gap-1.5">
        {question.options.map((option, i) => {
          const chosen = option.label === selected;
          return (
            <button
              key={option.label}
              ref={(el) => {
                options.current[i] = el;
              }}
              type="button"
              aria-pressed={chosen}
              tabIndex={i === focusAt ? 0 : -1}
              data-ask-focus={i === focusAt ? "" : undefined}
              disabled={disabled}
              onClick={() => onChoose(option.label)}
              className={OPTION}
            >
              <kbd aria-hidden className={KEY}>
                {i + 1}
              </kbd>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium leading-snug text-foreground">{option.label}</span>
                {option.detail ? <span className="mt-0.5 block break-words text-xs leading-snug text-muted-foreground">{option.detail}</span> : null}
              </span>
              <Check
                aria-hidden
                className={cn("mt-0.5 h-4 w-4 flex-shrink-0 text-primary-ink transition-opacity duration-DEFAULT", chosen ? "opacity-100" : "opacity-0")}
              />
            </button>
          );
        })}
      </div>
      <form
        className="mt-2.5 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          sendDraft();
        }}
      >
        <ElevatedInput
          label={t("other")}
          value={draft}
          maxLength={500}
          disabled={disabled}
          controlSize="sm"
          className="min-w-0 flex-1"
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          iconVisible
          icon={<PaperPlaneRight aria-hidden />}
          aria-label={form ? t("next") : t("send")}
          disabled={disabled || !draft.trim()}
          className="h-10 w-10 flex-shrink-0 rounded-[--radius] sm:h-10 sm:w-10"
        />
      </form>
      <div className="mt-2 flex min-h-6 items-center justify-between gap-3">
        {form ? (
          <Button
            variant="ghost"
            size="sm"
            title={t("decide")}
            disabled={disabled}
            onClick={() => onChoose(t("decide"))}
            className="-ml-2.5 rounded-[--radius]"
          />
        ) : (
          <span />
        )}
        <p className="hidden text-2xs text-muted-foreground sm:block">{t("keys", { count })}</p>
      </div>
    </div>
  );
}

function AskReview({
  questions,
  answers,
  disabled,
  onEdit,
  onSubmit,
}: {
  questions: AskQuestion[];
  answers: (string | null)[];
  disabled: boolean;
  onEdit: (step: number) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("aiChatPage.ask");
  return (
    <div>
      <ul className="divide-y divide-border rounded-[--radius] border border-border">
        {questions.map((question, i) => (
          <li key={question.text}>
            <button
              type="button"
              disabled={disabled}
              aria-label={t("edit", { question: question.text })}
              onClick={() => onEdit(i)}
              className="group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs leading-snug text-muted-foreground">{question.text}</span>
                <span className="mt-0.5 block break-words text-sm font-medium leading-snug text-foreground">{answers[i]}</span>
              </span>
              <PencilSimple aria-hidden className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="primary"
          title={t("submit")}
          iconVisible
          iconSide="right"
          icon={<PaperPlaneRight aria-hidden />}
          disabled={disabled}
          onClick={onSubmit}
          data-ask-focus=""
          className="w-full rounded-[--radius] sm:w-auto"
        />
      </div>
    </div>
  );
}
