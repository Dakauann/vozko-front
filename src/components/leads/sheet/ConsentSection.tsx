"use client";

import { useFormatter, useTranslations } from "next-intl";

import { ShieldCheck } from "@/components/icons";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { translatedLabel } from "@/lib/format/translated-label";
import { instantOf } from "@/lib/leads/detail";
import type { LeadConsent } from "@/lib/leads/types";

import { SheetHint, SheetSection, useSheetFieldId } from "./SheetSection";

export function ConsentSection({
  optIn,
  recorded,
  optedOutAt,
  onChange,
}: {
  optIn: boolean;
  recorded: LeadConsent | null;
  optedOutAt: string | null;
  onChange: (optIn: boolean) => void;
}) {
  const t = useTranslations("leadSheet.consent");
  const fieldId = useSheetFieldId();
  const format = useFormatter();
  const source = recorded && optIn ? translatedLabel(t, `sources.${recorded.source}`, "sources.other") : null;
  const optedOut = instantOf(optedOutAt);

  return (
    <SheetSection icon={<ShieldCheck />} title={t("title")} anchor="consent">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-1">
        <ElevatedSwitch id={fieldId("opt-in")} label={t("optIn")} checked={optIn} onCheckedChange={(checked) => onChange(checked)} explainer={<ExplainerHint id="crm.whatsappOptIn" />} />
        {source ? <span className="text-sm text-muted-foreground">{t("source", { source })}</span> : null}
      </div>
      {optedOut ? <SheetHint tone="info">{t("optedOut", { date: format.dateTime(optedOut, { dateStyle: "medium" }) })}</SheetHint> : null}
      <SheetHint>{t("hint")}</SheetHint>
    </SheetSection>
  );
}
