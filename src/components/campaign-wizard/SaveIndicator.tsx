"use client";

import { useFormatter, useTranslations } from "next-intl";

import { Check, CircleNotch, WarningCircle } from "@/components/icons";

import type { SaveState } from "./use-draft-autosave";

export interface SaveIndicatorProps<E> {
  state: SaveState<E>;
  dirty: boolean;
  named: boolean;
  editable: boolean;
  errorMessage: (error: E) => string;
}

export function SaveIndicator<E>({ state, dirty, named, editable, errorMessage }: SaveIndicatorProps<E>) {
  const t = useTranslations("campaignWizard.save");
  const format = useFormatter();
  if (!editable) return <span className="text-2xs text-muted-foreground">{t("locked")}</span>;
  if (!named) return <span className="text-2xs text-muted-foreground">{t("needsName")}</span>;
  if (state.phase === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground" aria-live="polite">
        <CircleNotch className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
        {t("saving")}
      </span>
    );
  }
  if (state.phase === "error" && state.error) {
    return (
      <span className="inline-flex max-w-[360px] items-center gap-1.5 text-2xs text-destructive-ink" role="alert">
        <WarningCircle className="h-3.5 w-3.5 shrink-0" weight="fill" />
        <span className="truncate">{t("failed", { reason: errorMessage(state.error) })}</span>
      </span>
    );
  }
  if (dirty) return <span className="text-2xs text-muted-foreground">{t("pending")}</span>;
  if (state.savedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground" aria-live="polite">
        <Check className="h-3.5 w-3.5 text-healthy-ink" weight="bold" />
        {t("saved", { time: format.dateTime(new Date(state.savedAt), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) })}
      </span>
    );
  }
  return <span className="text-2xs text-muted-foreground">{t("upToDate")}</span>;
}
