"use client";

import { useTranslations } from "next-intl";

import { Notice } from "@/components/ui/notice";

export function OptOutNotice() {
  const t = useTranslations("templateExit.optOutNotice");
  return (
    <Notice tone="info" title={t("title")}>
      <p className="text-muted-foreground">{t("body")}</p>
    </Notice>
  );
}
