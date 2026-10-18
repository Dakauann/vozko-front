"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listGroupPeopleAction } from "@/app/actions/unofficial-whatsapp-groups";
import { Meter } from "@/components/charts/vozko";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import {
  DashboardTable,
  type DashboardTableColumn,
  type DashboardTableEmptyState,
} from "@/components/elevated-design/table/dashboard-table";
import {
  ArrowClockwise,
  CaretDown,
  EyeSlash,
  IdentificationCard,
  MagnifyingGlass,
  UsersThree,
} from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useTableEmpty } from "@/components/unofficial-whatsapp-groups/kit/empty";
import { CountChip, SearchField, WindowToggle } from "@/components/unofficial-whatsapp-groups/kit/filters";
import { GroupLinks, PersonIdentity } from "@/components/unofficial-whatsapp-groups/kit/identity";
import { RelativeTime } from "@/components/unofficial-whatsapp-groups/kit/relative-time";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useGroupName, useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import { useWorkspace } from "@/contexts/workspace-context";
import { Link } from "@/i18n/routing";
import type { GroupPerson } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import {
  DEFAULT_PEOPLE_PAGE_SIZE,
  PEOPLE_PAGE_SIZES,
  memberSearchOf,
  minGroupOptions,
  pageCounts,
  parsePeopleQuery,
  peopleHref,
  personSource,
} from "./people-model";

const GROUP_CHIP_LIMIT = 4;

const NEUTRAL_BAR = "hsl(var(--muted-foreground) / 0.45)";

interface PageMeta {
  totalPages: number;
  totalItems: number;
}

const EMPTY_META: PageMeta = { totalPages: 0, totalItems: 0 };

export default function GroupPeoplePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <GroupPeople />
    </Suspense>
  );
}

