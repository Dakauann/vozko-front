"use client";

import { useTranslations } from "next-intl";

import { listAdTestsAction } from "@/app/actions/advertising";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { ArrowClockwise } from "@/components/icons";
import { useAdsResource } from "@/components/advertising/wizard/use-ads-resource";
import { formatWhen } from "@/lib/advertising/when";
import { cn } from "@/lib/utils";

import { useAdsFormat } from "./use-ads-format";

export function AbTestsSheet({
  open,
  accountId,
  refreshKey,
  onOpenChange,
}: {
  open: boolean;
  accountId: string;
  refreshKey: number;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("adsManager.abTests");
  const fmt = useAdsFormat();
  const tests = useAdsResource(open ? `tests:${accountId}:${refreshKey}` : null, () => listAdTestsAction(accountId));
  const list = tests.status === "ready" ? tests.data : [];

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full sm:max-w-md">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{t("title")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{t("description")}</ElevatedSheetDescription>
          <button
            type="button"
            onClick={tests.reload}
            disabled={tests.status === "loading"}
            className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-primary-ink hover:underline disabled:opacity-50"
          >
            <ArrowClockwise className={cn("h-3.5 w-3.5", tests.status === "loading" && "animate-spin")} aria-hidden />
            {t("refresh")}
          </button>
        </ElevatedSheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {tests.status === "error" ? <p className="text-sm text-destructive-ink">{tests.message}</p> : null}
          {tests.status === "loading" ? <div className="h-24 animate-pulse rounded-[--radius] bg-muted" /> : null}
          {tests.status === "ready" && list.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
          <ul className="divide-y divide-border">
            {list.map((test) => (
              <li key={test.metaId ?? test.name} className="space-y-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{test.name}</p>
                    <p className="text-2xs tabular-nums text-muted-foreground">
                      {formatWhen(test.startAt, fmt.tag, false)} {t("to")} {formatWhen(test.endAt, fmt.tag, false)}
                    </p>
                  </div>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {t(`level.${test.level}`)} · {t("confidence", { value: test.confidence })}
                  </span>
                </div>
                <ul className="space-y-1">
                  {(test.cells ?? []).map((cell) => (
                    <li key={cell.name} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate text-foreground">{cell.name}</span>
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <span className="block h-full bg-chart-2" style={{ width: `${cell.share}%` }} />
                      </span>
                      <span className="w-10 text-right tabular-nums text-muted-foreground">{cell.share}%</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
