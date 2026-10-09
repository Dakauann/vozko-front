"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { adminListGeocodingCoverageAction, type GeocodingPlatformResult } from "@/app/actions/geocoding-platform";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowsClockwise, Buildings, MagnifyingGlass, MapTrifold, Warning } from "@/components/icons";
import {
  geocodingPlatformErrorKey,
  type GeocodingPlatformCoverage,
  type GeocodingPlatformWorkspace,
} from "@/lib/workspace/workspace-config/geocoding-platform";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const COVERAGE_LINES = ["onMap", "approximate", "withoutAddress", "pending", "notFound"] as const satisfies readonly (keyof GeocodingPlatformCoverage)[];

type Query = { page: number; search: string };

function ShareCell({ share, count, total, detail }: { share: number; count: number; total: number; detail?: string }) {
  const t = useTranslations("adminGeocoding.share");
  if (total <= 0) return <EmptyValue className="text-sm" />;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="readout text-sm font-semibold text-foreground">{t("value", { share })}</span>
      <span className="readout text-2xs text-muted-foreground">{t("of", { count, total })}</span>
      {detail ? <span className="text-2xs text-muted-foreground">{detail}</span> : null}
    </div>
  );
}

function WorkspaceDetails({ item }: { item: GeocodingPlatformWorkspace }) {
  const t = useTranslations("adminGeocoding.details");
  const tSummary = useTranslations("leadMap.summary");
  return (
    <section className="space-y-3 border-t border-border bg-muted px-6 py-4">
      <h3 className="text-sm font-semibold text-foreground">{t("coverage")}</h3>
      <ul className="space-y-1.5 text-xs text-foreground">
        {COVERAGE_LINES.map((line) => (
          <li key={line} className="readout">
            {tSummary(line, { count: item.coverage[line] })}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GeocodingCoverageAdmin() {
  const t = useTranslations("adminGeocoding");
  const tSummary = useTranslations("leadMap.summary");
  const format = useFormatter();

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<Query>({ page: 1, search: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<GeocodingPlatformResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const next = search.trim();
    if (next === query.search) return;
    const timer = setTimeout(() => {
      setLoading(true);
      setExpanded(null);
      setQuery({ page: 1, search: next });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, query.search]);

  useEffect(() => {
    const controller = new AbortController();
    void adminListGeocodingCoverageAction({ page: query.page, pageSize: PAGE_SIZE, search: query.search }, controller.signal).then((next) => {
      if (controller.signal.aborted) return;
      setResult(next);
      setLoading(false);
    });
    return () => controller.abort();
  }, [query, reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const goToPage = (page: number) => {
    setLoading(true);
    setExpanded(null);
    setQuery((current) => ({ ...current, page }));
  };

  const page = result?.page ?? null;
  const items = page?.items ?? [];
  const errorKey = result?.error ? geocodingPlatformErrorKey(result.error) : null;

  const columns = useMemo<DashboardTableColumn<GeocodingPlatformWorkspace>[]>(
    () => [
      {
        header: t("table.workspace"),
        key: "workspace",
        render: (item) => <p className="truncate text-sm font-semibold text-foreground">{item.workspaceName}</p>,
      },
      {
        header: t("table.address"),
        key: "address",
        render: (item) => <ShareCell share={item.coverage.addressShare} count={item.coverage.withAddress} total={item.coverage.total} />,
      },
      {
        header: t("table.onMap"),
        key: "onMap",
        render: (item) => (
          <ShareCell
            share={item.coverage.mapShare}
            count={item.coverage.onMap}
            total={item.coverage.total}
            detail={item.coverage.approximate > 0 ? tSummary("approximate", { count: item.coverage.approximate }) : undefined}
          />
        ),
      },
      {
        header: t("table.details"),
        key: "details",
        className: "text-right",
        render: (item) => {
          const open = expanded === item.workspaceId;
          return (
            <div className="flex justify-end">
              <Button
                variant="outline"
                aria-expanded={open}
                title={open ? t("actions.hideDetails") : t("actions.showDetails")}
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded(open ? null : item.workspaceId);
                }}
              />
            </div>
          );
        },
      },
    ],
    [t, tSummary, expanded],
  );

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader
        icon={<MapTrifold className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
      />

      <DashboardTable<GeocodingPlatformWorkspace>
        stats={[
          {
            label: t("stats.workspaces"),
            value: loading || !page ? "..." : format.number(page.totalItems),
            icon: <Buildings className="h-4 w-4 text-info-ink" weight="fill" />,
          },
        ]}
        headerLeft={
          <ElevatedInput
            type="text"
            label={t("search.placeholder")}
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
            icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
            controlSize="sm"
            className="w-full max-w-xs"
          />
        }
        headerRight={
          <Button
            icon={<ArrowsClockwise className="h-4 w-4" weight="bold" />}
            iconVisible
            disabled={loading}
            onClick={reload}
            title={t("actions.refresh")}
            variant="outline"
          />
        }
        data={errorKey ? [] : items}
        columns={columns}
        rowKey={(item) => item.workspaceId}
        loading={loading}
        isRowExpanded={(item) => expanded === item.workspaceId}
        renderExpandedRow={(item) => <WorkspaceDetails item={item} />}
        pagination={
          page && !errorKey && page.totalPages > 1
            ? {
                currentPage: page.page,
                totalPages: page.totalPages,
                pageSize: page.pageSize,
                totalItems: page.totalItems,
                onPageChange: goToPage,
              }
            : undefined
        }
        paginationText={{ items: t("pagination.items") }}
        emptyState={
          errorKey
            ? {
                icon: <Warning className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("errors.title"),
                description: t(`errors.${errorKey}`),
                action: <Button variant="outline" title={t("actions.refresh")} onClick={reload} />,
              }
            : {
                icon: <MapTrifold className="h-7 w-7 text-muted-foreground" weight="fill" />,
                title: query.search ? t("empty.filteredTitle") : t("empty.title"),
                description: t("empty.description"),
              }
        }
      />
    </main>
  );
}
