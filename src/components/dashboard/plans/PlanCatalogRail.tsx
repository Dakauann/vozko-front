"use client";

import * as React from "react";

import {
  Brain,
  ChatCircle,
  Check,
  Microphone,
  Package,
  Phone,
  SpeakerHigh,
  WhatsappLogo,
} from "@phosphor-icons/react";
import {
  estimateCallMinutesFromPlan,
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
  channels: string;
  noDescription: string;
  perMonth?: string;
  categoryNames?: Record<string, string>;
  messagesLabel?: string;
  minutesLabel?: string;
  serviceLabels?: Record<string, Record<string, string>>;
}

const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  whatsapp: <WhatsappLogo className="h-3 w-3" weight="fill" />,
  telephony: <Phone className="h-3 w-3" weight="fill" />,
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
              .filter((i) => i.category !== "exchange_rate")
              .map((i) => i.category),
          ),
        ];
        const cardClassName = cn(
          "min-w-[262px] max-w-[262px] snap-start rounded-[24px] border border-border/70 bg-card/95 p-4 text-left transition-all",
          onSelect &&
            "cursor-pointer hover:border-primary/35 hover:bg-background active:scale-[0.995]",
          isSelected &&
            "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.18)]",
        );
        const content = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
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

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase text-white",
                      isCurrent ? "bg-emerald-500" : "bg-slate-900",
                    )}
                  >
                    {isCurrent ? labels.current : labels.available}
                  </span>
                  {isBest ? (
                    <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-semibold uppercase text-white">
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
              <span className="text-2xl font-bold text-foreground">
                {formatBRLFromCents(item.plan.basePriceBRLCents, locale)}
              </span>
              <span className="text-xs text-muted-foreground">
                {labels.perMonth}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                  weight="bold"
                />
                <span>
                  <span className="font-semibold">
                    {item.plan.maxCallChannels}
                  </span>{" "}
                  {labels.channels}
                </span>
              </div>
              {pricingCategories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-emerald-500"
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
    <WhatsappLogo className="h-3 w-3 shrink-0 text-emerald-500" weight="fill" />
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
  const callEstimate = React.useMemo(
    () => estimateCallMinutesFromPlan(basePriceBRLCents, items, exchangeRate),
    [basePriceBRLCents, items, exchangeRate],
  );

  if (msgEstimates.length === 0 && !callEstimate) return null;

  return (
    <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
      {msgEstimates.map((est) => (
        <div
          key={`${est.category}-${est.service}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {RAIL_ICON_MAP[est.category] ?? (
            <ChatCircle
              className="h-3 w-3 shrink-0 text-emerald-500"
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
      {callEstimate ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0 text-blue-500" weight="fill" />
          <span>
            ~{formatEstimateNumber(callEstimate, locale)}{" "}
            {labels.minutesLabel ?? "call min."}
          </span>
        </div>
      ) : null}
    </div>
  );
}
