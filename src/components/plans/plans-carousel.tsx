"use client";

import * as React from "react";

import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CaretDown,
  Check,
  Crown,
  Microphone,
  Package,
  Phone,
  Sparkle,
  SpeakerHigh,
  WhatsappLogo,
} from "@phosphor-icons/react";
import type {
  PlanPricingItem,
  PublicPlanDetails,
} from "@/lib/workspace-plan/types";
import {
  formatPricingServiceFallback,
} from "@/lib/branding/ai-models";

import Button from "@/components/elevated-design/button";
import Image from "next/image";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";
import { useTranslations } from "next-intl";

export interface AffiliateBrand {
  code: string;
  brandName?: string;
  brandLogoUrl?: string;
}

type Billing = "monthly" | "annual";
type FeaturedLabel = "popular" | "exclusive" | null;

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  whatsapp: <WhatsappLogo className="h-3.5 w-3.5" weight="fill" />,
  telephony: <Phone className="h-3.5 w-3.5" weight="fill" />,
  stt: <Microphone className="h-3.5 w-3.5" weight="fill" />,
  tts: <SpeakerHigh className="h-3.5 w-3.5" weight="fill" />,
  llm: <Brain className="h-3.5 w-3.5" weight="fill" />,
};

const CATEGORY_ORDER = ["whatsapp", "telephony", "tts", "stt", "llm"];

const METRIC_KEY: Record<string, string> = {
  per_message: "perMessage",
  per_minute: "perMinute",
  per_hour: "perHour",
  per_million_chars: "per1MChars",
  percentage: "aiMarkup",
};

