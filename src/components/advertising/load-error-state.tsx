"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import type { DashboardTableEmptyState } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, Warning } from "@/components/icons";

export function useLoadErrorState() {
  const t = useTranslations("adsManager");
  return useCallback(
    (message: string, onRetry: () => void): DashboardTableEmptyState => ({
      icon: <Warning className="h-7 w-7 text-destructive-ink" />,
      title: t("loadFailed"),
      description: message,
      action: (
        <div className="mt-2">
          <Button variant="secondary" title={t("retry")} icon={<ArrowClockwise className="h-4 w-4" />} iconVisible iconSide="left" onClick={onRetry} />
        </div>
      ),
    }),
    [t],
  );
}
