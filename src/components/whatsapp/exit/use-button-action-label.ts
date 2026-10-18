"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import type { ButtonActionChoice } from "@/lib/whatsapp-templates/exit";

export function useButtonActionLabel() {
  const t = useTranslations("templateExit");
  return useCallback((action: Pick<ButtonActionChoice, "kind"> | null | undefined) => (action ? t(`kinds.${action.kind}`) : t("builder.noAction")), [t]);
}
