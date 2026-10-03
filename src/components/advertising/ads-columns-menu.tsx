"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, Check, SlidersHorizontal } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COLUMN_PRESETS, REPORT_COLUMNS, presetOf, type ColumnPreset, type MetricColumn } from "@/lib/advertising/columns";
import { LIVE_COLUMNS } from "@/lib/advertising/live";
import { cn } from "@/lib/utils";

const GROUPS: { key: "report" | "live"; columns: readonly MetricColumn[] }[] = [
  { key: "report", columns: REPORT_COLUMNS },
  { key: "live", columns: LIVE_COLUMNS },
];

export function AdsColumnsMenu({
  visible,
  onToggle,
  onPreset,
}: {
  visible: MetricColumn[];
  onToggle: (column: MetricColumn) => void;
  onPreset: (preset: ColumnPreset) => void;
}) {
  const t = useTranslations("adsManager.columns");
  const shown = new Set(visible);
  const active = presetOf(visible);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="max-sm:sr-only">{t("menuWith", { preset: active ? t(`presets.${active}`) : t("presets.custom") })}</span>
          <CaretDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t("presetsTitle")}</DropdownMenuLabel>
        {COLUMN_PRESETS.map((preset) => (
          <DropdownMenuItem key={preset} onSelect={() => onPreset(preset)}>
            <Check className={cn("mr-2 h-4 w-4", active === preset ? "opacity-100" : "opacity-0")} aria-hidden />
            {t(`presets.${preset}`)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t("customize")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[70vh] w-64 overflow-y-auto">
            {GROUPS.map((group, index) => (
              <Fragment key={group.key}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuLabel>{t(`groups.${group.key}`)}</DropdownMenuLabel>
                {group.key === "live" ? <p className="px-2 pb-1.5 text-2xs text-muted-foreground">{t("groups.liveHint")}</p> : null}
                {group.columns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column}
                    checked={shown.has(column)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() => onToggle(column)}
                  >
                    {t(column)}
                  </DropdownMenuCheckboxItem>
                ))}
              </Fragment>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
