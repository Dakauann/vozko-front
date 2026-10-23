"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ArrowLeft } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { mapTripOf, tripReturnHref } from "@/lib/campaign-audience/map-trip";
import type { CrmFilter } from "@/lib/crm/board";
import { areaSelectionOf } from "@/lib/leads/map-view";

export function AudienceMapReturn({ filter }: { filter: CrmFilter }) {
  const t = useTranslations("campaignAudience.mapTrip");
  const params = useSearchParams();
  const router = useRouter();
  const trip = mapTripOf(params);
  if (!trip) return null;
  const selection = areaSelectionOf(filter);

  return (
    <Notice tone="info" title={t("title")}>
      <p>{t("body")}</p>
      <p className="font-medium text-foreground">{t("selected", { count: selection.ids.length })}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" title={t("apply")} icon={<ArrowLeft className="h-3.5 w-3.5" />} iconVisible onClick={() => router.push(tripReturnHref(trip, selection))} />
        <Button type="button" variant="secondary" size="sm" title={t("cancel")} onClick={() => router.push(tripReturnHref(trip, null))} />
      </div>
    </Notice>
  );
}
