"use client";

import {
  Calendar,
  CurrencyDollar,
  FunnelSimple,
  Phone,
  PhoneCall,
  Timer,
  Waveform,
} from "@phosphor-icons/react";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  listCallsAction,
  type CallRecord,
  type ListCallsParams,
} from "@/app/actions/calls";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { ModelBrandIcon } from "@/components/elevated-design/model-brand-icon";
import { cn } from "@/lib/utils";
import { formatMicrosToMoney, formatMicrosToUSD } from "@/lib/format/money";
import { getExchangeRateAction } from "@/app/actions/pricing";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { startOfMonth, subDays } from "date-fns";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import CallRecordingPlayer from "@/components/dashboard/CallRecordingPlayer";

type DatePreset =
  | "thisMonth"
  | "last7Days"
  | "last30Days"
  | "last90Days"
  | "allTime";

const DATE_PRESETS: DatePreset[] = [
  "thisMonth",
  "last7Days",
  "last30Days",
  "last90Days",
  "allTime",
];

const CALL_TYPES = [
  "crm",
  "workflow",
  "trunk_inbound",
  "trunk_outbound",
] as const;

const CALL_SOURCES = [
  "sip",
  "websocket",
  "whatsapp",
  "browser_direct",
] as const;

const CALL_STATUSES = [
  "initiated",
  "ringing",
  "in_progress",
  "completed",
  "failed",
  "abandoned",
] as const;

function getDateRange(preset: DatePreset): { start: Date | null; end: Date } {
  const now = new Date();
  switch (preset) {
    case "thisMonth":
      return { start: startOfMonth(now), end: now };
    case "last7Days":
      return { start: subDays(now, 7), end: now };
    case "last30Days":
      return { start: subDays(now, 30), end: now };
    case "last90Days":
      return { start: subDays(now, 90), end: now };
    case "allTime":
      return { start: null, end: now };
  }
}

function formatDate(value: string | undefined, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case "crm":
      return "bg-purple-500 text-white";
    case "trunk_inbound":
      return "bg-emerald-500 text-white";
    case "trunk_outbound":
      return "bg-amber-500 text-white";
    default:
      return "bg-slate-500 text-white";
  }
}

function directionBadgeClass(direction: string): string {
  return direction === "inbound"
    ? "bg-emerald-500 text-white"
    : "bg-blue-500 text-white";
}

function sourceBadgeClass(source: string): string {
  switch (source) {
    case "sip":
      return "bg-blue-500 text-white";
    case "websocket":
      return "bg-purple-500 text-white";
    case "whatsapp":
      return "bg-green-500 text-white";
    case "browser_direct":
      return "bg-sky-500 text-white";
    default:
      return "bg-slate-500 text-white";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500 text-white";
    case "in_progress":
    case "ringing":
    case "initiated":
      return "bg-blue-500 text-white";
    case "failed":
      return "bg-red-500 text-white";
    case "abandoned":
      return "bg-amber-500 text-white";
    default:
      return "bg-slate-500 text-white";
  }
}

/* ── Reusable detail primitives ─────────────────────────────────── */

function DetailCard({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-muted/30 p-3 space-y-1",
        className,
      )}
    >
      <p className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}:</span>{" "}
      {value && value.length > 0 ? (
        <span className="font-mono text-[10px]">{value}</span>
      ) : (
        <span className="text-muted-foreground">,</span>
      )}
    </p>
  );
}

/* ── Unified expanded row: call metadata + recording + billing audit ── */

