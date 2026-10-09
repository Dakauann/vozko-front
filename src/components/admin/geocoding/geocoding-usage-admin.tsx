"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { adminListGeocodingUsageAction, type GeocodingPlatformResult } from "@/app/actions/geocoding-platform";
import { Meter } from "@/components/charts/vozko";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowsClockwise, Buildings, CalendarCheck, MagnifyingGlass, MapTrifold, Warning } from "@/components/icons";
import { useGeocodingProviderName } from "@/hooks/use-geocoding-provider-name";
import {
  geocodingPlatformErrorKey,
  geocodingPlatformUsage,
  type GeocodingPlatformCoverage,
  type GeocodingPlatformWorkspace,
} from "@/lib/workspace/workspace-config/geocoding-platform";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const BRASILIA = "America/Sao_Paulo";

const COVERAGE_LINES = ["onMap", "approximate", "withoutAddress", "pending", "notFound", "quotaExceeded", "refused"] as const satisfies readonly (keyof GeocodingPlatformCoverage)[];

type Query = { page: number; search: string };

function UsageCell({ item }: { item: GeocodingPlatformWorkspace }) {
  const t = useTranslations("adminGeocoding.usage");
  const usage = geocodingPlatformUsage(item);
  if (usage.state === "off") return <span className="text-sm text-muted-foreground">{t("off")}</span>;
  if (usage.state === "none") return <span className="text-sm text-warning-ink">{t("none")}</span>;
  return (
    <div className="flex min-w-[11rem] flex-col gap-1.5">
      <Meter
        size="sm"
        value={usage.percent ?? 0}
        label={t("meter")}
        color={usage.state === "reached" ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))"}
      />
      <span className="readout text-xs text-foreground">
        {t("value", { used: item.usedThisCycle, ceiling: item.monthlyCeiling })}
        {item.ceilingSet ? null : <span className="ml-1 text-muted-foreground">({t("defaultCeiling")})</span>}
      </span>
      <span className="readout text-2xs text-muted-foreground">{t("today", { count: item.usedToday })}</span>
    </div>
  );
}

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
  const format = useFormatter();
  const total = item.months.reduce((sum, month) => sum + month.requests, 0);
  return (
    <div className="grid gap-6 border-t border-border bg-muted px-6 py-4 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t("history")}</h3>
          <span className="readout text-xs text-muted-foreground">{t("historyTotal", { count: total })}</span>
        </div>
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {item.months.map((month) => (
            <li key={month.cycleStart} className="rounded-[--radius] border border-border bg-card px-2.5 py-2">
              <p className="text-2xs text-muted-foreground">
                {format.dateTime(new Date(month.cycleStart), { month: "short", year: "numeric", timeZone: BRASILIA })}
              </p>
              <p className="readout text-sm font-semibold text-foreground">{format.number(month.requests)}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("coverage")}</h3>
        <ul className="space-y-1.5 text-xs text-foreground">
          {COVERAGE_LINES.map((line) => (
            <li key={line} className="readout">
              {tSummary(line, { count: item.coverage[line] })}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function GeocodingUsageAdmin() {
  const t = useTranslations("adminGeocoding");
  const tSummary = useTranslations("leadMap.summary");
  const format = useFormatter();
  const providerName = useGeocodingProviderName();

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
    void adminListGeocodingUsageAction({ page: query.page, pageSize: PAGE_SIZE, search: query.search }, controller.signal).then((next) => {
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

  const cycleText = page
    ? t("stats.cycleValue", {
        start: format.dateTime(new Date(page.cycleStart), { dateStyle: "short", timeZone: BRASILIA }),
        end: format.dateTime(new Date(Date.parse(page.nextCycleStart) - 1), { dateStyle: "short", timeZone: BRASILIA }),
      })
    : null;

  const columns = useMemo<DashboardTableColumn<GeocodingPlatformWorkspace>[]>(
    () => [
      {
        header: t("table.workspace"),
        key: "workspace",
        render: (item) => <p className="truncate text-sm font-semibold text-foreground">{item.workspaceName}</p>,
      },
      {
        header: t("table.provider"),
        key: "provider",
        render: (item) =>
          item.enabled ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-foreground">{providerName(item.provider)}</span>
              <span className="text-2xs text-muted-foreground">
                {item.providerChangedAt
                  ? t("provider.since", { date: format.dateTime(new Date(item.providerChangedAt), { dateStyle: "short", timeZone: BRASILIA }) })
                  : t("provider.active")}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">{t("provider.none")}</span>
          ),
      },
      {
        header: t("table.usage"),
        key: "usage",
        render: (item) => <UsageCell item={item} />,
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
    [t, tSummary, format, providerName, expanded],
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
          {
            label: t("stats.cycle"),
            value: cycleText ?? "...",
            icon: <CalendarCheck className="h-4 w-4 text-muted-foreground" weight="fill" />,
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
