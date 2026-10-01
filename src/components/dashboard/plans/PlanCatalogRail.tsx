"use client";

import * as React from "react";
import { useLocale } from "next-intl";

import { PlanCard } from "@/components/plans/plan-card";
import { featuredPlan, sortedPlans } from "@/lib/workspace-plan/catalog";
import type { PublicPlanDetails } from "@/lib/workspace-plan/types";
import { cn } from "@/lib/utils";

interface PlanCatalogRailProps {
  plans: PublicPlanDetails[];
  className?: string;
  currentPlanName?: string | null;
  selectedPlanId?: string | null;
  onSelect?: (planId: string) => void;
}

export function PlanCatalogRail({ plans, className, currentPlanName, selectedPlanId, onSelect }: PlanCatalogRailProps) {
  const locale = useLocale();
  const ordered = React.useMemo(() => sortedPlans(plans), [plans]);
  const featured = React.useMemo(() => featuredPlan(plans), [plans]);
  const currentName = currentPlanName?.trim().toLowerCase();

  return (
    <div className={cn("flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-1 pt-1", className)}>
      {ordered.map((item) => (
        <PlanCard
          key={item.plan.id}
          className="w-[280px] shrink-0 snap-start"
          plan={item.plan}
          locale={locale}
          featured={featured?.planId === item.plan.id ? featured.kind : null}
          current={currentName != null && item.plan.name.trim().toLowerCase() === currentName}
          selected={selectedPlanId === item.plan.id}
          onShowDetails={onSelect ? () => onSelect(item.plan.id) : undefined}
        />
      ))}
    </div>
  );
}
