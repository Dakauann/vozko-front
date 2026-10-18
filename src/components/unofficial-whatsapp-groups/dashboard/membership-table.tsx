"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { getMembershipAction } from "@/app/actions/unofficial-whatsapp-groups";
import ElevatedSelect, { ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { UsersThree } from "@/components/icons";
import { useTableEmpty } from "@/components/unofficial-whatsapp-groups/kit/empty";
import { RateCell, SignedFigure } from "@/components/unofficial-whatsapp-groups/kit/figures";
import { ActiveFilterChips, CountChip, SearchField, WindowToggle, type ActiveFilter } from "@/components/unofficial-whatsapp-groups/kit/filters";
import { GroupIdentity, OriginChip } from "@/components/unofficial-whatsapp-groups/kit/identity";
import { KpiBand, type KpiCell } from "@/components/unofficial-whatsapp-groups/kit/kpi-band";
import { GroupsPanel } from "@/components/unofficial-whatsapp-groups/kit/panel";
import { RelativeTime } from "@/components/unofficial-whatsapp-groups/kit/relative-time";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useGroupName, useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import { Link, useRouter } from "@/i18n/routing";
import type {
  CategoryCount,
  MembershipParams,
  MembershipPeriod,
  MembershipStat,
  MembershipSummary,
  MembershipWindow,
  PageMeta,
} from "@/lib/unofficial-whatsapp-groups/types";

import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_NONE,
  categoryFilterParam,
  DEFAULT_MEMBERSHIP_SORT,
  isMembershipSort,
  MEMBERSHIP_SORTS,
  membershipFilterActive,
  toggleMembershipSort,
  type MembershipSortState,
  type OriginFilter,
} from "./dashboard-data";

const PAGE_SIZES = [25, 50, 100] as const;
const PERIODS: MembershipPeriod[] = ["month", "7d", "30d", "90d"];
const ORIGINS: OriginFilter[] = ["all", "managed", "external"];
const NUMERIC = "text-right";
const FOOT_CELL = "px-4 py-2.5";

interface LedgerData {
  rows: MembershipStat[];
  meta: PageMeta | null;
  summary: MembershipSummary | null;
  window: MembershipWindow | null;
}

const EMPTY_LEDGER: LedgerData = { rows: [], meta: null, summary: null, window: null };

