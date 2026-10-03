"use client";

import { useTranslations } from "next-intl";

import { MAX_AGE } from "@/lib/advertising/draft";
import type { AnalysisFact, AnalysisSection, AnalysisValue, LabelGroup } from "@/lib/advertising/editor-analysis";
import type { MultiFact } from "@/lib/advertising/editor-multi";
import type { EditorNode } from "@/lib/advertising/editor-tree";

import { useAdsFormat } from "../use-ads-format";
import { ReadOnlyFact } from "../wizard/choice-row";
import { useNodeLabel } from "../wizard/publish-check";
import { useWizardLabels } from "../wizard/use-wizard-labels";

function useValueText(currency: string) {
  const t = useTranslations("adsEditor.analysis");
  const tReview = useTranslations("adsWizard.review");
  const tAudience = useTranslations("adsWizard.audience");
  const tCampaign = useTranslations("adsWizard.campaign");
  const tBudget = useTranslations("adsWizard.budget");
  const tCreate = useTranslations("adsCreate");
  const labels = useWizardLabels();
  const fmt = useAdsFormat();

  const label = (group: LabelGroup, value: string): string => {
    switch (group) {
      case "objective":
        return labels.objective(value);
      case "destination":
        return labels.destination(value);
      case "goal":
        return labels.goal(value);
      case "format":
        return labels.format(value);
      case "callToAction":
        return labels.callToAction(value);
      case "category":
        return tCampaign.has(`categories.${value}`) ? tCampaign(`categories.${value}`) : value;
      case "bidStrategy":
        return tBudget.has(`strategies.${value}`) ? tBudget(`strategies.${value}`) : value;
      case "buyingType":
        return tCreate("auction");
      case "budgetStrategy":
        return t(`budgetStrategies.${value}`);
    }
  };

  return (value: AnalysisValue): string => {
    switch (value.kind) {
      case "text":
        return value.text;
      case "label":
        return label(value.group, value.value);
      case "budget": {
        const amount = fmt.minor(value.budget.amount, currency);
        return value.budget.kind === "DAILY" ? tReview("budgetDaily", { amount }) : tReview("budgetLifetime", { amount });
      }
      case "budgetElsewhere":
        return t(`budgetPlaces.${value.place}`);
      case "dates": {
        const start = value.startDay ? tReview("startsOn", { day: value.startDay }) : tReview("startsNow");
        const end = value.endDay ? tReview("endsOn", { day: value.endDay }) : tReview("noEnd");
        return [start, end, value.hours ? tReview("hours") : ""].filter(Boolean).join(" · ");
      }
      case "ages": {
        const max = value.max === MAX_AGE ? tAudience("agePlus", { age: MAX_AGE }) : String(value.max);
        const ages = tReview("ages", { min: value.min, max });
        return value.advantage ? `${ages} · ${tAudience("advantage")}` : ages;
      }
      case "list":
        return value.items.join("; ");
      case "placements":
        return value.platforms === null ? tReview("placementsAuto") : value.platforms.map(labels.placement).join(", ") || t("empty");
      case "empty":
        return t("empty");
    }
  };
}

function FactValue({ value, text }: { value: AnalysisValue; text: (value: AnalysisValue) => string }) {
  return <span className={value.kind === "empty" ? "text-muted-foreground" : "tabular-nums"}>{text(value)}</span>;
}

export function AnalysisFacts({ facts, currency }: { facts: AnalysisFact[]; currency: string }) {
  const t = useTranslations("adsEditor.analysis.facts");
  const text = useValueText(currency);
  return (
    <dl className="divide-y divide-border">
      {facts.map((fact) => (
        <ReadOnlyFact key={fact.key} label={t(fact.key)} value={<FactValue value={fact.value} text={text} />} />
      ))}
    </dl>
  );
}

export function MultiAnalysisFacts({ facts, currency }: { facts: MultiFact[]; currency: string }) {
  const t = useTranslations("adsEditor.analysis.facts");
  const tMulti = useTranslations("adsEditor.multi");
  const text = useValueText(currency);
  return (
    <dl className="divide-y divide-border">
      {facts.map(({ key, state }) => (
        <ReadOnlyFact
          key={key}
          label={t(key)}
          value={
            state.kind === "same" ? (
              <FactValue value={state.value} text={text} />
            ) : (
              <details className="group">
                <summary className="cursor-pointer font-medium text-foreground marker:text-muted-foreground">{tMulti("mixedValues")}</summary>
                <ul className="mt-1.5 space-y-1">
                  {state.values.map((entry) => (
                    <li key={entry.metaId} className="grid grid-cols-[minmax(0,8rem)_1fr] gap-2 text-xs">
                      <span className="truncate text-muted-foreground">{entry.name || entry.metaId}</span>
                      <FactValue value={entry.value} text={text} />
                    </li>
                  ))}
                </ul>
              </details>
            )
          }
        />
      ))}
    </dl>
  );
}

export function DraftAnalysisView({
  sections,
  currency,
  onOpen,
}: {
  sections: AnalysisSection[];
  currency: string;
  onOpen: (node: EditorNode) => void;
}) {
  const t = useTranslations("adsEditor.analysis");
  const nodeLabel = useNodeLabel();
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={nodeLabel(section.node)} className="space-y-2 rounded-[--radius] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-foreground">{nodeLabel(section.node)}</h3>
            <button type="button" onClick={() => onOpen(section.node)} className="text-xs font-semibold text-primary-ink hover:underline">
              {t("edit")}
            </button>
          </div>
          <AnalysisFacts facts={section.facts} currency={currency} />
        </section>
      ))}
    </div>
  );
}
