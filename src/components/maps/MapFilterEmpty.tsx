"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { MapNotice } from "./MapNotice";

interface MapIncludeApproximate {
  count: number;
  onSelect: () => void;
}

interface MapFilterEmptyProps {
  onClear: () => void;
  includeApproximate?: MapIncludeApproximate | null;
  className?: string;
}

export function MapFilterEmpty({ onClear, includeApproximate = null, className }: MapFilterEmptyProps) {
  const t = useTranslations("leadMap.empty");
  const description = includeApproximate ? t("approximateInside", { count: includeApproximate.count }) : t("filterDescription");

  return (
    <MapNotice title={t("filterTitle")} description={description} className={className}>
      <div className="flex flex-wrap items-start justify-center gap-3">
        {includeApproximate ? (
          <Button type="button" variant="primary" onClick={includeApproximate.onSelect}>
            {t("actions.includeApproximate")}
          </Button>
        ) : null}
        <Button type="button" variant={includeApproximate ? "outline" : "primary"} onClick={onClear}>
          {t("actions.clearFilters")}
        </Button>
      </div>
    </MapNotice>
  );
}
