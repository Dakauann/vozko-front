"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";

import {
  ArrowClockwise,
  ArrowsLeftRight,
  ClockCounterClockwise,
  MagnifyingGlass,
  PhoneIncoming,
  PhoneOutgoing,
  WhatsappLogo,
  XCircle,
} from "@/components/icons";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { CallDetailSheet } from "@/components/call-history/call-detail-sheet";
import { CallOutcomeBadge } from "@/components/call-history/call-outcome-badge";
import { listCallsAction } from "@/app/actions/call-history";
import { listMembersAction } from "@/app/actions/workspace";
import { useWorkspace } from "@/contexts/workspace-context";
import { formatCallDuration } from "@/hooks/use-call-clock";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { CALL_PERIODS, contactLabel, periodBounds, type CallPeriod } from "@/lib/call-history/format";
import {
  CALL_CHANNELS,
  CALL_DIRECTIONS,
  CALL_RESULTS,
  type CallChannel,
  type CallDirection,
  type CallListFilters,
  type CallListPage,
  type CallResult,
  type CallSummary,
} from "@/lib/call-history/types";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { formatMicrosAsBrl } from "@/lib/pricing/currency";
import { cn } from "@/lib/utils";
import type { WorkspaceMember } from "@/lib/workspace/types";

const PAGE_SIZES = [25, 50, 100] as const;
const ANY = "any";
const SEARCH_DELAY_MS = 350;
const RELATIVE_TIME_REFRESH_MS = 60_000;

interface Filters {
  period: CallPeriod;
  direction: CallDirection | typeof ANY;
  channel: CallChannel | typeof ANY;
  result: CallResult | typeof ANY;
  memberId: string;
}

interface Loaded {
  key: string;
  page?: CallListPage;
  error?: string;
}

const INITIAL_FILTERS: Filters = { period: "7d", direction: ANY, channel: ANY, result: ANY, memberId: ANY };

function chosen<T extends string>(value: T | typeof ANY): T | undefined {
  return value === ANY ? undefined : (value as T);
}

