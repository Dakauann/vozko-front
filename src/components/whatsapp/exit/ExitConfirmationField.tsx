"use client";

import { useTranslations } from "next-intl";

import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";

export function ExitConfirmationField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const t = useTranslations("templateExit.confirmation");
  return (
    <div className="space-y-1.5">
      <ElevatedTextarea label={t("label")} value={value} rows={2} onChange={(event) => onChange(event.target.value)} />
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