function RecordDetail({
  record,
  exchangeRate,
  locale,
  t,
  tb,
}: {
  record: CallRecord;
  exchangeRate: number;
  locale: string;
  t: (key: string) => string;
  tb: (key: string) => string;
}) {
  const billing = record.billing;
  const billedMinutes = billing
    ? Math.max(1, Math.ceil(billing.durationSec / 60))
    : 0;
  const telephonyPerMinMicros =
    billing && billedMinutes > 0
      ? Math.round(billing.telephonyChargeMicros / billedMinutes)
      : 0;
  const hasTelephony = (billing?.telephonyChargeMicros ?? 0) > 0;
  const chargeSum = billing ? billing.telephonyChargeMicros : 0;
  const totalMatches = billing
    ? chargeSum === billing.totalChargeMicros
    : true;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="px-6 pb-5 pt-1 space-y-4">
        {/* Call metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailCard title={t("detail.callInfo")}>
            <div className="space-y-0.5 text-xs text-foreground">
              <Field label={t("detail.callId")} value={record.callId} />
              <Field label={t("detail.internalId")} value={record.id} />
              <p>
                <span className="text-muted-foreground">{t("table.type")}:</span>{" "}
                <span
                  className={cn(
                    "inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                    typeBadgeClass(record.type),
                  )}
                >
                  {t(`type.${record.type}`)}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("table.direction")}:
                </span>{" "}
                <span
                  className={cn(
                    "inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                    directionBadgeClass(record.direction),
                  )}
                >
                  {t(`filters.${record.direction}`)}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("table.source")}:
                </span>{" "}
                <span
                  className={cn(
                    "inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                    sourceBadgeClass(record.source),
                  )}
                >
                  {t(`source.${record.source}`)}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("table.status")}:
                </span>{" "}
                <span
                  className={cn(
                    "inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                    statusBadgeClass(record.status),
                  )}
                >
                  {t(`status.${record.status}`)}
                </span>
              </p>
              {record.endReason ? (
                <Field label={t("detail.endReason")} value={record.endReason} />
              ) : null}
              {record.surrenderReason ? (
                <Field
                  label={t("detail.surrenderReason")}
                  value={record.surrenderReason}
                />
              ) : null}
            </div>
          </DetailCard>

          <DetailCard title={t("detail.identity")}>
            <div className="space-y-0.5 text-xs text-foreground">
              <Field label={t("detail.phoneFrom")} value={record.phoneFrom} />
              <Field label={t("detail.phoneTo")} value={record.phoneTo} />
              <Field label={t("detail.agent")} value={record.agentId} />
              <Field label={t("detail.lead")} value={record.leadId} />
              <Field
                label={t("detail.conversation")}
                value={record.conversationId}
              />
              <Field label={t("detail.trunk")} value={record.trunkId} />
              <Field label={t("detail.parent")} value={record.parentCallId} />
            </div>
          </DetailCard>

          <DetailCard title={t("detail.timing")}>
            <div className="space-y-0.5 text-xs text-foreground">
              <p>
                <span className="text-muted-foreground">
                  {t("detail.started")}:
                </span>{" "}
                {formatDate(record.startedAt, locale)}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("detail.answered")}:
                </span>{" "}
                {formatDate(record.answeredAt, locale)}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("detail.ended")}:
                </span>{" "}
                {formatDate(record.endedAt, locale)}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("detail.duration")}:
                </span>{" "}
                {formatDuration(record.durationSec)}
              </p>
            </div>
          </DetailCard>
        </div>

        {/* Recording */}
        <DetailCard title={t("detail.recording")}>
          {billing?.recordingUrl ? (
            <div className="pt-1">
              <CallRecordingPlayer
                recordingUrl={billing.recordingUrl}
                durationSec={record.durationSec}
                callStart={billing.callStart}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("detail.noRecording")}
            </p>
          )}
        </DetailCard>

        {/* Billing audit */}
        {billing ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DetailCard title={tb("detail.telephony")}>
                <div className="space-y-0.5 text-xs text-foreground">
                  <p>
                    <span className="text-muted-foreground">
                      {tb("detail.actualDuration")}:
                    </span>{" "}
                    {formatDuration(billing.durationSec)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      {tb("detail.billedMinutes")}:
                    </span>{" "}
                    {hasTelephony ? billedMinutes : 0}{" "}
                    <span className="text-muted-foreground">
                      ({tb("detail.ceilingRounded")})
                    </span>
                  </p>
                  {hasTelephony && telephonyPerMinMicros > 0 && (
                    <p>
                      <span className="text-muted-foreground">
                        {tb("detail.ratePerMinute")}:
                      </span>{" "}
                      {formatMicrosToMoney(
                        telephonyPerMinMicros,
                        exchangeRate,
                        locale,
                      )}{" "}
                      ({formatMicrosToUSD(telephonyPerMinMicros)})
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">
                      {tb("detail.cost")}:
                    </span>{" "}
                    {formatMicrosToMoney(
                      billing.telephonyChargeMicros,
                      exchangeRate,
                      locale,
                    )}{" "}
                    ({formatMicrosToUSD(billing.telephonyChargeMicros)})
                  </p>
                </div>
              </DetailCard>
            </div>

            {/* Total equation, auditable */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[10px] uppercase tracking-wide font-bold text-foreground">
                  {tb("detail.totalBreakdown")}
                </p>
                {!totalMatches && (
                  <span className="text-[10px] font-bold text-destructive">
                    {tb("detail.totalMismatch")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-foreground tabular-nums">
                <span>
                  {tb("detail.telephony")}{" "}
                  <span className="font-mono">
                    {formatMicrosToMoney(
                      billing.telephonyChargeMicros,
                      exchangeRate,
                      locale,
                    )}
                  </span>
                </span>
                <span className="text-muted-foreground">=</span>
                <span className="font-bold">
                  {tb("detail.total")}{" "}
                  <span className="font-mono">
                    {formatMicrosToMoney(
                      billing.totalChargeMicros,
                      exchangeRate,
                      locale,
                    )}
                  </span>{" "}
                  <span className="text-muted-foreground font-normal">
                    ({formatMicrosToUSD(billing.totalChargeMicros)})
                  </span>
                </span>
              </div>
              <p className="pt-2 text-[10px] leading-tight text-muted-foreground">
                {tb("detail.transparencyNote")}
              </p>
            </div>
          </>
        ) : (
          <DetailCard title={t("detail.billing")}>
            <p className="text-xs text-muted-foreground">
              {t("detail.noBilling")}
            </p>
          </DetailCard>
        )}
      </div>
    </motion.div>
  );
}

export default function CallsPage() {
  const t = useTranslations("callsPage");
  const tb = useTranslations("callBillingPage");
  const locale = useLocale();

  const [records, setRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("thisMonth");

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  const handleDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getExchangeRateAction();
      if (cancelled) return;
      if (res.item) setExchangeRate(res.item.priceMicros / 1_000_000);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: ListCallsParams = { page: currentPage, pageSize: 15 };
        if (typeFilter !== "all") params.type = typeFilter;
        if (directionFilter !== "all") params.direction = directionFilter;
        if (sourceFilter !== "all") params.source = sourceFilter;
        if (statusFilter !== "all") params.status = statusFilter;
        if (dateRange.start) params.startedFrom = dateRange.start.toISOString();
        params.startedTo = dateRange.end.toISOString();

        const result = await listCallsAction(params);
        if (cancelled) return;
        if (result.error) setError(result.error);
        else {
          setRecords(result.items);
          setTotalPages(result.meta.total_pages);
          setTotalItems(result.meta.total_items);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Failed to load calls");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentPage,
    typeFilter,
    directionFilter,
    sourceFilter,
    statusFilter,
    dateRange,
  ]);

  const summary = useMemo(() => {
    const totalDuration = records.reduce((s, r) => s + r.durationSec, 0);
    const totalCost = records.reduce(
      (s, r) => s + (r.billing?.totalChargeMicros ?? 0),
      0,
    );
    const completed = records.filter((r) => r.status === "completed").length;
    return { totalDuration, totalCost, completed };
  }, [records]);

  const tableColumns = useMemo<DashboardTableColumn<CallRecord>[]>(
    () => [
      {
        key: "startedAt",
        header: t("table.date"),
        render: (row) => (
          <span className="text-sm text-foreground truncate">
            {formatDate(row.startedAt, locale)}
          </span>
        ),
      },
      {
        key: "type",
        header: t("table.type"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
              typeBadgeClass(row.type),
            )}
          >
            {t(`type.${row.type}`)}
          </span>
        ),
      },
      {
        key: "direction",
        header: t("table.direction"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
              directionBadgeClass(row.direction),
            )}
          >
            {t(`filters.${row.direction}`)}
          </span>
        ),
      },
      {
        key: "source",
        header: t("table.source"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
              sourceBadgeClass(row.source),
            )}
          >
            {t(`source.${row.source}`)}
          </span>
        ),
      },
      {
        key: "phone",
        header: t("table.phone"),
        render: (row) => (
          <span className="text-sm text-foreground font-mono">
            {row.direction === "inbound"
              ? (row.phoneFrom ?? "—")
              : (row.phoneTo ?? "—")}
          </span>
        ),
      },
      {
        key: "durationSec",
        header: t("table.duration"),
        render: (row) => (
          <span className="text-sm text-foreground tabular-nums">
            {formatDuration(row.durationSec)}
          </span>
        ),
      },
      {
        key: "cost",
        header: t("table.cost"),
        render: (row) =>
          row.billing ? (
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {formatMicrosToMoney(
                row.billing.totalChargeMicros,
                exchangeRate,
                locale,
              )}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">,</span>
          ),
      },
      {
        key: "recording",
        header: t("table.recording"),
        render: (row) =>
          row.billing?.recordingUrl ? (
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary"
              title={t("detail.recording")}
            >
              <Waveform className="h-3.5 w-3.5" weight="bold" />
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">,</span>
          ),
      },
      {
        key: "status",
        header: t("table.status"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
              statusBadgeClass(row.status),
            )}
          >
            {t(`status.${row.status}`)}
          </span>
        ),
      },
    ],
    [t, locale, exchangeRate],
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <DashboardPageHeader
          icon={<PhoneCall className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.description")}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <DashboardTable<CallRecord>
          stats={[
            {
              label: t("summary.totalCalls"),
              value: loading ? "..." : String(totalItems),
              icon: (
                <PhoneCall className="h-4 w-4 text-blue-500" weight="fill" />
              ),
            },
            {
              label: t("summary.totalDuration"),
              value: loading ? "..." : formatDuration(summary.totalDuration),
              icon: (
                <Timer className="h-4 w-4 text-emerald-500" weight="fill" />
              ),
            },
            {
              label: t("summary.totalCost"),
              value: loading
                ? "..."
                : formatMicrosToMoney(summary.totalCost, exchangeRate, locale),
              icon: (
                <CurrencyDollar
                  className="h-4 w-4 text-amber-500"
                  weight="fill"
                />
              ),
            },
            {
              label: t("summary.completed"),
              value: loading ? "..." : String(summary.completed),
              icon: <Phone className="h-4 w-4 text-violet-500" weight="fill" />,
            },
          ]}
          data={records}
          columns={tableColumns}
          rowKey={(row) => row.id}
          loading={loading}
          toolbar={
            <div className="flex flex-col gap-3 w-full sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FunnelSimple
                  className="h-5 w-5 text-muted-foreground"
                  weight="bold"
                />
                <span className="text-sm font-medium text-foreground">
                  {t("filters.label")}
                </span>
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-3 justify-end">
                <div className="flex items-center gap-1.5">
                  <Calendar
                    className="h-4 w-4 text-muted-foreground"
                    weight="bold"
                  />
                  <ElevatedPillToggle
                    size="md"
                    value={datePreset}
                    onChange={handleDatePreset}
                    options={DATE_PRESETS.map((preset) => ({
                      value: preset,
                      label: t(`filters.${preset}`),
                    }))}
                  />
                </div>

                <ElevatedSelect
                  value={typeFilter}
                  onValueChange={(v) => {
                    setTypeFilter(v);
                    setCurrentPage(1);
                  }}
                  className="w-auto min-w-[140px]"
                >
                  <ElevatedSelectItem value="all">
                    {t("filters.allTypes")}
                  </ElevatedSelectItem>
                  {CALL_TYPES.map((tp) => (
                    <ElevatedSelectItem key={tp} value={tp}>
                      {t(`type.${tp}`)}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>

                <ElevatedSelect
                  value={directionFilter}
                  onValueChange={(v) => {
                    setDirectionFilter(v);
                    setCurrentPage(1);
                  }}
                  className="w-auto min-w-[140px]"
                >
                  <ElevatedSelectItem value="all">
                    {t("filters.allDirections")}
                  </ElevatedSelectItem>
                  <ElevatedSelectItem value="inbound">
                    {t("filters.inbound")}
                  </ElevatedSelectItem>
                  <ElevatedSelectItem value="outbound">
                    {t("filters.outbound")}
                  </ElevatedSelectItem>
                </ElevatedSelect>

                <ElevatedSelect
                  value={sourceFilter}
                  onValueChange={(v) => {
                    setSourceFilter(v);
                    setCurrentPage(1);
                  }}
                  className="w-auto min-w-[140px]"
                >
                  <ElevatedSelectItem value="all">
                    {t("filters.allSources")}
                  </ElevatedSelectItem>
                  {CALL_SOURCES.map((s) => (
                    <ElevatedSelectItem key={s} value={s}>
                      {t(`source.${s}`)}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>

                <ElevatedSelect
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setCurrentPage(1);
                  }}
                  className="w-auto min-w-[140px]"
                >
                  <ElevatedSelectItem value="all">
                    {t("filters.allStatuses")}
                  </ElevatedSelectItem>
                  {CALL_STATUSES.map((s) => (
                    <ElevatedSelectItem key={s} value={s}>
                      {t(`status.${s}`)}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
              </div>
            </div>
          }
          pagination={
            totalPages > 1
              ? {
                  currentPage,
                  totalPages,
                  pageSize: 15,
                  totalItems,
                  onPageChange: setCurrentPage,
                }
              : undefined
          }
          paginationText={{
            showing: "",
            of: "",
            items: t("records.total"),
          }}
          onRowClick={(row) =>
            setExpandedId(expandedId === row.id ? null : row.id)
          }
          isRowExpanded={(row) => expandedId === row.id}
          renderExpandedRow={(row) => (
            <RecordDetail
              record={row}
              exchangeRate={exchangeRate}
              locale={locale}
              t={t}
              tb={tb}
            />
          )}
          emptyState={
            error
              ? {
                  icon: (
                    <PhoneCall className="h-7 w-7 text-red-600" weight="fill" />
                  ),
                  title: t("error.title"),
                  description: error,
                }
              : {
                  icon: (
                    <PhoneCall
                      className="h-7 w-7 text-slate-300"
                      weight="fill"
                    />
                  ),
                  title: t("records.empty"),
                }
          }
        />
      </motion.div>
    </motion.main>
  );
}
