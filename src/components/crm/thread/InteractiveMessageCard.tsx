"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowBendUpLeft, ListBullets } from "@/components/icons";
import type { InteractiveChoice, InteractiveMessage, InteractiveListSection } from "@/lib/conversations/interactive-message";

import { CollapsibleMessageText } from "./message-parts";
import { useThreadRow } from "./thread-context";

export const BUBBLE_ACTION_CLASS =
  "flex w-full items-center justify-center gap-1.5 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs font-medium text-primary-ink transition-colors enabled:hover:bg-muted disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type ChooseOption = ((choice: InteractiveChoice) => void) | undefined;

function ChoiceButton({ choice, onChoose }: { choice: InteractiveChoice; onChoose: ChooseOption }) {
  const t = useTranslations("crmConversation.thread.interactive");
  return (
    <button
      type="button"
      disabled={!onChoose}
      title={onChoose ? undefined : t("choiceHint")}
      onClick={() => onChoose?.(choice)}
      className={BUBBLE_ACTION_CLASS}
    >
      <ArrowBendUpLeft className="h-3.5 w-3.5" aria-hidden />
      {choice.title}
    </button>
  );
}

function ListSections({ sections, onChoose, id }: { sections: InteractiveListSection[]; onChoose: ChooseOption; id: string }) {
  const t = useTranslations("crmConversation.thread.interactive");
  return (
    <div id={id} className="space-y-2 rounded-[--radius] border border-border bg-card p-2">
      {sections.map((section, index) => (
        <div key={`${section.title ?? ""}:${index}`} className="space-y-1">
          {section.title ? <p className="px-1 text-2xs font-semibold text-muted-foreground">{section.title}</p> : null}
          <ul className="space-y-0.5">
            {section.rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={!onChoose}
                  title={onChoose ? undefined : t("choiceHint")}
                  onClick={() => onChoose?.(row)}
                  className="block w-full rounded-[--radius] px-2 py-1 text-left transition-colors enabled:hover:bg-muted disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block text-xs font-medium text-foreground">{row.title}</span>
                  {row.description ? <span className="block text-2xs text-muted-foreground">{row.description}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ListChoices({ interactive, onChoose }: { interactive: Extract<InteractiveMessage, { kind: "list" }>; onChoose: ChooseOption }) {
  const t = useTranslations("crmConversation.thread.interactive");
  const [open, setOpen] = useState(false);
  const sectionsId = useId();
  return (
    <>
      <button type="button" aria-expanded={open} aria-controls={sectionsId} onClick={() => setOpen((current) => !current)} className={BUBBLE_ACTION_CLASS}>
        <ListBullets className="h-3.5 w-3.5" aria-hidden />
        {interactive.buttonText ?? t("listFallback")}
      </button>
      {open ? <ListSections id={sectionsId} sections={interactive.sections} onChoose={onChoose} /> : null}
    </>
  );
}

export function InteractiveMessageCard({ text, interactive }: { text: string; interactive: InteractiveMessage }) {
  const { onChooseOption } = useThreadRow();
  return (
    <div data-interactive-card={interactive.kind} className="mb-1 flex w-[min(280px,100%)] flex-col gap-1.5">
      {interactive.header ? <p className="text-sm font-semibold leading-snug">{interactive.header}</p> : null}
      {text ? <CollapsibleMessageText text={text} /> : null}
      {interactive.footer ? <p className="text-2xs text-muted-foreground">{interactive.footer}</p> : null}
      {interactive.kind === "buttons" ? (
        interactive.choices.map((choice) => <ChoiceButton key={choice.id} choice={choice} onChoose={onChooseOption} />)
      ) : (
        <ListChoices interactive={interactive} onChoose={onChooseOption} />
      )}
    </div>
  );
}
