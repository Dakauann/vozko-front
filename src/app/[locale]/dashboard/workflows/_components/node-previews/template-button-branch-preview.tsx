"use client";

import { useTranslations } from "next-intl";

import { DecisionBlock } from "./decision-block";

export function TemplateButtonBranchPreview({ index }: { index: number }) {
  const t = useTranslations("workflowsPage.templateButton");
  return <DecisionBlock>{t("preview", { position: index + 1 })}</DecisionBlock>;
}
