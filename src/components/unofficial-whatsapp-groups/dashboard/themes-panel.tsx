"use client";

import { useEffect, useMemo, useState } from "react";
import { useNow, useTranslations } from "next-intl";

import { listGroupThemesAction } from "@/app/actions/unofficial-whatsapp-groups";
import { Skeleton } from "@/components/audience/shared";
import { Hash } from "@/components/icons";
import { PanelFault } from "@/components/unofficial-whatsapp-groups/kit/chart-panel";
import { RankedList } from "@/components/unofficial-whatsapp-groups/kit/charts";
import { CountChip, SearchField, WindowToggle } from "@/components/unofficial-whatsapp-groups/kit/filters";
import { GroupLinks } from "@/components/unofficial-whatsapp-groups/kit/identity";
import { PagedFooter } from "@/components/unofficial-whatsapp-groups/kit/paged-footer";
import { GroupsPanel } from "@/components/unofficial-whatsapp-groups/kit/panel";
import { useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import type { PageMeta, ThemeAggregate } from "@/lib/unofficial-whatsapp-groups/types";

const THEME_PAGE_SIZE = 10;
const THEME_WINDOWS = [7, 30, 90] as const;
type ThemeWindow = (typeof THEME_WINDOWS)[number];
const DEFAULT_THEME_WINDOW: ThemeWindow = 30;

export function ThemesPanel({ timezone, refreshKey, className }: { timezone: string; refreshKey: number; className?: string }) {
  const t = useTranslations("unofficialGroups.dashboard.themesPanel");
  const fmt = useGroupsFormat(timezone);
  const now = useNow({ updateInterval: 60_000 });
  const [days, setDays] = useState<ThemeWindow>(DEFAULT_THEME_WINDOW);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [themes, setThemes] = useState<ThemeAggregate[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestKey = `${days}#${search}#${page}#${attempt}#${refreshKey}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = settledKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    void listGroupThemesAction({ days, search: search || undefined, page, pageSize: THEME_PAGE_SIZE }).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setThemes([]);
        setMeta(null);
      } else {
        setError(null);
        setThemes(result.items.map((theme) => ({ ...theme, groups: theme.groups ?? [] })));
        setMeta(result.meta);
      }
      setSettledKey(requestKey);
    });
    return () => {
      cancelled = true;
    };
  }, [days, search, page, requestKey]);

  const rows = useMemo(
    () =>
      themes.map((theme) => ({
        key: theme.theme,
        label: theme.theme,
        value: theme.occurrences,
        display: t("occurrences", { count: theme.occurrences }),
        hint: theme.lastSeenAt ? t("seen", { when: fmt.relative(theme.lastSeenAt, now) }) : undefined,
        badge: <GroupLinks groups={theme.groups} variant="badge" />,
      })),
    [themes, t, fmt, now],
  );

  return (
    <GroupsPanel
      title={t("title")}
      subtitle={t("subtitle")}
      meta={meta ? <CountChip count={meta.totalItems} noun={(count) => t("count", { count })} filtered={search !== ""} loading={loading} /> : null}
      className={className}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={(next) => {
            setSearch(next);
            setPage(1);
          }}
          placeholder={t("search")}
          ariaLabel={t("search")}
          className="min-w-[10rem] flex-1"
        />
        <WindowToggle<ThemeWindow>
          ariaLabel={t("windowLabel")}
          value={days}
          onChange={(next) => {
            setDays(next);
            setPage(1);
          }}
          options={THEME_WINDOWS.map((value) => ({ value, label: t("days", { count: value }) }))}
        />
      </div>
      {loading && themes.length === 0 ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      ) : error ? (
        <PanelFault error={{ message: error, onRetry: () => setAttempt((current) => current + 1) }} />
      ) : (
        <div aria-busy={loading || undefined} className={loading ? "opacity-60" : undefined}>
          <RankedList
            numbered
            startRank={(page - 1) * THEME_PAGE_SIZE + 1}
            emphasis={page === 1 ? "first" : "none"}
            empty={{ icon: <Hash />, message: search ? t("emptySearch", { search }) : t("empty", { count: days }) }}
            rows={rows}
          />
          {meta ? (
            <PagedFooter
              page={meta.page}
              totalPages={meta.totalPages}
              totalItems={meta.totalItems}
              itemsLabel={(count) => t("count", { count })}
              onPage={setPage}
              busy={loading}
            />
          ) : null}
        </div>
      )}
    </GroupsPanel>
  );
}
