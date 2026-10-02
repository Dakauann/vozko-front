"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";

import { SlidersHorizontal } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { REPORT_COLUMNS, type MetricColumn } from "@/lib/advertising/columns";
import { LIVE_COLUMNS } from "@/lib/advertising/live";

const GROUPS: { key: "report" | "live"; columns: readonly MetricColumn[] }[] = [
  { key: "report", columns: REPORT_COLUMNS },
  { key: "live", columns: LIVE_COLUMNS },
];

export function AdsColumnsMenu({
  visible,
  onToggle,
}: {
  visible: MetricColumn[];
  onToggle: (column: MetricColumn) => void;
}) {
  const t = useTranslations("adsManager.columns");
  const shown = new Set(visible);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          {t("menu")}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-64 overflow-y-auto">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
