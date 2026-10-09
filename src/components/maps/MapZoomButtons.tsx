"use client";

import { useTranslations } from "next-intl";

import { Minus, Plus } from "@/components/icons";
import { cn } from "@/lib/utils";

import { MAP_CONTROL_BUTTON } from "./map-layout";
import { useLeadMap } from "./map-context";

export function MapZoomButtons({ className }: { className?: string }) {
  const t = useTranslations("leadMap.controls");
  const { map } = useLeadMap();

  return (
    <div role="group" aria-label={t("zoom")} className={cn("flex flex-col gap-0.5", className)}>
      <button type="button" title={t("zoomIn")} disabled={!map} onClick={() => map?.zoomIn()} className={MAP_CONTROL_BUTTON}>
        <Plus size={16} aria-hidden="true" />
        <span className="sr-only">{t("zoomIn")}</span>
      </button>
      <button type="button" title={t("zoomOut")} disabled={!map} onClick={() => map?.zoomOut()} className={MAP_CONTROL_BUTTON}>
        <Minus size={16} aria-hidden="true" />
        <span className="sr-only">{t("zoomOut")}</span>
      </button>
    </div>
  );
}
