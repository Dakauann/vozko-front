"use client";

import { createContext, useContext, useState } from "react";
import { useTranslations } from "next-intl";

import { ChatCircleDots } from "@/components/icons";
import { CHIP_CHOSEN } from "@/components/ui/button-surfaces";
import type { AskCard } from "@/lib/aichat/types";
import { cn } from "@/lib/utils";

export type ChatAnswer = (text: string) => boolean;

export const ChatAnswerContext = createContext<ChatAnswer | null>(null);

const CHIP =
  "inline-flex min-h-8 items-center rounded-[--radius] border border-control-edge bg-card px-3 py-1.5 text-left text-sm font-medium text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

const CHOSEN = CHIP_CHOSEN;

export function AskCardView({ card }: { card: AskCard }) {
  const t = useTranslations("aiChatPage.ask");
  const answer = useContext(ChatAnswerContext);
  const [chosen, setChosen] = useState<string | null>(null);

  const pick = (option: string) => {
    if (!answer || chosen) return;
    if (answer(option)) setChosen(option);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-3.5 shadow-sm" aria-label={t("label")}>
      <p className="flex items-start gap-2 text-sm font-semibold leading-snug text-foreground">
        <ChatCircleDots weight="bold" className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-ink" aria-hidden />
        {card.question.text}
      </p>
      <div role="group" aria-label={t("options")} className="mt-3 flex flex-wrap gap-2">
        {card.question.options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={chosen === option}
            disabled={!answer || (chosen !== null && chosen !== option)}
            onClick={() => pick(option)}
            className={cn(CHIP, chosen === option && CHOSEN)}
          >
            {option}
          </button>
        ))}
      </div>
      <p className="mt-2 text-2xs text-muted-foreground">{t("orType")}</p>
    </section>
  );
}
