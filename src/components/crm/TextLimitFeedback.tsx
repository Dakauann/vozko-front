"use client";

import { useTranslations } from "next-intl";

import { TEXT_LIMIT_COPY, offendingCharactersLabel, type TextLimitState } from "@/lib/conversations/text-limit";

export function TextLimitFeedback({ state }: { state: TextLimitState | null }) {
  const t = useTranslations("conversationWindow");
  if (!state) return null;
  return (
    <>
      {state.count > 0 && (
        <p
          aria-live="polite"
          className={`px-2 pb-1 text-right text-2xs tabular-nums ${
            state.over ? "font-semibold text-destructive-ink" : state.near ? "text-warning-ink" : "text-muted-foreground"
          }`}
        >
          {state.over ? t(TEXT_LIMIT_COPY[state.unit], { count: state.count, limit: state.limit }) : `${state.count}/${state.limit}`}
        </p>
      )}
      {state.offending.length > 0 && (
        <p aria-live="polite" className="flex items-center justify-end gap-1.5 px-2 pb-1 text-right text-2xs text-foreground">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-destructive" />
          {t("textCharset", { characters: offendingCharactersLabel(state.offending) })}
        </p>
      )}
    </>
  );
}
