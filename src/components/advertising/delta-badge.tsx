"use client";

import { useTranslations } from "next-intl";

import { ArrowDown, ArrowUp, Minus } from "@/components/icons";
import type { Delta } from "@/lib/advertising/compare";
import { cn } from "@/lib/utils";

import { useAdsFormat } from "./use-ads-format";

const TONE_CLASS = {
  better: "text-healthy-ink",
  worse: "text-destructive-ink",
  neutral: "text-muted-foreground",
} as const;

export function DeltaBadge({ delta, previous }: { delta: Delta | null; previous: string }) {
  const t = useTranslations("adsManager.compare");
  const fmt = useAdsFormat();

  if (!delta) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground" title={t("previous", { value: previous })}>
        <span aria-hidden>{fmt.empty}</span>
        <span className="sr-only">{t("noBaseline")}</span>
      </span>
    );
  }

  const Glyph = delta.change > 0 ? ArrowUp : delta.change < 0 ? ArrowDown : Minus;
  const magnitude = fmt.percent(Math.abs(delta.change));
  const sign = delta.change > 0 ? "+" : delta.change < 0 ? "-" : "";

  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium tabular-nums", TONE_CLASS[delta.tone])} title={t("previous", { value: previous })}>
      <Glyph className="h-3 w-3" weight="bold" aria-hidden />
      <span aria-hidden>
        {sign}
        {magnitude}
      </span>
      <span className="sr-only">{t(`tone.${delta.tone}`, { change: `${sign}${magnitude}`, previous })}</span>
    </span>
  );
}
