"use client";

import { useTranslations } from "next-intl";

import { OptionCtr } from "@/components/choice-stats/OptionCtr";
import { useChoiceFormat } from "@/components/choice-stats/use-choice-format";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import { optionStatsOf } from "@/lib/choice-stats/stats";
import { cn } from "@/lib/utils";

import type { NodeChoiceView } from "./choice-stats-store";

const CANVAS_RATE_DIGITS = 0;

export function NodeChoiceLine({ view, size }: { view: NodeChoiceView; size: "full" | "simplified" }) {
  const t = useTranslations("choiceStats.node");
  const format = useChoiceFormat();
  const empty = useEmptyValue();
  return (
    <div
      data-choice-stats
      className={cn(
        "flex items-center gap-1.5 truncate tabular-nums text-muted-foreground",
        size === "full" ? "border-b border-border bg-card px-2 py-1 text-2xs" : "px-2.5 pt-1.5 text-[13px] leading-5",
      )}
    >
      {view.kind === "stats" ? (
        <>
          <span className="font-semibold text-foreground">{t("sends", { count: view.stats.sends })}</span>
          <span aria-hidden>·</span>
          <span>{t("clicks", { rate: format.rate(view.stats.clickRate, CANVAS_RATE_DIGITS) })}</span>
        </>
      ) : (
        <span>{t("sendsEmpty", { empty })}</span>
      )}
    </div>
  );
}

export function NodeOptionCtr({ view, optionId }: { view: NodeChoiceView | null; optionId: string }) {
  if (view?.kind !== "stats") return null;
  return <OptionCtr option={optionStatsOf(view.stats, optionId)} fractionDigits={CANVAS_RATE_DIGITS} className="shrink-0 text-2xs font-medium" />;
}
