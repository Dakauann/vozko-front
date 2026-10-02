"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ArrowRight, Plus } from "@/components/icons";
import { EMPTY_VALUE } from "@/lib/advertising/money";
import type { AdAccount } from "@/lib/advertising/types";
import type { StoredWizard } from "@/lib/advertising/wizard-storage";
import { formatWhen } from "@/lib/advertising/when";

import { useAdsFormat } from "../use-ads-format";
import { ReadOnlyFact } from "./choice-row";
import { useWizardLabels } from "./use-wizard-labels";

export function DraftChoice({
  stored,
  accounts,
  onContinue,
  onStartOver,
}: {
  stored: StoredWizard;
  accounts: AdAccount[];
  onContinue: () => void;
  onStartOver: () => void;
}) {
  const t = useTranslations("adsWizard.draftChoice");
  const tSteps = useTranslations("adsWizard.steps");
  const fmt = useAdsFormat();
  const labels = useWizardLabels();
  const { form } = stored;
  const account = accounts.find((candidate) => candidate.id === form.accountId);
  const campaign = (form.mode === "new" ? form.campaignName : form.campaignParent?.name)?.trim();

  return (
    <section className="max-w-2xl space-y-4 rounded-[--radius] border border-border bg-card p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-semibold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{stored.savedAt ? t("savedAt", { when: formatWhen(stored.savedAt, fmt.tag) }) : t("saved")}</p>
      </div>
      <dl className="divide-y divide-border rounded-[--radius] border border-border px-3">
        <ReadOnlyFact label={t("account")} value={account ? `${account.name} · ${account.currency}` : EMPTY_VALUE} />
        <ReadOnlyFact label={t("objective")} value={labels.objective(form.objective) || EMPTY_VALUE} />
        <ReadOnlyFact label={t("campaign")} value={campaign || EMPTY_VALUE} />
        <ReadOnlyFact label={t("ads")} value={<span className="tabular-nums">{form.ads.length}</span>} />
        <ReadOnlyFact label={t("step")} value={tSteps(stored.step)} />
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" title={t("continue")} icon={<ArrowRight className="h-4 w-4" />} iconVisible iconSide="right" onClick={onContinue} />
        <Button variant="secondary" title={t("startOver")} icon={<Plus className="h-4 w-4" />} iconVisible iconSide="left" onClick={onStartOver} />
      </div>
      <p className="text-xs text-muted-foreground">{t("startOverHint")}</p>
    </section>
  );
}