const MICROS = 1_000_000;

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatServicePrice(
  item: PlanPricingItem,
  exchangeRate: number,
): string {
  // Markup-based (percentage) rows are filtered out before rendering (see groupByCategory): a customer
  // must never see our markup. Only final per-unit prices are shown here.
  const usd = item.priceMicros / MICROS;
  const brl = usd * exchangeRate;
  if (brl < 0.01) {
    return `R$ ${brl.toFixed(4)}`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(brl);
}

function groupByCategory(
  items: PlanPricingItem[],
): Map<string, PlanPricingItem[]> {
  const map = new Map<string, PlanPricingItem[]>();
  for (const item of items) {
    // Skip internal-only rows and markup-based (percentage) pricing: customers see final prices only,
    // never our markup. The backend also strips markupPct/costMicros from customer plan responses.
    if (
      item.category === "exchange_rate" ||
      item.category === "margin" ||
      item.metric === "percentage"
    )
      continue;
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  const sorted = new Map<string, PlanPricingItem[]>();
  for (const cat of CATEGORY_ORDER) {
    if (map.has(cat)) sorted.set(cat, map.get(cat)!);
  }
  for (const [cat, items] of map) {
    if (!sorted.has(cat)) sorted.set(cat, items);
  }
  return sorted;
}

function ServicePricingGroup({
  category,
  items,
  exchangeRate,
  t,
}: {
  category: string;
  items: PlanPricingItem[];
  exchangeRate: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const [open, setOpen] = React.useState(true);

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground"
      >
        <span className="flex items-center gap-1.5 flex-1">
          {CATEGORY_ICON[category] ?? (
            <Package className="h-3.5 w-3.5" weight="fill" />
          )}
          {t(`categories.${category}` as Parameters<typeof t>[0]) || category}
        </span>
        <CaretDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          weight="bold"
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-2.5 space-y-1.5">
            {items.map((item) => {
              const serviceKey = item.service;

              let serviceLabel: string;
              try {
                serviceLabel = t(
                  `services.${serviceKey}` as Parameters<typeof t>[0],
                );
              } catch {
                serviceLabel =
                  formatPricingServiceFallback(item.service) || item.service;
              }

              let metricLabel: string;
              try {
                metricLabel = t(
                  METRIC_KEY[item.metric] as Parameters<typeof t>[0],
                );
              } catch {
                metricLabel = item.metric;
              }

              return (
                <div
                  key={`${item.category}-${item.service}`}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-muted-foreground truncate">
                    {serviceLabel}
                  </span>
                  <span className="shrink-0 font-mono text-foreground">
                    {formatServicePrice(item, exchangeRate)}{" "}
                    <span className="text-muted-foreground font-sans">
                      {metricLabel}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PlanCardProps {
  item: PublicPlanDetails;
  featured: boolean;
  featuredLabel: FeaturedLabel;
  exchangeRate: number;
  billing: Billing;
  affiliateBrand?: AffiliateBrand | null;
  isCurrent?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  onSelect?: (plan: PublicPlanDetails) => void;
  t: ReturnType<typeof useTranslations>;
}

function PlanCard({
  item,
  featured,
  featuredLabel,
  exchangeRate,
  billing,
  affiliateBrand,
  isCurrent,
  ctaLabel,
  ctaHref,
  onSelect,
  t,
}: PlanCardProps) {
  const baseCents = item.plan.basePriceBRLCents;
  const pricingGroups = React.useMemo(
    () => groupByCategory(item.plan.pricingItems ?? []),
    [item.plan.pricingItems],
  );

  const resolvedCtaLabel = isCurrent
    ? t("currentPlan")
    : (ctaLabel ?? t("ctaPaid"));
  const resolvedCtaHref = isCurrent
    ? undefined
    : (ctaHref ?? "/login?redirect=/dashboard/plans");
  const handleCtaClick = React.useCallback(() => {
    if (isCurrent || !onSelect) return;
    onSelect(item);
  }, [isCurrent, onSelect, item]);

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border p-6 md:p-7",
        featured
          ? "border-primary bg-primary/[0.03] shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_20px_60px_-20px_hsl(var(--primary)/0.3)]"
          : "border-border bg-card",
      )}
    >
      {featuredLabel && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-md">
            {featuredLabel === "exclusive" ? (
              <Sparkle className="h-3 w-3" weight="fill" />
            ) : (
              <Crown className="h-3 w-3" weight="fill" />
            )}
            {featuredLabel === "exclusive" ? t("exclusive") : t("popular")}
          </span>
        </div>
      )}

      <div className={cn(featuredLabel && "mt-2")}>
        {/* Brand block: render for every exclusive plan, not just the
            featured one. `featuredLabel` is a carousel-level marker that
            highlights a single card; gating the brand on it would hide the
            logo on the remaining exclusive plans when an affiliate owns
            more than one. */}
        {!!item.plan.exclusiveAffiliateId && affiliateBrand && (
          <div className="mb-4 flex items-center gap-3 border-b border-border/60 pb-3">
            <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
              {affiliateBrand.brandLogoUrl ? (
                <Image
                  src={affiliateBrand.brandLogoUrl}
                  alt={affiliateBrand.brandName || affiliateBrand.code}
                  fill
                  sizes="36px"
                  unoptimized
                  className="object-contain"
                />
              ) : (
                <Sparkle className="h-5 w-5 text-foreground/70" weight="fill" />
              )}
            </span>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("exclusivePartner")}
              </span>
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                {affiliateBrand.brandName || affiliateBrand.code}
              </span>
            </div>
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xl font-bold text-foreground">
            {item.plan.name}
          </h3>
          {isCurrent && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" weight="bold" />
              {t("currentBadge")}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
          {item.plan.description || t("noDescription")}
        </p>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tracking-tight text-foreground">
            {formatBRL(baseCents)}
          </span>
          <span className="text-sm text-muted-foreground">
            /{t("perMonth")}
          </span>
        </div>
        {billing === "annual" && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("billedAnnually")}
          </p>
        )}
      </div>

      <div className="mt-6">
        <Button
          variant={featured ? "primary" : "outline"}
          title={resolvedCtaLabel}
          icon={<ArrowRight className="h-4 w-4" weight="bold" />}
          iconVisible={!isCurrent}
          iconSide="right"
          link={onSelect ? undefined : resolvedCtaHref}
          onClick={onSelect ? handleCtaClick : undefined}
          newTab={false}
          disabled={isCurrent}
          className="w-full justify-center"
        />
      </div>

      <div className="my-6 h-px bg-border" />

      <div className="flex-1 space-y-4">
        <div className="flex items-start gap-3">
          <Check
            className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5"
            weight="bold"
          />
          <span className="text-sm text-foreground">
            <span className="font-semibold">{item.plan.maxCallChannels}</span>{" "}
            {t("channels")}
          </span>
        </div>

        {pricingGroups.size > 0 && (
          <>
            <div className="h-px bg-border/50" />
            <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">
              {t("servicePricing")}
            </p>
            <div className="space-y-2">
              {[...pricingGroups.entries()].map(([cat, items]) => (
                <ServicePricingGroup
                  key={cat}
                  category={cat}
                  items={items}
                  exchangeRate={exchangeRate}
                  t={t}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AffiliateBrandChip({ brand }: { brand: AffiliateBrand }) {
  const t = useTranslations("pricing");
  const name = brand.brandName?.trim() || brand.code;
  const logo = brand.brandLogoUrl?.trim();
  return (
    <div
      className="inline-flex items-center gap-3"
      aria-label={`${t("exclusivePartner")}: ${name}`}
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center">
        {logo ? (
          <Image
            src={logo}
            alt={name}
            fill
            sizes="36px"
            unoptimized
            className="object-contain"
          />
        ) : (
          <Sparkle className="h-5 w-5 text-foreground/70" weight="fill" />
        )}
      </span>
      <div className="flex flex-col leading-tight text-left">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("exclusivePartner")}
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          {name}
        </span>
      </div>
    </div>
  );
}

export interface PlansCarouselProps {
  plans: PublicPlanDetails[];
  exchangeRate?: number;
  affiliateBrand?: AffiliateBrand | null;
  showBillingToggle?: boolean;
  currentPlanId?: string | null;
  currentPlanName?: string | null;
  ctaLabel?: string;
  ctaHref?: string;
  onSelectPlan?: (plan: PublicPlanDetails) => void;
  className?: string;
}

export function PlansCarousel({
  plans,
  exchangeRate = 6.0,
  affiliateBrand,
  showBillingToggle = true,
  currentPlanId,
  currentPlanName,
  ctaLabel,
  ctaHref,
  onSelectPlan,
  className,
}: PlansCarouselProps) {
  const t = useTranslations("pricing");
  const [billing, setBilling] = React.useState<Billing>("monthly");

  const normalizedCurrentName = React.useMemo(
    () => currentPlanName?.trim().toLowerCase() || null,
    [currentPlanName],
  );

  const sortedPlans = React.useMemo(
    () =>
      [...plans]
        .filter((p) => !p.plan.archivedAt)
        .sort((a, b) => a.plan.basePriceBRLCents - b.plan.basePriceBRLCents),
    [plans],
  );

  const { featuredIndex, featuredLabel } = React.useMemo(() => {
    if (sortedPlans.length === 0) {
      return { featuredIndex: -1, featuredLabel: null as FeaturedLabel };
    }
    const exclusiveIdx = sortedPlans.findIndex(
      (p) => !!p.plan.exclusiveAffiliateId,
    );
    if (exclusiveIdx >= 0) {
      return {
        featuredIndex: exclusiveIdx,
        featuredLabel: "exclusive" as FeaturedLabel,
      };
    }
    if (sortedPlans.length === 1) {
      return { featuredIndex: 0, featuredLabel: "popular" as FeaturedLabel };
    }
    if (sortedPlans.length === 2) {
      return { featuredIndex: 1, featuredLabel: "popular" as FeaturedLabel };
    }
    return {
      featuredIndex: Math.floor(sortedPlans.length / 2),
      featuredLabel: "popular" as FeaturedLabel,
    };
  }, [sortedPlans]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    loop: false,
    containScroll: false,
    skipSnaps: false,
    startIndex: Math.max(0, featuredIndex),
  });

  const [selectedIndex, setSelectedIndex] = React.useState(
    Math.max(0, featuredIndex),
  );
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);

  const onSelect = React.useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  React.useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  React.useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit({
      align: "center",
      loop: false,
      containScroll: false,
      skipSnaps: false,
      startIndex: Math.max(0, featuredIndex),
    });
  }, [emblaApi, sortedPlans.length, featuredIndex]);

  const scrollTo = React.useCallback(
    (i: number) => emblaApi?.scrollTo(i),
    [emblaApi],
  );
  const scrollPrev = React.useCallback(
    () => emblaApi?.scrollPrev(),
    [emblaApi],
  );
  const scrollNext = React.useCallback(
    () => emblaApi?.scrollNext(),
    [emblaApi],
  );

  if (sortedPlans.length === 0) return null;

  const hasMultiple = sortedPlans.length > 1;

  return (
    <div className={cn("w-full", className)}>
      {showBillingToggle && (
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200",
                billing === "monthly"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {t("monthly")}
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200",
                billing === "annual"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {t("annual")}
            </button>
          </div>
        </div>
      )}

      <div className="relative md:px-8 lg:px-10">
        {/* Edge fade overlays intentionally omitted, they clashed with
            consumer backgrounds (e.g. dialog bg-card). Clipping from
            `overflow-hidden` below is sufficient. */}

        <div className="overflow-hidden py-8" ref={emblaRef}>
          <div className="flex items-stretch">
            {sortedPlans.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isCurrent = !!(
                (currentPlanId && item.plan.id === currentPlanId) ||
                (normalizedCurrentName &&
                  item.plan.name.trim().toLowerCase() === normalizedCurrentName)
              );
              return (
                <div
                  key={item.plan.id}
                  className={cn(
                    "shrink-0 grow-0 min-w-0",
                    "basis-[86%] sm:basis-[58%] md:basis-[42%] lg:basis-[34%] xl:basis-[30%]",
                    "px-2",
                  )}
                >
                  <div
                    onClick={() => {
                      if (!isSelected) scrollTo(index);
                    }}
                    className={cn(
                      "h-full origin-center transform-gpu will-change-transform",
                      "transition-[transform,opacity] duration-500 ease-out",
                      isSelected
                        ? "scale-100 opacity-100"
                        : "scale-[0.9] opacity-55 cursor-pointer",
                    )}
                  >
                    <PlanCard
                      item={item}
                      featured={index === featuredIndex}
                      featuredLabel={
                        item.plan.exclusiveAffiliateId
                          ? "exclusive"
                          : index === featuredIndex
                            ? featuredLabel
                            : null
                      }
                      exchangeRate={exchangeRate}
                      billing={billing}
                      affiliateBrand={affiliateBrand}
                      isCurrent={isCurrent}
                      ctaLabel={ctaLabel}
                      ctaHref={ctaHref}
                      onSelect={onSelectPlan}
                      t={t}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label={t("prev")}
              onClick={scrollPrev}
              disabled={!canPrev}
              className={cn(
                "absolute left-0 md:-left-4 lg:-left-6 top-1/2 z-20 -translate-y-1/2",
                "flex h-10 w-10 items-center justify-center rounded-full",
                "border border-border bg-background text-foreground shadow-md",
                "transition-opacity duration-200",
                "disabled:opacity-30 disabled:cursor-not-allowed",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <ArrowLeft className="h-4 w-4" weight="bold" />
            </button>
            <button
              type="button"
              aria-label={t("next")}
              onClick={scrollNext}
              disabled={!canNext}
              className={cn(
                "absolute right-0 md:-right-4 lg:-right-6 top-1/2 z-20 -translate-y-1/2",
                "flex h-10 w-10 items-center justify-center rounded-full",
                "border border-border bg-background text-foreground shadow-md",
                "transition-opacity duration-200",
                "disabled:opacity-30 disabled:cursor-not-allowed",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <ArrowRight className="h-4 w-4" weight="bold" />
            </button>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {sortedPlans.map((p, i) => (
            <button
              key={p.plan.id}
              type="button"
              aria-label={p.plan.name}
              aria-current={i === selectedIndex}
              onClick={() => scrollTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === selectedIndex
                  ? "w-6 bg-foreground"
                  : "w-1.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
