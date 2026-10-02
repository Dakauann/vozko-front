"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { ruleHistoryAction } from "@/app/actions/advertising-rules";
import { isAdsError } from "@/app/actions/advertising";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { ArrowClockwise } from "@/components/icons";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import type { AutomatedRule } from "@/lib/advertising/rules";
import type { AdAccount } from "@/lib/advertising/types";
import { formatWhen } from "@/lib/advertising/when";
import { cn } from "@/lib/utils";

import { useAdsFormat } from "../use-ads-format";

export function RuleHistorySheet({ account, rule, onClose }: { account: AdAccount; rule: AutomatedRule | null; onClose: () => void }) {
  const t = useTranslations("adsRules.history");
  const fmt = useAdsFormat();
  const ruleId = rule?.metaId ?? null;
  const load = useCallback(() => ruleHistoryAction(ruleId ?? "", account.id), [ruleId, account.id]);
  const history = useKeyedLoad(ruleId, load);
  const response = history.value;
  const runs = response && !isAdsError(response) ? response.data : [];
  const error = response && isAdsError(response) ? response.error : null;

  const resultLabel = (result: string) => (t.has(`results.${result}`) ? t(`results.${result}`) : result || t("results.unknown"));

  return (
    <ElevatedSheet open={!!rule} onOpenChange={(open) => !open && onClose()}>
      <ElevatedSheetContent side="right" className="w-full sm:max-w-md">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{t("title")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{rule?.name ?? ""}</ElevatedSheetDescription>
          <button
            type="button"
            onClick={history.reload}
            disabled={history.loading}
            className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-primary-ink hover:underline disabled:opacity-50"
          >
            <ArrowClockwise className={cn("h-3.5 w-3.5", history.loading && "animate-spin")} aria-hidden />
            {t("refresh")}
          </button>
        </ElevatedSheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {history.loading ? <div className="h-24 animate-pulse rounded-md bg-muted" /> : null}
          {error ? <p className="text-sm text-destructive-ink">{error}</p> : null}
          {!history.loading && !error && runs.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
          <ul className="divide-y divide-border">
            {runs.map((run, index) => (
              <li key={`${run.at}-${index}`} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{resultLabel(run.result)}</p>
                  <p className="text-xs text-muted-foreground">{t("objects", { count: run.objects?.length ?? 0 })}</p>
                </div>
                <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{formatWhen(run.at, fmt.tag)}</span>
              </li>
            ))}
          </ul>
        </div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
