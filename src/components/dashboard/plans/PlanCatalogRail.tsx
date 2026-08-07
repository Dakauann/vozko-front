"use client";

import * as React from "react";

import {
  Brain,
  ChatCircle,
  Check,
  Microphone,
  Package,
  SpeakerHigh,
  WhatsappLogo,
} from "@/components/icons";
import {
  estimateMessagesByType,
  formatEstimateNumber,
} from "./plan-estimates";

import type { PublicPlanDetails } from "@/lib/workspace-plan/types";
import { cn } from "@/lib/utils";
import { formatPricingServiceFallback } from "@/lib/branding/ai-models";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";

function formatBRLFromCents(cents: number, locale: string) {
  return new Intl.NumberFormat(locale === "pt" ? "pt-BR" : locale, {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

interface PlanCatalogRailLabels {
  current: string;
  available: string;
  best: string;
  basePrice: string;
  noDescription: string;
  perMonth?: string;
  categoryNames?: Record<string, string>;
  messagesLabel?: string;
  serviceLabels?: Record<string, Record<string, string>>;
}

const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  whatsapp: <WhatsappLogo className="h-3 w-3" weight="fill" />,
  stt: <Microphone className="h-3 w-3" weight="fill" />,
  tts: <SpeakerHigh className="h-3 w-3" weight="fill" />,
  llm: <Brain className="h-3 w-3" weight="fill" />,
};

interface PlanCatalogRailProps {
  plans: PublicPlanDetails[];
  locale: string;
  labels: PlanCatalogRailLabels;
  className?: string;
  currentPlanName?: string | null;
  selectedPlanId?: string | null;
  onSelect?: (planId: string) => void;
  exchangeRate?: number;
}

export function PlanCatalogRail({
  plans,
  locale,
  labels,
  className,
  currentPlanName,
  selectedPlanId,
  onSelect,
  exchangeRate = 6.0,
}: PlanCatalogRailProps) {
  const orderedPlans = React.useMemo(
    () =>
      [...plans].sort(
        (left, right) =>
          left.plan.basePriceBRLCents - right.plan.basePriceBRLCents,
      ),
    [plans],
  );

  const normalizedCurrentPlanName = currentPlanName?.trim().toLowerCase();

  return (
    <div
      className={cn(
        "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-1",
        className,
      )}
    >
      {orderedPlans.map((item, index) => {
        const isBest =
          orderedPlans.length > 1 && index === orderedPlans.length - 1;
        const isCurrent =
          normalizedCurrentPlanName != null &&
          item.plan.name.trim().toLowerCase() === normalizedCurrentPlanName;
        const isSelected = selectedPlanId === item.plan.id;
        const description = item.plan.description || labels.noDescription;
        const pricingCategories = [
          ...new Set(
            (item.plan.pricingItems ?? [])
              .filter(
                (i) =>
                  i.category !== "exchange_rate" && i.category !== "telephony",
              )
              .map((i) => i.category),
          ),
        ];
        const cardClassName = cn(
          "min-w-[262px] max-w-[262px] snap-start rounded-[--radius] border border-border bg-card p-4 text-left transition-all",
          onSelect && "cursor-pointer hover:bg-muted active:translate-y-px",
          isSelected && "border-t-[3px] border-t-lamp bg-muted",
        );
        const content = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted text-foreground">
                    <Package className="h-5 w-5" weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.plan.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatBRLFromCents(item.plan.basePriceBRLCents, locale)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex min-h-[52px] flex-wrap content-start gap-2">
                  <span
                    className={cn(
                      "rounded-lg legend border border-border bg-background px-1.5 py-1",
                      isCurrent ? "text-primary-ink" : "text-muted-foreground",
                    )}
                  >
                    {isCurrent ? labels.current : labels.available}
                  </span>
                  {isBest ? (
                    <span className="rounded-lg legend border border-border bg-muted px-1.5 py-1 text-foreground">
                      {labels.best}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="mt-4 min-h-[40px] line-clamp-2 text-sm leading-6 text-muted-foreground">
              {description}
            </p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-foreground">
                {formatBRLFromCents(item.plan.basePriceBRLCents, locale)}
              </span>
              <span className="text-xs text-muted-foreground">
                {labels.perMonth}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {pricingCategories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-healthy-ink"
                    weight="bold"
                  />
                  <span className="flex items-center gap-1.5">
                    {CATEGORY_ICON_MAP[cat] ?? (
                      <Package className="h-3 w-3" weight="fill" />
                    )}
                    {labels.categoryNames?.[cat] ?? cat}
                  </span>
                </div>
              ))}
            </div>

            <RailEstimateBadges
              basePriceBRLCents={item.plan.basePriceBRLCents}
              items={item.plan.pricingItems ?? []}
              exchangeRate={exchangeRate}
              locale={locale}
              labels={labels}
            />
          </>
        );

        if (!onSelect) {
          return (
            <div
              key={item.plan.id}
              className={cardClassName}
              style={{ boxShadow: softSurfaceShadow }}
            >
              {content}
            </div>
          );
        }

        return (
          <button
            key={item.plan.id}
            type="button"
            className={cardClassName}
            onClick={() => onSelect(item.plan.id)}
            style={{ boxShadow: softSurfaceShadow }}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}


const RAIL_ICON_MAP: Record<string, React.ReactNode> = {
  whatsapp: (
    <WhatsappLogo className="h-3 w-3 shrink-0 text-healthy-ink" weight="fill" />
  ),
};

function RailEstimateBadges({
  basePriceBRLCents,
  items,
  exchangeRate,
  locale,
  labels,
}: {
  basePriceBRLCents: number;
  items: {
    category: string;
    service: string;
    metric: string;
    priceMicros: number;
  }[];
  exchangeRate: number;
  locale: string;
  labels: PlanCatalogRailLabels;
}) {
  const msgEstimates = React.useMemo(
    () => estimateMessagesByType(basePriceBRLCents, items, exchangeRate),
    [basePriceBRLCents, items, exchangeRate],
  );
  if (msgEstimates.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5 border-t border-border pt-3">
      {msgEstimates.map((est) => (
        <div
          key={`${est.category}-${est.service}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {RAIL_ICON_MAP[est.category] ?? (
            <ChatCircle
              className="h-3 w-3 shrink-0 text-healthy-ink"
              weight="fill"
            />
          )}
          <span>
            ~{formatEstimateNumber(est.count, locale)}{" "}
            {labels.serviceLabels?.[est.category]?.[est.service] ??
              formatPricingServiceFallback(est.service) ??
              labels.messagesLabel ??
              "messages"}
          </span>
        </div>
      ))}
    </div>
  );
}