export function MembershipTable({
  categories,
  timezone,
  refreshKey,
}: {
  categories: CategoryCount[];
  timezone: string;
  refreshKey: number;
}) {
  const t = useTranslations("unofficialGroups.dashboard.ledger");
  const tp = useTranslations("unofficialGroups.dashboard.membership.periods");
  const tLast = useTranslations("unofficialGroups.kit.format.lastEvent");
  const fmt = useGroupsFormat(timezone);
  const groupName = useGroupName();
  const router = useRouter();
  const tableEmpty = useTableEmpty();
  const emptyLabel = useEmptyValue();

  const [period, setPeriod] = useState<MembershipPeriod>("month");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [category, setCategory] = useState<string>(CATEGORY_FILTER_ALL);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<MembershipSortState>(DEFAULT_MEMBERSHIP_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<LedgerData>(EMPTY_LEDGER);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo<MembershipParams>(
    () => ({
      period,
      origin: origin === "all" ? undefined : origin,
      category: categoryFilterParam(category),
      search: search || undefined,
      sort: sort.key,
      desc: sort.direction === "desc",
      page,
      pageSize,
    }),
    [period, origin, category, search, sort, page, pageSize],
  );
  const requestKey = `${JSON.stringify(params)}#${attempt}#${refreshKey}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = settledKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    void getMembershipAction(params).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setData(EMPTY_LEDGER);
      } else {
        setError(null);
        setData({ rows: result.rows, meta: result.meta, summary: result.summary, window: result.window });
      }
      setSettledKey(requestKey);
    });
    return () => {
      cancelled = true;
    };
  }, [params, requestKey]);

  const resetPage = useCallback(() => setPage(1), []);
  const filtered = membershipFilterActive({ search, origin, category });
  const clearAll = useCallback(() => {
    setSearch("");
    setOrigin("all");
    setCategory(CATEGORY_FILTER_ALL);
    setPage(1);
  }, []);

  const namedCategories = useMemo(
    () => [...new Set(categories.map((item) => item.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [categories],
  );

  const categoryLabel = category === CATEGORY_FILTER_NONE ? t("categoryNone") : category;
  const activeFilters: ActiveFilter[] = [
    ...(search ? [{ key: "search", label: t("filters.search", { value: search }), onClear: () => { setSearch(""); resetPage(); } }] : []),
    ...(origin !== "all" ? [{ key: "origin", label: t("filters.origin", { value: t(`origins.${origin}`) }), onClear: () => { setOrigin("all"); resetPage(); } }] : []),
    ...(category !== CATEGORY_FILTER_ALL
      ? [{ key: "category", label: t("filters.category", { value: categoryLabel }), onClear: () => { setCategory(CATEGORY_FILTER_ALL); resetPage(); } }]
      : []),
  ];

  const { rows, meta, summary, window } = data;
  const firstLoad = loading && summary === null;

  const summaryCells: KpiCell[] = summary
    ? [
        {
          key: "members",
          label: t("summary.members"),
          value: fmt.num(summary.members),
          sub: t("summary.membersSub", { count: fmt.num(summary.startMembers) }),
        },
        { key: "joins", label: t("summary.joins"), value: fmt.signed(summary.joins) },
        {
          key: "leaves",
          label: t("summary.leaves"),
          value: fmt.signed(-summary.leaves),
          sub: summary.churnRate === null ? t("summary.noBase") : t("summary.churnSub", { rate: fmt.pct(summary.churnRate) }),
        },
        {
          key: "net",
          label: t("summary.net"),
          value: fmt.signed(summary.net),
          sub: summary.growthRate === null ? t("summary.noBase") : t("summary.growthSub", { rate: fmt.signedPct(summary.growthRate) }),
        },
        { key: "messages", label: t("summary.messages"), value: fmt.num(summary.messages), sub: tp(period) },
      ]
    : [];

  const columns = useMemo<DashboardTableColumn<MembershipStat>[]>(
    () => [
      {
        key: "name",
        sortKey: "name",
        header: t("columns.group"),
        render: (row) => (
          <div className="min-w-[12rem] max-w-[18rem]">
            <GroupIdentity
              group={{ id: row.groupId, subject: row.subject, category: row.category?.trim() || emptyLabel }}
              href={groupsRoutes.group(row.groupId)}
              sub="category"
            />
          </div>
        ),
      },
      {
        key: "type",
        header: t("columns.type"),
        render: (row) => <OriginChip origin={row.origin} numbers={row.numbers} />,
      },
      {
        key: "members",
        sortKey: "members",
        header: t("columns.members"),
        className: NUMERIC,
        render: (row) => (
          <span className="inline-flex flex-col items-end leading-tight">
            <span className="readout text-xs font-semibold tabular-nums text-foreground">{fmt.num(row.members)}</span>
            <span className="readout text-[11px] tabular-nums text-muted-foreground">{t("startMembers", { count: fmt.num(row.startMembers) })}</span>
          </span>
        ),
      },
      {
        key: "joins",
        sortKey: "joins",
        header: t("columns.joins"),
        className: NUMERIC,
        render: (row) => <span className="readout text-xs tabular-nums text-foreground">{fmt.signed(row.joins)}</span>,
      },
      {
        key: "leaves",
        sortKey: "leaves",
        header: t("columns.leaves"),
        className: NUMERIC,
        render: (row) =>
          row.leaves > 0 ? (
            <Link
              href={groupsRoutes.group(row.groupId, { tab: "members", members: { status: "left" } })}
              onClick={(event) => event.stopPropagation()}
              aria-label={t("leavesLink", { group: groupName(row.subject) })}
              className="readout rounded-sm text-xs tabular-nums text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {fmt.signed(-row.leaves)}
            </Link>
          ) : (
            <span className="readout text-xs tabular-nums text-foreground">{fmt.num(0)}</span>
          ),
      },
      {
        key: "churn",
        sortKey: "churn",
        header: t("columns.churn"),
        className: NUMERIC,
        render: (row) => <RateCell rate={row.churnRate} />,
      },
      {
        key: "net",
        sortKey: "net",
        header: t("columns.net"),
        className: NUMERIC,
        render: (row) => <SignedFigure value={row.net} rate={row.growthRate} noBaseLabel={t("summary.noBase")} className="text-xs" />,
      },
      {
        key: "messages",
        sortKey: "messages",
        header: t("columns.messages"),
        className: NUMERIC,
        render: (row) => <span className="readout text-xs tabular-nums text-foreground">{fmt.num(row.messages)}</span>,
      },
      {
        key: "lastEvent",
        header: t("columns.lastEvent"),
        className: NUMERIC,
        render: (row) => (
          <RelativeTime
            at={row.lastMemberEventAt}
            mode="lastEvent"
            timeZone={timezone}
            emptyLabel={tLast("none")}
            className="readout whitespace-nowrap text-xs text-muted-foreground"
          />
        ),
      },
      {
        key: "lastActivity",
        header: t("columns.lastActivity"),
        className: NUMERIC,
        render: (row) => (
          <RelativeTime at={row.lastActivity} timeZone={timezone} className="readout whitespace-nowrap text-xs text-muted-foreground" />
        ),
      },
    ],
    [t, fmt, groupName, emptyLabel, tLast, timezone],
  );

  const footer = summary ? (
    <tr>
      <td colSpan={2} className={`${FOOT_CELL} text-xs font-semibold text-foreground`}>
        {t("total", { count: summary.groups })}
      </td>
      <td className={`${FOOT_CELL} ${NUMERIC} readout text-xs font-semibold tabular-nums text-foreground`}>{fmt.num(summary.members)}</td>
      <td className={`${FOOT_CELL} ${NUMERIC} readout text-xs font-semibold tabular-nums text-foreground`}>{fmt.signed(summary.joins)}</td>
      <td className={`${FOOT_CELL} ${NUMERIC} readout text-xs font-semibold tabular-nums text-foreground`}>{fmt.signed(-summary.leaves)}</td>
      <td className={`${FOOT_CELL} ${NUMERIC}`}>
        <RateCell rate={summary.churnRate} />
      </td>
      <td className={`${FOOT_CELL} ${NUMERIC}`}>
        <SignedFigure value={summary.net} rate={summary.growthRate} noBaseLabel={t("summary.noBase")} className="text-xs" />
      </td>
      <td className={`${FOOT_CELL} ${NUMERIC} readout text-xs font-semibold tabular-nums text-foreground`}>{fmt.num(summary.messages)}</td>
      <td className={FOOT_CELL} />
      <td className={FOOT_CELL} />
    </tr>
  ) : undefined;

  const toolbar = (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex w-full flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={(next) => {
            setSearch(next);
            setPage(1);
          }}
          placeholder={t("search")}
          ariaLabel={t("search")}
        />
        <WindowToggle<OriginFilter>
          ariaLabel={t("originLabel")}
          value={origin}
          onChange={(next) => {
            setOrigin(next);
            setPage(1);
          }}
          options={ORIGINS.map((value) => ({ value, label: t(`origins.${value}`) }))}
        />
        <div className="w-full sm:w-48">
          <ElevatedSelect
            label={t("categoryLabel")}
            value={category}
            onValueChange={(next) => {
              setCategory(next);
              setPage(1);
            }}
          >
            <ElevatedSelectItem value={CATEGORY_FILTER_ALL}>{t("categoryAll")}</ElevatedSelectItem>
            {namedCategories.map((name) => (
              <ElevatedSelectItem key={name} value={name}>
                {name}
              </ElevatedSelectItem>
            ))}
            <ElevatedSelectItem value={CATEGORY_FILTER_NONE}>{t("categoryNone")}</ElevatedSelectItem>
          </ElevatedSelect>
        </div>
        <div className="w-full sm:w-44">
          <ElevatedSelect
            label={t("sortLabel")}
            value={sort.key}
            onValueChange={(next) => {
              if (!isMembershipSort(next)) return;
              setSort({ key: next, direction: next === "name" ? "asc" : "desc" });
              setPage(1);
            }}
          >
            {MEMBERSHIP_SORTS.map((key) => (
              <ElevatedSelectItem key={key} value={key}>
                {t(`sorts.${key}`)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
        <WindowToggle<MembershipPeriod>
          ariaLabel={t("periodLabel")}
          className="sm:ml-auto"
          value={period}
          onChange={(next) => {
            setPeriod(next);
            setPage(1);
          }}
          options={PERIODS.map((value) => ({ value, label: tp(value) }))}
        />
      </div>
      <ActiveFilterChips
        filters={activeFilters}
        onClearAll={clearAll}
        resultLabel={meta && !loading ? t("result", { count: meta.totalItems }) : undefined}
      />
    </div>
  );

  return (
    <GroupsPanel
      boxed={false}
      title={t("title")}
      subtitle={window ? t("subtitle", { range: fmt.windowRange(window) }) : t("subtitlePlain")}
      meta={summary ? <CountChip count={summary.groups} noun={(count) => t("count", { count })} filtered={filtered} loading={loading} /> : null}
    >
      <div className="space-y-3">
        {summary || firstLoad ? <KpiBand label={t("summaryLabel")} cells={summaryCells} columns={5} loading={summary === null} /> : null}
        <DashboardTable<MembershipStat>
          data={rows}
          columns={columns}
          rowKey={(row) => row.groupId}
          loading={loading}
          onRowClick={(row) => router.push(groupsRoutes.group(row.groupId))}
          toolbar={toolbar}
          sorting={{
            sorts: [sort],
            onToggle: (key) => {
              if (!isMembershipSort(key)) return;
              setSort((current) => toggleMembershipSort(current, key));
              setPage(1);
            },
          }}
          footer={footer}
          pagination={
            meta && meta.totalItems > 0
              ? {
                  currentPage: meta.page,
                  totalPages: meta.totalPages,
                  pageSize,
                  totalItems: meta.totalItems,
                  onPageChange: setPage,
                  pageSizeOptions: PAGE_SIZES,
                  onPageSizeChange: (next) => {
                    setPageSize(next);
                    setPage(1);
                  },
                }
              : undefined
          }
          paginationText={{ showing: t("pagination.showing"), of: t("pagination.of"), items: t("pagination.items"), perPage: t("pagination.perPage") }}
          emptyState={
            error
              ? tableEmpty.error(t("error"), () => setAttempt((current) => current + 1))
              : filtered
                ? tableEmpty.noMatches(t("noun"), clearAll)
                : tableEmpty.firstUse({ icon: <UsersThree className="h-7 w-7 text-muted-foreground" />, title: t("empty"), description: t("emptyHint") })
          }
        />
      </div>
    </GroupsPanel>
  );
}
