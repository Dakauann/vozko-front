"use client";

import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Tabs, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { X } from "@/components/icons";
import { tabLabel } from "@/lib/advertising/manager-toolbar";
import type { AdLevel } from "@/lib/advertising/types";

const LEVELS: AdLevel[] = ["campaign", "adset", "ad"];

export function LevelTabs({
  level,
  onLevel,
  selected,
  counts,
  onClear,
  aside,
}: {
  level: AdLevel;
  onLevel: (level: AdLevel) => void;
  selected: Record<AdLevel, number>;
  counts: Record<AdLevel, number | null>;
  onClear: (level: AdLevel) => void;
  aside: ReactNode;
}) {
  const t = useTranslations("adsManager.tabs");

  const label = (target: AdLevel) => {
    const scope = tabLabel(target, selected.campaign, selected.adset);
    if (scope.kind === "forCampaigns") return t(`${target}ForCampaigns`, { count: scope.count });
    if (scope.kind === "forAdSets") return t("adForAdSets", { count: scope.count });
    return t(target);
  };

  const change = (next: string) => {
    if (next === "campaign" || next === "adset" || next === "ad") onLevel(next);
  };

  return (
    <div className="flex flex-col gap-2 border-b border-border px-3 pt-1 lg:flex-row lg:items-end">
      <Tabs value={level} onValueChange={change} className="min-w-0 flex-1">
        <TabsList className="border-b-0">
          {LEVELS.map((target) => {
            const count = counts[target];
            const chosen = selected[target];
            return (
              <Fragment key={target}>
                <TabsTrigger value={target}>
                  {label(target)}
                  {count !== null && chosen === 0 ? <span className="text-2xs tabular-nums text-muted-foreground">{count}</span> : null}
                </TabsTrigger>
                {chosen > 0 ? (
                  <button
                    type="button"
                    onClick={() => onClear(target)}
                    className="-ml-1 mb-1 inline-flex h-6 shrink-0 items-center gap-1 self-center rounded-full border border-control-edge bg-card px-2 text-2xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t("clear", { count: chosen })}
                  >
                    <span className="tabular-nums">{t("selected", { count: chosen })}</span>
                    <X className="h-3 w-3" weight="bold" aria-hidden />
                  </button>
                ) : null}
              </Fragment>
            );
          })}
        </TabsList>
      </Tabs>
      <div className="flex shrink-0 justify-end pb-2">{aside}</div>
    </div>
  );
}
