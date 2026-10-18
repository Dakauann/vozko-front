"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Notice } from "@/components/ui/notice";
import { exitWordsLabel, isExitKind, type ExitVerdict } from "@/lib/whatsapp-templates/exit";

import { useButtonActionLabel } from "./use-button-action-label";

function ConfiguredExits({ verdict }: { verdict: ExitVerdict }) {
  const t = useTranslations("templateExit.verdict");
  const labelOf = useButtonActionLabel();
  const exitButtons = verdict.buttons.filter((button) => button.action && !button.stale && isExitKind(button.action.kind));
  return (
    <ul className="space-y-0.5 text-muted-foreground">
      {exitButtons.map((button) => (
        <li key={button.index}>{t("buttonExit", { text: button.text, action: labelOf(button.action) })}</li>
      ))}
      {verdict.exitWords.length > 0 ? <li>{t("shownWords", { words: exitWordsLabel(verdict.exitWords) })}</li> : null}
    </ul>
  );
}

export function ExitVerdictNotice({
  verdict,
  title,
  quiet = false,
  children,
}: {
  verdict: ExitVerdict;
  title?: string;
  quiet?: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations("templateExit.verdict");
  if (verdict.state === "ok") {
    return (
      <Notice tone="healthy" title={title ?? t("ok")}>
        <ConfiguredExits verdict={verdict} />
        {children}
      </Notice>
    );
  }
  return (
    <Notice tone={quiet ? "info" : "warning"} title={title ?? t("none")}>
      <p className="text-muted-foreground">{t("noneDescription")}</p>
      {children}
    </Notice>
  );
}
