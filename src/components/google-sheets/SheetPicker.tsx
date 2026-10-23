"use client";

import { useCallback } from "react";

import { ElevatedCommandSelect, type ElevatedCommandOption } from "@/components/elevated-design/elevated-command-select";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { listSheets } from "@/lib/google-sheets/client";
import type { GoogleSheet } from "@/lib/google-sheets/types";

const PAGE_SIZE = 20;

interface SheetPickerProps {
  label: string;
  value: string;
  savedTitle: string;
  searchPlaceholder: string;
  emptyMessage: string;
  attentionLabel: string;
  onPick: (sheetId: string, title: string) => void;
}

export function SheetPicker({ label, value, savedTitle, searchPlaceholder, emptyMessage, attentionLabel, onPick }: SheetPickerProps) {
  const toOption = useCallback(
    (sheet: GoogleSheet): ElevatedCommandOption => ({
      value: sheet.id,
      label: sheet.title,
      description: sheet.status === "needs_attention" ? attentionLabel : sheet.tabName,
    }),
    [attentionLabel],
  );
  const select = usePaginatedSelect<GoogleSheet>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const res = await listSheets({ page, pageSize: PAGE_SIZE, search: search || undefined });
      return { items: res.data?.items ?? [], totalPages: res.data?.totalPages ?? 1 };
    }, []),
    mapOption: toOption,
  });
  const options =
    value && !select.options.some((option) => option.value === value)
      ? [{ value, label: savedTitle || value }, ...select.options]
      : select.options;

  return (
    <ElevatedCommandSelect
      label={label}
      value={value}
      options={options}
      onValueChange={(next, option) => onPick(next, option.label)}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      isLoading={select.isLoading}
      onSearch={select.onSearch}
      onScrollEnd={select.onScrollEnd}
      onOpenChange={select.onOpenChange}
    />
  );
}