export default function CallHistoryPage() {
  const t = useTranslations("callHistory");
  const format = useFormatter();
  const now = useNow({ updateInterval: RELATIVE_TIME_REFRESH_MS });
  const { can, currentWorkspace } = useWorkspace();
  const seesTeam = can("call_history", "view_others");
  const exchangeRate = useExchangeRate();

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [numberDraft, setNumberDraft] = useState("");
  const number = useDebouncedValue(numberDraft, SEARCH_DELAY_MS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [refresh, setRefresh] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const query = useMemo<CallListFilters>(
    () => ({
      page,
      pageSize,
      ...periodBounds(filters.period),
      direction: chosen(filters.direction),
      channel: chosen(filters.channel),
      result: chosen(filters.result),
      memberId: seesTeam ? chosen(filters.memberId) : undefined,
      number: number.trim() || undefined,
    }),
    [filters, number, page, pageSize, seesTeam],
  );
  const queryKey = `${JSON.stringify(query)}#${refresh}`;

  useEffect(() => {
    let cancelled = false;
    void listCallsAction(query).then((result) => {
      if (!cancelled) setLoaded({ key: queryKey, page: result.page, error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [query, queryKey]);

  useEffect(() => {
    if (!seesTeam || !currentWorkspace?.id) return;
    void listMembersAction(currentWorkspace.id).then((result) => setMembers(result.members));
  }, [seesTeam, currentWorkspace?.id]);

  const loading = loaded?.key !== queryKey;
  const current = loaded?.page;
  const calls = current?.items ?? [];

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  };

  const chargeLabel = useCallback(
    (micros: number | undefined) => {
      if (micros === undefined) return "—";
      if (micros <= 0) return t("table.noCharge");
      return formatMicrosAsBrl(micros, exchangeRate) ?? "…";
    },
    [exchangeRate, t],
  );

  const columns = useMemo<DashboardTableColumn<CallSummary>[]>(
    () => [
      {
        key: "when",
        header: t("table.when"),
        render: (row) => (
          <div className="flex flex-col">
            <span className="text-sm text-foreground">{format.dateTime(new Date(row.startedAt), { dateStyle: "short", timeStyle: "short" })}</span>
            <span className="text-xs text-muted-foreground">{format.relativeTime(new Date(row.startedAt), now)}</span>
          </div>
        ),
      },
      {
        key: "contact",
        header: t("table.contact"),
        render: (row) => {
          const contact = contactLabel(row.contact);
          const DirectionIcon = row.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" title={`${t(`directions.${row.direction}`)} · ${t(`channels.${row.channel}`)}`}>
                {row.channel === "whatsapp" ? <WhatsappLogo className="h-4 w-4" aria-hidden /> : <DirectionIcon className="h-4 w-4" aria-hidden />}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{row.contact.name ?? formatPhoneForDisplay(contact.title)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {contact.subtitle ? formatPhoneForDisplay(contact.subtitle) : t(`directions.${row.direction}`)}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        key: "people",
        header: t("table.people"),
        render: (row) => {
          const handler = row.answeredBy?.name ?? row.placedBy?.name;
          return (
            <div className="flex flex-col">
              <span className="text-sm text-foreground">{handler || "—"}</span>
              {row.transfers > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowsLeftRight className="h-3 w-3" aria-hidden />
                  {t("table.transfers", { count: row.transfers })}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "outcome",
        header: t("table.outcome"),
        render: (row) => <CallOutcomeBadge outcome={row.outcome} />,
      },
      {
        key: "duration",
        header: t("table.duration"),
        className: "text-right",
        render: (row) => (
          <span className="readout text-sm tabular-nums text-foreground">{row.talkSeconds > 0 ? formatCallDuration(row.talkSeconds) : "—"}</span>
        ),
      },
      {
        key: "charge",
        header: t("table.charge"),
        className: "text-right",
        render: (row) => <span className="readout text-sm tabular-nums text-foreground">{chargeLabel(row.charge?.amountMicros)}</span>,
      },
    ],
    [chargeLabel, format, now, t],
  );

  const reload = () => setRefresh((value) => value + 1);

  const toolbar = (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
      <ElevatedInput
        type="search"
        label={t("filters.number")}
        value={numberDraft}
        onChange={(event) => {
          setNumberDraft(event.target.value);
          setPage(1);
        }}
        icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
        controlSize="sm"
        className="w-full lg:col-span-2"
      />
      <ElevatedSelect label={t("filters.period")} value={filters.period} onValueChange={(value) => updateFilter("period", value as CallPeriod)}>
        {CALL_PERIODS.map((period) => (
          <ElevatedSelectItem key={period} value={period}>
            {t(`periods.${period}`)}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      <ElevatedSelect label={t("filters.direction")} value={filters.direction} onValueChange={(value) => updateFilter("direction", value as Filters["direction"])}>
        <ElevatedSelectItem value={ANY}>{t("filters.any")}</ElevatedSelectItem>
        {CALL_DIRECTIONS.map((direction) => (
          <ElevatedSelectItem key={direction} value={direction}>
            {t(`directions.${direction}`)}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      <ElevatedSelect label={t("filters.channel")} value={filters.channel} onValueChange={(value) => updateFilter("channel", value as Filters["channel"])}>
        <ElevatedSelectItem value={ANY}>{t("filters.any")}</ElevatedSelectItem>
        {CALL_CHANNELS.map((channel) => (
          <ElevatedSelectItem key={channel} value={channel}>
            {t(`channels.${channel}`)}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      <ElevatedSelect label={t("filters.result")} value={filters.result} onValueChange={(value) => updateFilter("result", value as Filters["result"])}>
        <ElevatedSelectItem value={ANY}>{t("filters.any")}</ElevatedSelectItem>
        {CALL_RESULTS.map((result) => (
          <ElevatedSelectItem key={result} value={result}>
            {t(`results.${result}`)}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      {seesTeam ? (
        <ElevatedSelect label={t("filters.member")} value={filters.memberId} onValueChange={(value) => updateFilter("memberId", value)} className="lg:col-span-2">
          <ElevatedSelectItem value={ANY}>{t("filters.everyone")}</ElevatedSelectItem>
          {members.map((member) => (
            <ElevatedSelectItem key={member.userId} value={member.userId}>
              {member.username || member.email}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      ) : null}
    </div>
  );

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader
        badge={t("page.title")}
        description={seesTeam ? t("page.descriptionTeam") : t("page.descriptionOwn")}
        icon={<ClockCounterClockwise className="h-6 w-6" />}
        colorClass="text-info-ink"
      />

      <DashboardTable<CallSummary>
        data={calls}
        columns={columns}
        rowKey={(row) => row.callId}
        loading={loading}
        onRowClick={(row) => setSelected(row.callId)}
        toolbar={toolbar}
        stats={[{ label: t("stats.calls"), value: loading ? "…" : (current?.totalItems ?? 0), icon: <PhoneOutgoing className="h-4 w-4 text-info-ink" /> }]}
        headerRight={
          <Button
            variant="ghost"
            title=""
            aria-label={t("page.refresh")}
            icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", loading && "animate-spin")} />}
            iconVisible
            iconSide="left"
            onClick={reload}
          />
        }
        pagination={
          current && current.totalItems > 0
            ? {
                currentPage: current.page,
                totalPages: current.totalPages,
                pageSize: current.pageSize,
                totalItems: current.totalItems,
                onPageChange: setPage,
                pageSizeOptions: PAGE_SIZES,
                onPageSizeChange: (size) => {
                  setPageSize(size);
                  setPage(1);
                },
              }
            : undefined
        }
        emptyState={
          loaded?.error
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("page.errorTitle"),
                description: loaded.error,
                action: <Button variant="secondary" title={t("page.retry")} onClick={reload} />,
              }
            : {
                icon: <ClockCounterClockwise className="h-7 w-7 text-muted-foreground" />,
                title: t("page.emptyTitle"),
                description: t("page.emptyDescription"),
              }
        }
      />

      <CallDetailSheet callId={selected} onOpenChange={(open) => !open && setSelected(null)} chargeLabel={chargeLabel} />
    </div>
  );
}