function GroupPeople() {
  const t = useTranslations("unofficialGroups.people");
  const fmt = useGroupsFormat();
  const tableEmpty = useTableEmpty();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can } = useWorkspace();
  const canOpenLeads = can("leads", "read");
  const { search, minGroups } = useMemo(() => parsePeopleQuery(new URLSearchParams(searchParams.toString())), [searchParams]);

  const [people, setPeople] = useState<GroupPerson[]>([]);
  const [meta, setMeta] = useState<PageMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PEOPLE_PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const lastGoodFilterRef = useRef<string | null>(null);
  const requestRef = useRef(0);

  const filterKey = `${search}|${minGroups}|${page}|${pageSize}`;
  const requestKey = `${filterKey}|${refreshKey}`;
  const loading = settledKey !== requestKey;

  useEffect(() => {
    const request = ++requestRef.current;
    void listGroupPeopleAction({ search: search || undefined, minGroups, page, pageSize }).then((result) => {
      if (request !== requestRef.current) return;
      setSettledKey(requestKey);
      if (result.error) {
        if (lastGoodFilterRef.current === filterKey) {
          toast.error(t("error.reload"), { description: result.error });
          return;
        }
        setPeople([]);
        setMeta(EMPTY_META);
        setError(result.error);
        return;
      }
      lastGoodFilterRef.current = filterKey;
      setError(null);
      setPeople(result.items);
      setMeta({ totalPages: result.meta.totalPages, totalItems: result.meta.totalItems });
    });
  }, [search, minGroups, page, pageSize, filterKey, requestKey, t]);

  const applyFilters = useCallback(
    (next: { search?: string; minGroups?: number }) => {
      const href = peopleHref(next.search ?? search, next.minGroups ?? minGroups);
      const query = href.includes("?") ? href.slice(href.indexOf("?")) : "";
      setPage(1);
      setExpanded(new Set());
      router.replace(`${pathname}${query}`, { scroll: false });
    },
    [search, minGroups, pathname, router],
  );

  const reload = useCallback(() => setRefreshKey((value) => value + 1), []);

  const toggleRow = useCallback((personKey: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(personKey)) next.delete(personKey);
      else next.add(personKey);
      return next;
    });
  }, []);

  const counts = useMemo(() => pageCounts(people), [people]);
  const pageScoped = meta.totalPages > 1;
  const pageLabel = (label: string) => (pageScoped ? t("stats.onPage", { label }) : label);
  const statValue = (value: number) => {
    if (loading) return "…";
    if (error) return <EmptyValue />;
    return fmt.num(value);
  };

  const columns = useMemo<DashboardTableColumn<GroupPerson>[]>(
    () => [
      {
        key: "person",
        header: t("table.person"),
        className: "min-w-[14rem]",
        render: (person) => <PersonIdentity person={personSource(person)} showJid />,
      },
      {
        key: "groupCount",
        header: t("table.groupCount"),
        className: "w-32",
        render: (person) => (
          <div className="flex items-center gap-2">
            <span className="readout w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
              {fmt.num(person.groupCount)}
            </span>
            <Meter
              value={counts.maxGroups > 0 ? (person.groupCount / counts.maxGroups) * 100 : 0}
              color={NEUTRAL_BAR}
              size="sm"
              className="w-16"
              label={t("table.groupCountMeter", { count: person.groupCount, max: counts.maxGroups })}
            />
          </div>
        ),
      },
      {
        key: "groups",
        header: t("table.groups"),
        className: "min-w-[16rem]",
        render: (person) => <GroupLinks groups={person.groups} limit={GROUP_CHIP_LIMIT} />,
      },
      {
        key: "lead",
        header: t("table.lead"),
        render: (person) => {
          if (!person.leadId) return <EmptyValue className="text-xs" />;
          const leadLabel = person.leadName?.trim() || t("table.leadUnnamed");
          if (!canOpenLeads) return <span className="text-xs text-muted-foreground">{leadLabel}</span>;
          return (
            <Link
              href={groupsRoutes.lead(person.leadId)}
              onClick={(event) => event.stopPropagation()}
              className="rounded-sm text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {leadLabel}
            </Link>
          );
        },
      },
      {
        key: "lastJoinAt",
        header: t("table.lastJoin"),
        render: (person) => <RelativeTime at={person.lastJoinAt} className="readout whitespace-nowrap text-xs tabular-nums text-muted-foreground" />,
      },
    ],
    [t, fmt, counts.maxGroups, canOpenLeads],
  );

  const emptyState = useMemo<DashboardTableEmptyState>(() => {
    if (error) return tableEmpty.error(t("error.title"), reload);
    if (search) {
      return {
        icon: <MagnifyingGlass className="h-7 w-7 text-muted-foreground" />,
        title: t("empty.noResult", { search }),
        action: <Button variant="secondary" title={t("empty.clearSearch")} onClick={() => applyFilters({ search: "" })} />,
      };
    }
    return tableEmpty.firstUse({
      icon: <UsersThree className="h-7 w-7 text-muted-foreground" weight="fill" />,
      title: t("empty.nobody", { count: minGroups }),
      description: t("empty.nobodyHint"),
    });
  }, [error, search, minGroups, t, tableEmpty, reload, applyFilters]);

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        icon={<UsersThree className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        title={t("header.title")}
        description={t("header.description")}
        meta={<CountChip count={meta.totalItems} loading={loading} noun={(count) => t("header.count", { count })} />}
        actions={
          <Button
            variant="command"
            aria-label={t("actions.refresh")}
            title=""
            icon={<ArrowClockwise className={cn("h-4 w-4", loading && "animate-spin")} weight="bold" />}
            iconVisible
            onClick={reload}
            disabled={loading}
          />
        }
      />

      <DashboardTable<GroupPerson>
        data={error ? [] : people}
        columns={columns}
        rowKey={(person) => person.personKey}
        loading={loading}
        stats={[
          {
            label: t("stats.people"),
            value: statValue(meta.totalItems),
            icon: <UsersThree className="h-4 w-4 text-muted-foreground" weight="fill" />,
          },
          {
            label: pageLabel(t("stats.withLead")),
            value: statValue(counts.withLead),
            icon: <IdentificationCard className="h-4 w-4 text-muted-foreground" />,
          },
          {
            label: pageLabel(t("stats.hiddenNumber")),
            value: statValue(counts.hidden),
            icon: <EyeSlash className="h-4 w-4 text-muted-foreground" />,
          },
        ]}
        headerLeft={
          <SearchField
            value={search}
            onChange={(next) => applyFilters({ search: next })}
            placeholder={t("searchAny")}
            ariaLabel={t("searchAny")}
            className="w-full sm:w-72"
          />
        }
        headerRight={
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-xs text-muted-foreground">{t("minGroups.title")}</span>
            <WindowToggle<number>
              value={minGroups}
              onChange={(next) => applyFilters({ minGroups: next })}
              ariaLabel={t("minGroups.title")}
              options={minGroupOptions(minGroups).map((value) => ({ value, label: t("minGroups.option", { count: value }) }))}
            />
          </div>
        }
        onRowClick={(person) => toggleRow(person.personKey)}
        isRowExpanded={(person) => expanded.has(person.personKey)}
        renderExpandedRow={(person) => <PersonGroups person={person} />}
        renderRowActions={(person) => {
          const open = expanded.has(person.personKey);
          return (
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? t("table.collapse") : t("table.expand")}
              title={open ? t("table.collapse") : t("table.expand")}
              onClick={(event) => {
                event.stopPropagation();
                toggleRow(person.personKey);
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CaretDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} weight="bold" />
            </button>
          );
        }}
        pagination={
          meta.totalItems > 0 && !error
            ? {
                currentPage: page,
                totalPages: Math.max(1, meta.totalPages),
                pageSize,
                totalItems: meta.totalItems,
                onPageChange: setPage,
                pageSizeOptions: PEOPLE_PAGE_SIZES,
                onPageSizeChange: (next) => {
                  setPageSize(next);
                  setPage(1);
                },
              }
            : undefined
        }
        paginationText={{ items: t("pagination.items") }}
        emptyState={emptyState}
      />
    </main>
  );
}

function PersonGroups({ person }: { person: GroupPerson }) {
  const t = useTranslations("unofficialGroups.people.expanded");
  const groupName = useGroupName();
  const memberSearch = memberSearchOf(person);
  const linkClass =
    "rounded-sm text-2xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="border-t border-border bg-muted px-4 py-3">
      <p className="mb-2 text-2xs font-semibold text-muted-foreground">{t("title", { count: person.groups.length })}</p>
      <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
        {person.groups.map((group) => (
          <li key={group.groupId} className="flex min-w-0 flex-col gap-1 border-t border-border py-2">
            <span className="truncate text-xs font-semibold text-foreground" title={groupName(group.subject)}>
              {groupName(group.subject)}
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link href={groupsRoutes.group(group.groupId)} className={linkClass}>
                {t("openGroup")}
              </Link>
              <Link
                href={groupsRoutes.group(group.groupId, { members: { search: memberSearch, status: "all" } })}
                className={linkClass}
              >
                {t("openMembers")}
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
