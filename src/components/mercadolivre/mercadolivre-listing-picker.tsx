"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { listMercadoLivreListingsAction } from "@/app/actions/mercadolivre";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { MercadoLivreListingThumb } from "./mercadolivre-listing-thumb";
import { useKeysetPages } from "./use-keyset-pages";

const ALL_LISTINGS = "all";
const PICKER_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export function MercadoLivreListingPicker({
  accountId,
  value,
  onChange,
  disabled,
  className,
}: {
  accountId: string;
  value: string;
  onChange: (itemId: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("mercadolivre.listings.picker");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const fetchPage = useCallback(
    (cursor: string | undefined) => listMercadoLivreListingsAction(accountId, { search: query, cursor, limit: PICKER_PAGE_SIZE }),
    [accountId, query],
  );
  const { rows, loading, loadingMore, hasNext, loadMore } = useKeysetPages(fetchPage, open);

  const options = useMemo(() => {
    const listed = rows.map((listing) => ({
      value: listing.itemId,
      label: listing.title,
      description: listing.itemId,
      icon: <MercadoLivreListingThumb url={listing.thumbnailUrl} className="h-5 w-5" />,
      keywords: [listing.itemId],
    }));
    const current =
      value && !listed.some((option) => option.value === value) ? [{ value, label: t("fallback", { id: value }), description: value }] : [];
    return [{ value: ALL_LISTINGS, label: t("all") }, ...current, ...listed];
  }, [rows, value, t]);

  return (
    <ElevatedCommandSelect
      label={t("label")}
      options={options}
      value={value || ALL_LISTINGS}
      onValueChange={(next) => onChange(next === ALL_LISTINGS ? "" : next)}
      searchPlaceholder={t("search")}
      emptyMessage={t("empty")}
      onSearch={setSearch}
      isLoading={loading || loadingMore}
      onScrollEnd={hasNext ? loadMore : undefined}
      onOpenChange={setOpen}
      disabled={disabled}
      className={className}
    />
  );
}
