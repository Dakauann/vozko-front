"use client";

import * as React from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { useLocale, useTranslations } from "next-intl";

import { ArrowLeft, ArrowRight, Sparkle } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { PlanCard } from "@/components/plans/plan-card";
import { featuredPlan, sortedPlans } from "@/lib/workspace-plan/catalog";
import type { PublicPlanDetails } from "@/lib/workspace-plan/types";
import { cn } from "@/lib/utils";

export interface AffiliateBrand {
  code: string;
  brandName?: string;
  brandLogoUrl?: string;
}

export function AffiliateBrandChip({ brand }: { brand: AffiliateBrand }) {
  const t = useTranslations("pricing");
  const name = brand.brandName?.trim() || brand.code;
  const logo = brand.brandLogoUrl?.trim();
  return (
    <div className="inline-flex items-center gap-3" aria-label={`${t("exclusivePartner")}: ${name}`}>
      <span className="relative inline-flex h-9 w-9 items-center justify-center">
        {logo ? (
          <Image src={logo} alt={name} fill sizes="36px" unoptimized className="object-contain" />
        ) : (
          <Sparkle className="h-5 w-5 text-foreground/70" weight="fill" />
        )}
      </span>
      <div className="flex flex-col text-left leading-tight">
        <span className="text-2xs font-semibold tracking-[0.18em] text-muted-foreground">{t("exclusivePartner")}</span>
        <span className="text-sm font-semibold tracking-tight text-foreground">{name}</span>
      </div>
    </div>
  );
}

export interface PlansCarouselProps {
  plans: PublicPlanDetails[];
  affiliateBrand?: AffiliateBrand | null;
  currentPlanId?: string | null;
  currentPlanName?: string | null;
  ctaLabel?: string;
  ctaHref?: string;
  onSelectPlan?: (plan: PublicPlanDetails) => void;
  className?: string;
}

const CAROUSEL_OPTIONS = { align: "center", loop: false, containScroll: false, skipSnaps: false } as const;

export function PlansCarousel({
  plans,
  affiliateBrand,
  currentPlanId,
  currentPlanName,
  ctaLabel,
  ctaHref,
  onSelectPlan,
  className,
}: PlansCarouselProps) {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const ordered = React.useMemo(() => sortedPlans(plans), [plans]);
  const featured = React.useMemo(() => featuredPlan(plans), [plans]);
  const startIndex = Math.max(0, ordered.findIndex((item) => item.plan.id === featured?.planId));
  const normalizedCurrentName = currentPlanName?.trim().toLowerCase() || null;

  const [emblaRef, emblaApi] = useEmblaCarousel({ ...CAROUSEL_OPTIONS, startIndex });
  const [selectedIndex, setSelectedIndex] = React.useState(startIndex);
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);

  React.useEffect(() => {
    if (!emblaApi) return;
    const sync = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    emblaApi.reInit({ ...CAROUSEL_OPTIONS, startIndex });
    emblaApi.on("select", sync);
    emblaApi.on("reInit", sync);
    return () => {
      emblaApi.off("select", sync);
      emblaApi.off("reInit", sync);
    };
  }, [emblaApi, startIndex, ordered.length]);

  if (ordered.length === 0) return null;
  const hasMultiple = ordered.length > 1;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative md:px-8 lg:px-10">
        <div className="overflow-hidden py-6" ref={emblaRef}>
          <div className="flex items-stretch">
            {ordered.map((item, index) => {
              const isCurrent = Boolean(
                (currentPlanId && item.plan.id === currentPlanId) ||
                  (normalizedCurrentName && item.plan.name.trim().toLowerCase() === normalizedCurrentName),
              );
              const isFeatured = featured?.planId === item.plan.id;
              return (
                <div key={item.plan.id} className="min-w-0 shrink-0 grow-0 basis-[86%] px-2 sm:basis-[58%] md:basis-[42%] lg:basis-[34%] xl:basis-[30%]">
                  <div
                    onClick={() => {
                      if (index !== selectedIndex) emblaApi?.scrollTo(index);
                    }}
                    className={cn(
                      "h-full pt-3 transition-opacity duration-300 motion-reduce:transition-none",
                      index === selectedIndex ? "opacity-100" : "cursor-pointer opacity-60",
                    )}
                  >
                    <PlanCard
                      plan={item.plan}
                      locale={locale}
                      featured={isFeatured ? featured?.kind : null}
                      current={isCurrent}
                      brand={item.plan.exclusiveAffiliateId && affiliateBrand ? <AffiliateBrandChip brand={affiliateBrand} /> : undefined}
                      action={
                        <Button
                          variant={isFeatured && !isCurrent ? "primary" : "outline"}
                          title={isCurrent ? t("currentPlan") : (ctaLabel ?? t("ctaPaid"))}
                          icon={<ArrowRight className="h-4 w-4" weight="bold" />}
                          iconVisible={!isCurrent}
                          iconSide="right"
                          link={onSelectPlan || isCurrent ? undefined : (ctaHref ?? "/login?redirect=/dashboard/plans")}
                          onClick={onSelectPlan && !isCurrent ? () => onSelectPlan(item) : undefined}
                          newTab={false}
                          disabled={isCurrent}
                          className="w-full justify-center"
                        />
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {hasMultiple ? (
          <>
            <CarouselArrow side="left" label={t("prev")} disabled={!canPrev} onClick={() => emblaApi?.scrollPrev()} />
            <CarouselArrow side="right" label={t("next")} disabled={!canNext} onClick={() => emblaApi?.scrollNext()} />
          </>
        ) : null}
      </div>

      {hasMultiple ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          {ordered.map((item, index) => (
            <button
              key={item.plan.id}
              type="button"
              aria-label={item.plan.name}
              aria-current={index === selectedIndex}
              onClick={() => emblaApi?.scrollTo(index)}
              className={cn("h-1.5 rounded-full transition-all duration-300", index === selectedIndex ? "w-6 bg-foreground" : "w-1.5 bg-muted-foreground/30")}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CarouselArrow({ side, label, disabled, onClick }: { side: "left" | "right"; label: string; disabled: boolean; onClick: () => void }) {
  const ArrowIcon = side === "left" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "absolute top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-opacity duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-30",
        side === "left" ? "left-0 md:-left-4 lg:-left-6" : "right-0 md:-right-4 lg:-right-6",
      )}
    >
      <ArrowIcon className="h-4 w-4" weight="bold" />
    </button>
  );
}
