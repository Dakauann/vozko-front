"use client";

import { useTranslations } from "next-intl";

import { ShieldCheck } from "@/components/icons";

export function HashingNote() {
  const t = useTranslations("adsAudiences.hashing");
  return (
    <div className="flex items-start gap-2.5 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-healthy-ink" aria-hidden />
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("body")}</p>
      </div>
    </div>
  );
}
