"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Check, Crown, Sparkle } from "@/components/icons";
import GrainBackground, { type ColorGroup } from "@/components/elevated-design/grain-background";
import { formatCentsAsBrl } from "@/lib/format/money";
import { planHighlights, type FeaturedKind, type PlanHighlight } from "@/lib/workspace-plan/catalog";
import type { PlanDefinition } from "@/lib/workspace-plan/types";
import { cn } from "@/lib/utils";

const HIGHLIGHTED_WASH: ColorGroup[] = [
  { colors: ["#99f6e4", "#5eead4"], weight: 40 },
  { colors: ["#a7f3d0", "#6ee7b7"], weight: 35 },
  { colors: ["#ccfbf1", "#f0fdfa"], weight: 25 },
];

const STANDARD_WASH: ColorGroup[] = [
  { colors: ["#e2e8f0", "#cbd5e1"], weight: 45 },
  { colors: ["#f1f5f9", "#e2e8f0"], weight: 35 },
  { colors: ["#ccfbf1", "#e2e8f0"], weight: 20 },
];

interface PlanCardProps {
  plan: PlanDefinition;
  locale: string;
  featured?: FeaturedKind | null;
  current?: boolean;
  selected?: boolean;
  onShowDetails?: () => void;
  action?: ReactNode;
  brand?: ReactNode;
  className?: string;
}

export function PlanCard({ plan, locale, featured, current, selected, onShowDetails, action, brand, className }: PlanCardProps) {
  const t = useTranslations("plansPage");
  const badges = useTranslations("pricing");
  const headingId = `plan-card-${plan.id}`;
  const FeaturedIcon = featured === "exclusive" ? Sparkle : Crown;
  const highlighted = Boolean(featured || current);
  const description = plan.description?.trim();

  return (
    <div
      className={cn(
        "h-full rounded-[calc(var(--radius)+2px)] p-[1.5px]",
        selected ? "bg-primary" : featured ? "plan-card-ring" : "bg-border",
        className,
      )}
    >
      <article aria-labelledby={headingId} aria-current={selected ? "true" : undefined} className="flex h-full flex-col overflow-hidden rounded-[--radius] bg-card">
        <div className="relative isolate overflow-hidden border-b border-border">
          <GrainBackground
            palette={highlighted ? HIGHLIGHTED_WASH : STANDARD_WASH}
            seed={seedOf(plan.id)}
            mode="islands"
            islandsScale={0.012}
            islandsElongation={0.85}
            islandsWarp={10}
            islandsBlur={2}
            opacity={0.1}
            className="absolute inset-0 -z-10 !rounded-none"
          />
          <div className="flex flex-col gap-4 p-5">
            <div className="flex min-h-[1.375rem] flex-wrap items-center gap-1.5">
              {current ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-2xs font-semibold text-primary-foreground">
                  <Check className="h-3 w-3" weight="bold" aria-hidden />
                  {t("list.current")}
                </span>
              ) : null}
              {featured ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-2xs font-semibold text-foreground">
                  <FeaturedIcon className="h-3 w-3 text-primary-ink" weight="fill" aria-hidden />
                  {badges(featured)}
                </span>
              ) : null}
            </div>
            <div>
              <h3 id={headingId} className="truncate font-display text-lg font-semibold text-foreground">
                {plan.name}
              </h3>
              {description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            <p className="flex items-baseline gap-1">
              <span className="readout font-display text-4xl font-semibold tracking-[-0.02em] text-foreground">
                {formatCentsAsBrl(plan.basePriceBRLCents, locale)}
              </span>
              <span className="text-sm text-muted-foreground">{t("detail.perMonth")}</span>
            </p>
            {brand ? <div>{brand}</div> : null}
            {action ? <div>{action}</div> : null}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <p className="text-sm font-medium text-foreground">{t("card.includes")}</p>
          <ul className="mt-3 space-y-2.5">
            {planHighlights(plan).map((highlight) => (
              <li key={highlightKey(highlight)} className="flex items-start gap-2.5 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" weight="bold" aria-hidden />
                <span>{highlightText(highlight, t, locale)}</span>
              </li>
            ))}
          </ul>

          {onShowDetails ? (
            <button
              type="button"
              onClick={onShowDetails}
              aria-expanded={selected}
              className="mt-auto self-start pt-5 text-sm font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("card.details")}
            </button>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function seedOf(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 1000;
}

function highlightKey(highlight: PlanHighlight): string {
  return highlight.kind === "category" ? `category-${highlight.category}` : highlight.kind;
}

type PlansTranslate = ReturnType<typeof useTranslations<"plansPage">>;

function highlightText(highlight: PlanHighlight, t: PlansTranslate, locale: string): string {
  switch (highlight.kind) {
    case "balance":
      return t("card.balance", { amount: formatCentsAsBrl(highlight.cents, locale) });
    case "whatsappNumbers":
      return t("card.whatsappNumbers", { count: highlight.count });
    case "voices":
      return t("card.voices", { count: highlight.count });
    case "category": {
      const key = `card.services.${highlight.category}` as const;
      return t.has(key) ? t(key) : highlight.category;
    }
  }
}
