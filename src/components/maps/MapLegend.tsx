"use client";

import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { APPROXIMATE_TOKEN, cssTokenColor, DISTRICT_FILL_ALPHA, HEAT_TOKEN } from "@/lib/maps/palette";
import type { MapLayerMode } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

import { MAP_FLOATY } from "./map-layout";
import { useLeadMap } from "./map-context";

export interface MapLegendProps {
  mode: MapLayerMode;
  coloured?: boolean;
  districtsCount?: number | null;
  approximateCount?: number;
  selectedCount?: number;
  showArea?: boolean;
  credit?: string | null;
  className?: string;
}

function Row({ swatch, label, count }: { swatch: ReactNode; label: string; count?: string }) {
  return (
    <li className="flex items-center gap-2">
      {swatch}
      <span className="min-w-0 flex-1 text-foreground">{label}</span>
      {count !== undefined ? <span className="tabular-nums text-muted-foreground">{count}</span> : null}
    </li>
  );
}

function HeatRamp() {
  const t = useTranslations("leadMap.legend");
  const { palette } = useLeadMap();
  const ramp = palette?.heatLegend;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{t("less")}</span>
        {ramp ? (
          <span
            aria-hidden="true"
            data-heat-ramp=""
            className="h-2 flex-1 rounded-[2px]"
            style={{ background: `linear-gradient(90deg, ${ramp.from}, ${ramp.to})` }}
          />
        ) : (
          <span aria-hidden="true" className="h-2 flex-1" />
        )}
        <span className="text-muted-foreground">{t("more")}</span>
      </div>
      <p className="text-muted-foreground">{t("heatHint")}</p>
    </div>
  );
}

export function MapLegend({
  mode,
  coloured = false,
  districtsCount = null,
  approximateCount = 0,
  selectedCount,
  showArea = false,
  credit = null,
  className,
}: MapLegendProps) {
  const t = useTranslations("leadMap.legend");
  const format = useFormatter();
  const count = (value: number) => format.number(value);

  const pointRows = mode === "points" && (!coloured || approximateCount > 0);

  return (
    <section aria-label={t("title")} className={cn("grid gap-1.5 px-2.5 py-2 text-xs", MAP_FLOATY, className)}>
      {mode === "heat" ? <HeatRamp /> : null}

      {pointRows ? (
        <ul className="flex flex-col gap-1.5">
          {!coloured ? (
            <Row
              swatch={
                <span
                  aria-hidden="true"
                  data-precise-swatch=""
                  className="inline-block size-[7px] shrink-0 rounded-full ring-[1.5px] ring-card"
                  style={{ backgroundColor: cssTokenColor(HEAT_TOKEN) }}
                />
              }
              label={t("precise")}
            />
          ) : null}
          {approximateCount > 0 ? (
            <Row
              swatch={
                <span
                  aria-hidden="true"
                  data-approximate-swatch=""
                  className="inline-block size-[8px] shrink-0 rounded-full border-[1.6px]"
                  style={{ borderColor: cssTokenColor(APPROXIMATE_TOKEN) }}
                />
              }
              label={t("approximate")}
              count={count(approximateCount)}
            />
          ) : null}
        </ul>
      ) : null}

      {mode === "districts" && districtsCount !== null ? (
        <div className="flex flex-col gap-1">
          <ul className="flex flex-col gap-1">
            <Row
              swatch={
                <span
                  aria-hidden="true"
                  data-district-swatch=""
                  className="inline-block size-3 shrink-0 rounded-full border"
                  style={{ backgroundColor: cssTokenColor(HEAT_TOKEN, DISTRICT_FILL_ALPHA), borderColor: cssTokenColor(HEAT_TOKEN) }}
                />
              }
              label={t("districts")}
              count={count(districtsCount)}
            />
          </ul>
          <p className="text-muted-foreground">{t("districtsHint")}</p>
        </div>
      ) : null}

      {selectedCount !== undefined || showArea ? (
        <ul className="flex flex-col gap-1.5">
          {selectedCount !== undefined ? (
            <Row
              swatch={<span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-full border-[1.6px] border-primary" />}
              label={t("selected")}
              count={count(selectedCount)}
            />
          ) : null}
          {showArea ? (
            <Row swatch={<span aria-hidden="true" className="inline-block h-0.5 w-5 shrink-0 rounded-full bg-primary" />} label={t("area")} />
          ) : null}
        </ul>
      ) : null}

      {credit ? <p className="text-muted-foreground">{credit}</p> : null}
    </section>
  );
}
