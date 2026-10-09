"use client";

import { useTranslations } from "next-intl";

import { CaretDown, SlidersHorizontal } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { LEAD_OPTIONAL_COLUMNS, type LeadOptionalColumn } from "./use-lead-columns";

const COLUMN_LABEL_KEYS: Record<LeadOptionalColumn, string> = {
  referrals: "table.referrals",
  campaigns: "table.campaigns",
  memories: "table.memories",
  window: "table.window",
};

export function LeadColumnsMenu({
  shown,
  onToggle,
}: {
  shown: ReadonlySet<LeadOptionalColumn>;
  onToggle: (column: LeadOptionalColumn) => void;
}) {
  const t = useTranslations("leadsPage");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="max-sm:sr-only">{t("table.columns")}</span>
          <CaretDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("table.columnsTitle")}</DropdownMenuLabel>
        {LEAD_OPTIONAL_COLUMNS.map((column) => (
          <DropdownMenuCheckboxItem
            key={column}
            checked={shown.has(column)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => onToggle(column)}
          >
            {t(COLUMN_LABEL_KEYS[column])}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
