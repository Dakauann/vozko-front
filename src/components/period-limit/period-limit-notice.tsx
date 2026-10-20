"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { screenPaths } from "@/lib/navigation/routes";
import { wholeUnitAmount, type PeriodLimitReport, type PeriodUnit } from "@/lib/period-limit/period-limit";

export function PeriodLimitNotice({
  limit,
  unit = "days",
  report,
  onUseWindow,
}: {
  limit: number;
  unit?: PeriodUnit;
  report?: PeriodLimitReport;
  onUseWindow: () => void;
}) {
  const t = useTranslations("periodLimit");
  const amount = wholeUnitAmount(limit, unit);
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[--radius] border border-border bg-card px-3 py-2">
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-warning" />
      <p className="min-w-0 flex-1 text-sm text-foreground">{t("notice", amount)}</p>
      <div className="flex flex-wrap gap-2">
        {report?.state === "queued" ? (
          <Button variant="secondary" size="sm" title={t("queued.open")} link={screenPaths.reports} newTab={false} />
        ) : report ? (
          <Button
            variant="secondary"
            size="sm"
            title={report.state === "requesting" ? t("requesting") : t("report.title")}
            disabled={report.state === "requesting"}
            onClick={report.onRequest}
          />
        ) : null}
        <Button variant="ghost" size="sm" title={t("window.title", amount)} onClick={onUseWindow} />
      </div>
    </div>
  );
}
