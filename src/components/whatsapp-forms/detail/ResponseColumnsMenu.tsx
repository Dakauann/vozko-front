"use client";

import { useTranslations } from "next-intl";

import { CaretDown, SlidersHorizontal } from "@/components/icons";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ResponseColumn } from "@/lib/whatsapp-forms/answers";

export function ResponseColumnsMenu({
  columns,
  hidden,
  onToggle,
}: {
  columns: readonly ResponseColumn[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  const t = useTranslations("whatsappForms.responses");
  if (columns.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="max-sm:sr-only">{t("columnsMenu")}</span>
          <CaretDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[60vh] w-64 overflow-y-auto">
        <DropdownMenuLabel>{t("columnsTitle")}</DropdownMenuLabel>
        {columns.map((column) => (
          <DropdownMenuCheckboxItem key={column.key} checked={!hidden.has(column.key)} onSelect={(event) => event.preventDefault()} onCheckedChange={() => onToggle(column.key)}>
            <span className="truncate">{column.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
