"use client";

import { useLocale, useTranslations } from "next-intl";

import { compactAge } from "@/lib/crm/compact-age";

export function useCompactAgeText(): (isoDate: string) => string {
  const t = useTranslations("crmKanban.age");
  const locale = useLocale();
  return (isoDate) => {
    const age = compactAge(isoDate);
    if (!age) return "";
    if (age.unit === "date") return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(age.date);
    if (age.unit === "now") return t("now");
    return t(age.unit, { value: age.value });
  };
}
