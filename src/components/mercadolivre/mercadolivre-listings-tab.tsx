"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { listMercadoLivreListingsAction } from "@/app/actions/mercadolivre";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { CaretRight, MagnifyingGlass, Storefront } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listingStatusKey, listingStatusTone } from "@/lib/mercadolivre/questions";
import { MERCADOLIVRE_LISTING_STATUSES, type MercadoLivreListing, type MercadoLivreListingStatus } from "@/lib/mercadolivre/types";

import type { MercadoLivreAccountTabProps } from "./mercadolivre-account-tabs";
import { MercadoLivreListingDetail } from "./mercadolivre-listing-detail";
import { MercadoLivreListingThumb } from "./mercadolivre-listing-thumb";
import { useKeysetPages } from "./use-keyset-pages";
import { useMercadoLivreError } from "./use-mercadolivre-error";
import { useCheckedDate } from "@/components/channels/use-purge-date";

const LISTINGS_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

type ListingStatusFilter = "all" | MercadoLivreListingStatus;

const LISTING_STATUS_FILTERS: readonly ListingStatusFilter[] = ["all", ...MERCADOLIVRE_LISTING_STATUSES];

export function MercadoLivreListingsTab({ account, canUpdate }: MercadoLivreAccountTabProps) {
  const t = useTranslations("mercadolivre");
  const describeError = useMercadoLivreError();
  const formatDate = useCheckedDate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ListingStatusFilter>("all");
  const [open, setOpen] = useState<MercadoLivreListing | null>(null);
  const query = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const fetchPage = useCallback(
    (cursor: string | undefined) =>
      listMercadoLivreListingsAction(account.id, {
        search: query,
        status: status === "all" ? undefined : status,
        cursor,
        limit: LISTINGS_PAGE_SIZE,
      }),
    [account.id, query, status],
  );
  const { rows, loading, loadingMore, hasNext, failure, loadMore, reload } = useKeysetPages<MercadoLivreListing>(fetchPage, true);

  const columns = useMemo<DashboardTableColumn<MercadoLivreListing>[]>(
    () => [
      {
        key: "listing",
        header: t("listings.columns.listing"),
        render: (row) => (
          <div className="flex min-w-0 items-center gap-3">
            <MercadoLivreListingThumb url={row.thumbnailUrl} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{row.title}</span>
              <span className="text-xs text-muted-foreground">{row.itemId}</span>
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: t("listings.columns.status"),
        render: (row) => <StatusChip tone={listingStatusTone(row.status)} label={t(listingStatusKey(row.status))} className="w-fit" />,
      },
      {
        key: "syncedAt",
        header: t("listings.columns.syncedAt"),
        render: (row) => (row.syncedAt ? <span className="text-sm text-foreground">{formatDate(row.syncedAt)}</span> : <EmptyValue />),
      },
    ],
    [t, formatDate],
  );

  if (open) {
    return <MercadoLivreListingDetail account={account} listing={open} canUpdate={canUpdate} onBack={() => setOpen(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[--radius] border border-border bg-card px-5 py-3 shadow-sm md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{t("listings.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("listings.subtitle")}</p>
        </div>
        <ElevatedPillToggle<ListingStatusFilter>
          aria-label={t("listings.statusFilterLabel")}
          value={status}
          onChange={setStatus}
          options={LISTING_STATUS_FILTERS.map((filter) => ({ value: filter, label: t(`listings.statusFilter.${filter}`) }))}
        />
        <div className="w-full md:max-w-xs">
          <ElevatedInput
            type="text"
            label={t("listings.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
            controlSize="sm"
            className="w-full"
          />
        </div>
      </div>

      {failure ? (
        <Notice tone="fault">
          <p>{describeError(failure)}</p>
          <Button size="sm" variant="secondary" title={t("listings.retry")} onClick={reload} />
        </Notice>
      ) : null}

      <ElevatedContainer className="overflow-hidden rounded-lg border border-border !p-0">
        <DashboardTable<MercadoLivreListing>
          data={rows}
          columns={columns}
          rowKey={(row) => row.id}
          loading={loading}
          onRowClick={(row) => setOpen(row)}
          renderRowActions={(row) => (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(row);
              }}
              aria-label={t("listings.open")}
              title={t("listings.open")}
              className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CaretRight className="h-4 w-4" />
            </button>
          )}
          emptyState={{
            icon: <Storefront className="h-7 w-7 text-muted-foreground" />,
            title: t("listings.emptyTitle"),
            description: t("listings.emptyDescription"),
          }}
          className="rounded-none border-0 shadow-none"
        />
        {hasNext ? (
          <div className="border-t border-border p-4">
            <Button
              variant="secondary"
              className="w-full"
              onClick={loadMore}
              disabled={loadingMore}
              title={loadingMore ? t("listings.loading") : t("listings.loadMore")}
            />
          </div>
        ) : null}
      </ElevatedContainer>
    </div>
  );
}
