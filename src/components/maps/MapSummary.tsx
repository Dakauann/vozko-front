"use client";

import { useTranslations } from "next-intl";

import type { GeoSummary } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

const OFF_MAP: Array<keyof GeoSummary> = ["approximate", "withoutAddress", "notFound", "pending", "quotaExceeded", "refused"];

export interface MapSummaryProps {
  summary: GeoSummary | null;
  visibleCount?: number | null;
  visibleApproximate?: number | null;
  loading?: boolean;
  failed?: boolean;
  visible?: boolean;
  className?: string;
}

export function MapSummary({ summary, visibleCount = null, visibleApproximate = null, loading = false, failed = false, visible = false, className }: MapSummaryProps) {
  const t = useTranslations("leadMap.summary");

  const sentences: string[] = [];
  if (failed) {
    sentences.push(t("failed"));
  } else if (loading || !summary) {
    sentences.push(t("loading"));
  } else {
    if (visibleCount !== null) sentences.push(t("visible", { count: visibleCount }));
    if (visibleApproximate !== null && visibleApproximate > 0) sentences.push(t("visibleApproximate", { count: visibleApproximate }));
    sentences.push(t("total", { count: summary.total }));
    sentences.push(t("onMap", { count: summary.onMap }));
    for (const field of OFF_MAP) {
      if (summary[field] > 0) sentences.push(t(field, { count: summary[field] }));
    }
  }

  return (
    <p role="status" aria-live="polite" aria-atomic="true" className={cn(visible ? "text-xs text-muted-foreground" : "sr-only", className)}>
      {sentences.join(" ")}
    </p>
  );
}
