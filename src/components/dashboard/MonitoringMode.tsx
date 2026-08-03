"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { AttendanceOverview } from "@/lib/attendance/types";
import type { TelephonyOverview } from "@/lib/telephony/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Brain,
  Broadcast,
  CalendarBlank,
  ChartBar,
  ChartDonut,
  ChatCircle,
  Clock,
  ClockCounterClockwise,
  Phone,
  Robot,
  UserCircle,
  Users,
  WhatsappLogo,
  X,
  type Icon,
} from "@phosphor-icons/react";
import type { ConnectedUser, Stage } from "@/lib/conversations/types";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { getAttendanceOverviewAction } from "@/app/actions/attendance";
import { getTelephonyOverviewAction } from "@/app/actions/telephony";
import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";

import type { AnalysisStats } from "@/lib/analysis/types";
import type { WhatsAppCampaignMetrics } from "@/lib/whatsapp-campaigns/types";
import { cn } from "@/lib/utils";
import { useCrm } from "@/contexts/crm-context";
import { useTranslations } from "next-intl";


type CampaignType = "voice" | "whatsapp";

interface MonitoringEntry {
  id: string;
  number: string;
  name?: string | null;
  status: string;
  updatedAt?: string;
  stage?: { stage_id: string; name: string; color: string } | null;
  labels?: { label_id: string; name: string; color: string }[];
  analysis?: {
    interest: string;
    disposition: string;
    sentiment: string;
    qualification: string;
    attendanceQuality: number;
    summary: string;
  } | null;
}

interface MonitoringModeProps {
  campaignType: CampaignType;
  campaignId: string;
  entries: MonitoringEntry[];
  metrics: WhatsAppCampaignMetrics;
  analysisStats: AnalysisStats | null;
  analysisLoading: boolean;
  campaignName: string;
  isRunning: boolean;
  onClose: () => void;
}


function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatConnectedDuration(connectedAt: string, now: Date) {
  const startedAt = new Date(connectedAt);
  if (Number.isNaN(startedAt.getTime())) return "-";

  const diffMs = Math.max(0, now.getTime() - startedAt.getTime());
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatConnectedAt(connectedAt: string) {
  const date = new Date(connectedAt);
  if (Number.isNaN(date.getTime())) return "Data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatShortUserId(userId: string) {
  if (userId.length <= 18) return userId;
  return `${userId.slice(0, 8)}...${userId.slice(-8)}`;
}


// One calm, consistent identity tile for every panel header. Chrome stays
// monochrome (solid ink tile + canvas glyph, theme-safe); color is reserved for
// data and state inside the panels, per the One Voice rule.
function PanelIcon({ icon: IconCmp }: { icon: Icon }) {
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-foreground shadow-sm">
      <IconCmp weight="bold" className="h-4 w-4 text-background" />
    </div>
  );
}

function LabelPill({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm"
      style={{ color: "white", backgroundColor: color }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-card/40 flex-shrink-0" />
      {name}
    </span>
  );
}


function MonitorChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { color: string };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl px-3 py-2 shadow-2xl shadow-slate-900/10">
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-full shadow-sm"
          style={{ backgroundColor: item.payload.color }}
        />
        <span className="text-xs font-semibold text-muted-foreground">
          {item.name}
        </span>
        <span className="text-sm font-bold text-foreground">{item.value}</span>
      </div>
    </div>
  );
}

function MiniDonutChart({
  data,
  centerLabel,
  centerSublabel,
  size = 140,
  innerRadius = 38,
  outerRadius = 56,
  id,
}: {
  data: { name: string; value: number; color: string }[];
  centerLabel?: string;
  centerSublabel?: string;
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
  id: string;
}) {
  const hasData = data.some((d) => d.value > 0);
  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground/60"
        style={{ width: size, height: size }}
      >
        <span className="text-xs">,</span>
      </div>
    );
  }
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {data.map((entry, idx) => (
              <linearGradient
                key={`donut-${id}-${idx}`}
                id={`donut-${id}-${idx}`}
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
              </linearGradient>
            ))}
            <filter
              id={`donut-shadow-${id}`}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="2"
                floodOpacity="0.12"
              />
            </filter>
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            dataKey="value"
            cornerRadius={4}
            stroke="#fff"
            strokeWidth={2}
            filter={`url(#donut-shadow-${id})`}
            animationBegin={0}
            animationDuration={800}
          >
            {data.map((_entry, idx) => (
              <Cell key={`cell-${idx}`} fill={`url(#donut-${id}-${idx})`} />
            ))}
          </Pie>
          <RechartsTooltip content={<MonitorChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-foreground leading-none">
            {centerLabel}
          </span>
          {centerSublabel && (
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
              {centerSublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}


function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffH < 24) return `${diffH}h`;
  if (diffD < 7) return `${diffD}d`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(isoDate));
}

function LatestInteractionsPanel() {
  const t = useTranslations("monitoring");
  const crm = useCrm();

  const displayedEntries = useMemo(
    () => (crm.inbox ?? []).slice(0, 100),
    [crm.inbox],
  );

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/80 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <PanelIcon icon={ChatCircle} />
          <span className="text-sm font-bold text-foreground uppercase tracking-wider">
            {t("latestInteractions")}
          </span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {displayedEntries.length} {t("records")}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        <AnimatePresence initial={false}>
          {displayedEntries.map((entry, index) => (
            <motion.div
              key={entry.entry_id}
              layout
              initial={{ opacity: 0, x: -30, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.97 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
                delay: index < 5 ? index * 0.02 : 0,
              }}
              className="relative flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-muted/80 transition-colors group"
            >
              {/* Avatar / icon */}
              <div className="relative flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-background to-slate-200 shadow-sm">
                  <UserCircle
                    weight="fill"
                    className="h-6 w-6 text-muted-foreground"
                  />
                </div>
                {entry.unread_count > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow-sm">
                    {entry.unread_count > 99 ? "99+" : entry.unread_count}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold truncate",
                      entry.unread_count > 0
                        ? "text-foreground"
                        : "text-foreground",
                    )}
                  >
                    {entry.lead_name || entry.lead_number}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {relativeTime(entry.last_message_at)}
                  </span>
                </div>

                {entry.lead_name && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {entry.lead_number}
                  </span>
                )}

                <div className="flex items-center gap-1.5 mt-0.5">
                  {entry.last_message_sender === "agent" && (
                    <span className="text-[10px] text-emerald-500 font-bold flex-shrink-0">
                      AI
                    </span>
                  )}
                  {entry.last_message_sender === "operator" && (
                    <span className="text-[10px] text-primary font-bold flex-shrink-0">
                      OP
                    </span>
                  )}
                  <p
                    className={cn(
                      "text-xs truncate",
                      entry.unread_count > 0
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {entry.last_message_preview || "..."}
                  </p>
                </div>

                {/* Labels */}
                {entry.labels && entry.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {entry.labels.slice(0, 3).map((label) => (
                      <LabelPill
                        key={label.label_id}
                        name={label.name}
                        color={label.color}
                      />
                    ))}
                    {entry.labels.length > 3 && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground bg-muted">
                        +{entry.labels.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* New message pulse indicator */}
              {entry.unread_count > 0 && (
                <motion.div
                  className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-400"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {displayedEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
            <ChatCircle className="h-10 w-10 mb-2" />
            <p className="text-sm">{t("waitingForData")}</p>
          </div>
        )}
      </div>
    </div>
  );
}


function StatusGraphPanel({
  metrics,
  campaignType,
  isRunning,
}: {
  metrics: WhatsAppCampaignMetrics;
  campaignType: CampaignType;
  isRunning: boolean;
}) {
  const t = useTranslations("monitoring");
  const tStatus = useTranslations("monitoring.status");

  const bars = useMemo(() => {
    if (campaignType === "whatsapp") {
      const m = metrics as WhatsAppCampaignMetrics;
      return [
        {
          label: tStatus("pending"),
          value: m.pending,
          color: "#64748b",
          active: false,
        },
        {
          label: tStatus("sent"),
          value: m.sent,
          color: "#3b82f6",
          active: false,
        },
        {
          label: tStatus("delivered"),
          value: m.delivered,
          color: "#10b981",
          active: false,
        },
        {
          label: tStatus("read"),
          value: m.read,
          color: "#8b5cf6",
          active: false,
        },
        {
          label: tStatus("failed"),
          value: m.failed,
          color: "#ef4444",
          active: false,
        },
      ];
    }
    return [];
  }, [metrics, campaignType, t, tStatus]);

  const totalNumbers = "totalNumbers" in metrics ? metrics.totalNumbers : 0;
  const completionRate =
    "completionRate" in metrics ? metrics.completionRate : 0;
  const donutData = bars.filter((b) => b.value > 0);

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/80 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <PanelIcon icon={ChartBar} />
          <span className="text-sm font-bold text-foreground uppercase tracking-wider">
            {campaignType === "whatsapp"
              ? t("messageStatuses")
              : t("callStatuses")}
          </span>
        </div>
        {isRunning && (
          <motion.div
            className="flex items-center gap-1.5"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600">
              {t("live")}
            </span>
          </motion.div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center px-3 py-3 gap-2 overflow-y-auto">
        {/* Donut chart */}
        <div className="relative w-full flex justify-center">
          <MiniDonutChart
            data={donutData.map((b) => ({
              name: b.label,
              value: b.value,
              color: b.color,
            }))}
            centerLabel={totalNumbers.toLocaleString()}
            centerSublabel={t("total")}
            size={160}
            innerRadius={48}
            outerRadius={72}
            id="status-dist"
          />
        </div>

        {/* Legend rows */}
        <div className="w-full space-y-1 px-1">
          {bars.map((bar) => (
            <div key={bar.label} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full flex-shrink-0 shadow-sm"
                style={{ backgroundColor: bar.color }}
              />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex-1 truncate">
                {bar.label}
              </span>
              <motion.span
                className="text-xs font-bold text-foreground tabular-nums"
                key={bar.value}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
              >
                {bar.value.toLocaleString()}
              </motion.span>
            </div>
          ))}
        </div>

        {/* Stats footer */}
        <div className="flex items-center justify-center gap-4 pt-2 border-t border-border w-full mt-auto">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              {t("rate")}
            </p>
            <p className="text-lg font-bold text-emerald-600">
              {completionRate.toFixed(1)}%
            </p>
          </div>
                  </div>
      </div>
    </div>
  );
}


type UnifiedEntry = {
  id: string;
  name?: string | null;
  lead_number: string;
  last_message_at?: string | null;
  labels?: { label_id: string; name: string; color: string }[];
};

// Read-only kanban card for the monitor. Mirrors the CRM funnel card so the two
// surfaces read as the same component family.
function MonitorKanbanCard({
  entry,
  dotColor,
}: {
  entry: UnifiedEntry;
  dotColor?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 36 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      className="cursor-default select-none rounded-xl border border-border/80 bg-card p-2.5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-foreground">
          {entry.name || entry.lead_number}
        </span>
        {dotColor && (
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full ring-1 ring-black/5"
            style={{ backgroundColor: dotColor }}
          />
        )}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="truncate font-mono text-[10px] text-muted-foreground">
          {entry.lead_number}
        </span>
        {entry.last_message_at && (
          <span className="ml-auto flex-shrink-0 text-[10px] text-muted-foreground tabular-nums">
            {formatDate(entry.last_message_at)}
          </span>
        )}
      </div>
      {entry.labels && entry.labels.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {entry.labels.slice(0, 2).map((label) => (
            <LabelPill key={label.label_id} name={label.name} color={label.color} />
          ))}
          {entry.labels.length > 2 && (
            <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
              +{entry.labels.length - 2}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Fixed-width, self-scrolling kanban column. Fixed width + shrink-0 is what keeps
// the board from cramming its columns thin as stages multiply; the row scrolls
// horizontally instead.
function MonitorKanbanColumn({
  name,
  color,
  count,
  entries,
  isLoading,
  emptyLabel,
  variant = "stage",
}: {
  name: string;
  color?: string;
  count: number;
  entries: UnifiedEntry[];
  isLoading: boolean;
  emptyLabel: string;
  variant?: "stage" | "unstaged";
}) {
  const isUnstaged = variant === "unstaged";

  return (
    <div
      className={cn(
        "flex h-full w-56 shrink-0 flex-col rounded-2xl border bg-muted/40",
        isUnstaged ? "border-dashed border-border" : "border-border",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <span
          className={cn(
            "h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-black/5",
            isUnstaged && "bg-muted-foreground/40",
          )}
          style={!isUnstaged && color ? { backgroundColor: color } : undefined}
        />
        <span
          className={cn(
            "flex-1 truncate text-xs font-bold",
            isUnstaged ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {name}
        </span>
        {isLoading && (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center"
          >
            <Clock weight="fill" className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.span>
        )}
        <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card px-1.5 text-[10px] font-bold text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        <AnimatePresence initial={false}>
          {entries.slice(0, 40).map((entry) => (
            <MonitorKanbanCard
              key={entry.id}
              entry={entry}
              dotColor={isUnstaged ? undefined : color}
            />
          ))}
        </AnimatePresence>
        {entries.length === 0 && !isLoading && (
          <div className="flex h-20 items-center justify-center">
            <span className="text-[11px] italic text-muted-foreground">
              {emptyLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function FunnelMonitorPanel({
  entries,
}: {
  entries: MonitoringEntry[];
  campaignType: CampaignType;
}) {
  const t = useTranslations("monitoring");
  const crm = useCrm();
  const crmTags = crm.tags;

  const funnelColumns = crm.funnelColumns;
  const funnelSummary = crm.funnelSummary;
  const requestFunnelColumn = crm.requestFunnelColumn;
  const requestFunnelSummary = crm.requestFunnelSummary;
  const loadingFunnelColumn = crm.loadingFunnelColumn;

  const tags: Stage[] = useMemo(() => {
    if (crmTags && crmTags.length > 0) {
      return [...crmTags].sort((a, b) => a.position - b.position);
    }
    return [];
  }, [crmTags]);

  useEffect(() => {
    if (!requestFunnelColumn || !requestFunnelSummary || tags.length === 0)
      return;
    const tagIds = [...tags.map((t) => t.id), "__unstaged__"];
    requestFunnelSummary(tagIds);
    for (const stageId of tagIds) {
      requestFunnelColumn(stageId, 1, 30);
    }
  }, [tags, requestFunnelColumn, requestFunnelSummary]);

  const fallbackColumnEntries = useMemo(() => {
    if (funnelColumns && funnelColumns.size > 0) return null;
    const groups = new Map<string, MonitoringEntry[]>();
    for (const tag of tags) {
      groups.set(tag.id, []);
    }
    groups.set("__unstaged__", []);
    for (const entry of entries) {
      const entryStage = entry.stage;
      if (!entryStage) {
        groups.get("__unstaged__")?.push(entry);
        continue;
      }
      if (groups.has(entryStage.stage_id)) {
        groups.get(entryStage.stage_id)?.push(entry);
      } else {
        groups.get("__unstaged__")?.push(entry);
      }
    }
    return groups;
  }, [entries, tags, funnelColumns]);

  const getColumnEntries = (stageId: string): UnifiedEntry[] => {
    if (funnelColumns && funnelColumns.has(stageId)) {
      const wsEntries = funnelColumns.get(stageId)!.entries ?? [];
      return wsEntries.map((e) => ({
        id: e.entry_id,
        name: e.lead_name,
        lead_number: e.lead_number,
        last_message_at: e.last_message_at,
        labels: e.labels?.map((l) => ({
          label_id: l.label_id,
          name: l.name,
          color: l.color,
        })),
      }));
    }
    if (fallbackColumnEntries) {
      const fallback = fallbackColumnEntries.get(stageId) ?? [];
      return fallback.map((e) => ({
        id: e.id,
        name: e.name,
        lead_number: e.number,
        last_message_at: e.updatedAt,
        labels: e.labels,
      }));
    }
    return [];
  };

  const getColumnTotal = (stageId: string) => {
    if (funnelSummary && funnelSummary.has(stageId)) {
      return funnelSummary.get(stageId)!;
    }
    if (fallbackColumnEntries) {
      return fallbackColumnEntries.get(stageId)?.length ?? 0;
    }
    return 0;
  };

  if (tags.length === 0) {
    return (
      <div className="flex flex-col h-full bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/80 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <PanelIcon icon={UserCircle} />
            <span className="text-sm font-bold text-foreground uppercase tracking-wider">
              {t("kanbanMonitor")}
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {t("readOnly")}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <UserCircle className="h-10 w-10 mx-auto mb-2" />
            <p className="text-sm">{t("waitingForData")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/80 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <PanelIcon icon={UserCircle} />
          <span className="text-sm font-bold text-foreground uppercase tracking-wider">
            {t("kanbanMonitor")}
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {t("readOnly")}
        </span>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        <div className="flex h-full gap-3 p-3">
          {tags.map((tag) => (
            <MonitorKanbanColumn
              key={tag.id}
              name={tag.name}
              color={tag.color}
              count={getColumnTotal(tag.id)}
              entries={getColumnEntries(tag.id)}
              isLoading={loadingFunnelColumn === tag.id}
              emptyLabel={t("empty")}
            />
          ))}

          {(() => {
            const untaggedEntries = getColumnEntries("__unstaged__");
            const untaggedTotal = getColumnTotal("__unstaged__");
            const isLoading = loadingFunnelColumn === "__unstaged__";
            if (
              untaggedTotal === 0 &&
              untaggedEntries.length === 0 &&
              !isLoading
            )
              return null;
            return (
              <MonitorKanbanColumn
                name={t("untagged")}
                count={untaggedTotal}
                entries={untaggedEntries}
                isLoading={isLoading}
                emptyLabel={t("empty")}
                variant="unstaged"
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
}


function AnalysisStatsPanelMonitor({
  analysisStats,
  analysisLoading,
}: {
  analysisStats: AnalysisStats | null;
  analysisLoading: boolean;
}) {
  const t = useTranslations("monitoring");
  const tInterest = useTranslations("monitoring.interest");
  const tQual = useTranslations("monitoring.qualification");
  const tSentiment = useTranslations("monitoring.sentiment");

  const sentimentData = useMemo(() => {
    if (!analysisStats) return [];
    return [
      {
        name: tSentiment("positive"),
        value: analysisStats.sentimentPositive,
        color: "#10b981",
      },
      {
        name: tSentiment("neutral"),
        value: analysisStats.sentimentNeutral,
        color: "#94a3b8",
      },
      {
        name: tSentiment("negative"),
        value: analysisStats.sentimentNegative,
        color: "#ef4444",
      },
    ];
  }, [analysisStats, tSentiment]);

  const qualificationData = useMemo(() => {
    if (!analysisStats) return [];
    return [
      {
        name: tQual("hotLead"),
        value: analysisStats.qualificationHotLead,
        color: "#ef4444",
      },
      {
        name: tQual("warmLead"),
        value: analysisStats.qualificationWarmLead,
        color: "#f59e0b",
      },
      {
        name: tQual("coldLead"),
        value: analysisStats.qualificationColdLead,
        color: "#64748b",
      },
    ];
  }, [analysisStats, tQual]);

  const interestData = useMemo(() => {
    if (!analysisStats) return [];
    return [
      {
        name: tInterest("interested"),
        value: analysisStats.interestInterested,
        color: "#10b981",
      },
      {
        name: tInterest("undecided"),
        value: analysisStats.interestUndecided,
        color: "#f59e0b",
      },
      {
        name: tInterest("notInterested"),
        value: analysisStats.interestNotInterested,
        color: "#ef4444",
      },
    ];
  }, [analysisStats, tInterest]);

  const totalSentiment = sentimentData.reduce((s, d) => s + d.value, 0);
  const totalQual = qualificationData.reduce((s, d) => s + d.value, 0);

  const qualityValue = analysisStats?.avgAttendanceQuality ?? 0;
  const qualityColor =
    qualityValue >= 70 ? "#10b981" : qualityValue >= 40 ? "#f59e0b" : "#ef4444";
  const qualityGaugeData = useMemo(
    () => [
      { name: t("quality"), value: qualityValue, color: qualityColor },
      { name: "", value: Math.max(100 - qualityValue, 0), color: "#f1f5f9" },
    ],
    [qualityValue, qualityColor, t],
  );

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/80 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <PanelIcon icon={Brain} />
          <span className="text-sm font-bold text-foreground uppercase tracking-wider">
            {t("aiAnalysis")}
          </span>
        </div>
        {analysisStats && (
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
            {analysisStats.totalAnalyses} {t("analyses")}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {analysisLoading ? (
          <div className="flex items-center justify-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Brain
                weight="bold"
                className="h-6 w-6 text-muted-foreground/60"
              />
            </motion.div>
          </div>
        ) : analysisStats && analysisStats.totalAnalyses > 0 ? (
          <div className="px-4 py-3 space-y-4">
            {/* Quality Gauge + Messages */}
            <div className="flex items-center gap-3">
              <div className="relative" style={{ width: 100, height: 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient
                        id="gauge-quality-fill"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={qualityColor}
                          stopOpacity={1}
                        />
                        <stop
                          offset="100%"
                          stopColor={qualityColor}
                          stopOpacity={0.65}
                        />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={qualityGaugeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={44}
                      startAngle={225}
                      endAngle={-45}
                      paddingAngle={0}
                      dataKey="value"
                      cornerRadius={6}
                      stroke="none"
                      animationDuration={1000}
                    >
                      <Cell fill="url(#gauge-quality-fill)" />
                      <Cell fill="#f1f5f9" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-foreground leading-none">
                    {qualityValue.toFixed(0)}%
                  </span>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                    {t("quality")}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="p-2.5 rounded-xl bg-card border border-border">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                    {t("messages")}
                  </p>
                  <p className="text-xl font-bold text-foreground">
                    {analysisStats.totalMessages.toLocaleString()}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                    {t("msgsPerAnalysis")}
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {analysisStats.avgMessagesPerAnalysis.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            {/* Sentiment Donut */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {t("sentimentLabel")}
              </p>
              <div className="flex items-center gap-3">
                <MiniDonutChart
                  data={sentimentData}
                  centerLabel={String(totalSentiment)}
                  centerSublabel="total"
                  size={110}
                  innerRadius={30}
                  outerRadius={46}
                  id="sentiment"
                />
                <div className="flex-1 space-y-1.5">
                  {sentimentData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-[10px] font-bold text-muted-foreground flex-1">
                        {d.name}
                      </span>
                      <span className="text-xs font-bold text-foreground tabular-nums">
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Qualification Donut */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {t("qualificationLabel")}
              </p>
              <div className="flex items-center gap-3">
                <MiniDonutChart
                  data={qualificationData}
                  centerLabel={String(totalQual)}
                  centerSublabel="total"
                  size={110}
                  innerRadius={30}
                  outerRadius={46}
                  id="qualification"
                />
                <div className="flex-1 space-y-1.5">
                  {qualificationData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-[10px] font-bold text-muted-foreground flex-1">
                        {d.name}
                      </span>
                      <span className="text-xs font-bold text-foreground tabular-nums">
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Interest mini-indicators */}
            <div className="space-y-1 pt-1 border-t border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {t("interestLabel")}
              </p>
              <div className="flex gap-2">
                {interestData.map((d) => (
                  <motion.div
                    key={d.name}
                    className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl border border-border bg-card"
                    whileHover={{ scale: 1.03 }}
                  >
                    <span
                      className="text-lg font-bold"
                      style={{ color: d.color }}
                    >
                      {d.value}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-center leading-tight">
                      {d.name}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Brain className="h-8 w-8 mb-2" />
            <p className="text-sm">{t("noAnalyses")}</p>
          </div>
        )}
      </div>
    </div>
  );
}


function fmtMonNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "0";
  return v.toLocaleString("pt-BR");
}
function fmtMonMins(v: number | null | undefined): string {
  if (v === null || v === undefined) return "n/d";
  if (v < 1) return `${Math.round(v * 60)}s`;
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`;
}
function fmtMonPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "n/d";
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/**
 * Campaign-only strip under the kanban.
 * Global ops live on Métricas; here we only show what matters for THIS campaign.
 */
function AttendanceInsightsPanel({
  campaignId,
  campaignType,
}: {
  campaignId?: string;
  campaignType?: string;
}) {
  const t = useTranslations("monitoring");
  const tk = useTranslations("metricsOps.attendance.kpi");
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [telephony, setTelephony] = useState<TelephonyOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const dateFrom = format(subDays(new Date(), 6), "yyyy-MM-dd");
    const dateTo = format(new Date(), "yyyy-MM-dd");

    async function fetchAll() {
      setLoading(true);
      const attP = getAttendanceOverviewAction({
        dateFrom,
        dateTo,
        campaignId,
        campaignType,
        channel:
          campaignType === "whatsapp"
            ? "whatsapp"
            : campaignType === "voice"
              ? "voice"
              : undefined,
        includeAi: true,
      });
      const telP: Promise<{
        overview: TelephonyOverview | null;
        error: string | null;
      }> = Promise.resolve({ overview: null, error: null });

      const [att, tel] = await Promise.all([attP, telP]);
      if (cancelled) return;
      setOverview(att.overview);
      setTelephony(tel.overview);
      setLoading(false);
    }

    void fetchAll();
    const interval = window.setInterval(() => void fetchAll(), 45_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaignId, campaignType]);

  const kpis = overview?.kpis;
  const ai = overview?.ai;
  const status = overview?.status_distribution;
  const tel = telephony?.kpis;
  const queue = telephony?.queue;
  const isVoice = campaignType === "voice";

  const statusPie = useMemo(() => {
    if (!status) return [];
    return [
      { name: "Concluídas", value: status.finished, color: "#22c55e" },
      { name: "Em andamento", value: status.ongoing, color: "#2463eb" },
      { name: "Aguardando", value: status.pending, color: "#f59e0b" },
    ].filter((r) => r.value > 0);
  }, [status]);

  const teamTop = (overview?.by_member ?? []).slice(0, 6);
  const hasData = !!overview?.kpis;

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/80 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <PanelIcon icon={isVoice ? Phone : WhatsappLogo} />
          <span className="text-sm font-bold uppercase tracking-wider text-foreground">
            {t("health")}
          </span>
          <span className="text-[10px] text-muted-foreground">{t("last7d")}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Clock className="h-6 w-6 mb-2 animate-pulse" />
            <p className="text-xs">{t("loadingData")}</p>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-6">
            <ChartBar className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs">{t("noCampaignData")}</p>
          </div>
        ) : (
          <div className="grid h-full min-h-[160px] grid-cols-1 gap-3 lg:grid-cols-12">
            {/* Primary campaign KPIs */}
            <div className="lg:col-span-5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("conversations")}
              </p>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-3">
                <MiniStat label={tk("finished")} value={fmtMonNum(kpis?.finished)} accent />
                <MiniStat label={tk("ongoing")} value={fmtMonNum(kpis?.ongoing)} />
                <MiniStat label={tk("pending")} value={fmtMonNum(kpis?.pending)} />
                <MiniStat
                  label={tk("unassigned")}
                  value={fmtMonNum(kpis?.unassigned_backlog)}
                />
                <MiniStat
                  label={tk("frt")}
                  value={fmtMonMins(kpis?.avg_frt_mins ?? null)}
                />
                <MiniStat
                  label={tk("avgWait")}
                  value={fmtMonMins(kpis?.avg_wait_mins ?? null)}
                />
              </div>
              {isVoice && tel ? (
                <>
                  <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {t("calls")}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-3">
                    <MiniStat label="Total" value={fmtMonNum(tel.total_calls)} accent />
                    <MiniStat
                      label="Conexão"
                      value={fmtMonPct(tel.connect_rate ?? null)}
                    />
                    <MiniStat
                      label="No prazo 20s"
                      value={fmtMonPct(tel.service_level_pct ?? null)}
                    />
                    <MiniStat
                      label="Conversa"
                      value={fmtMonMins(tel.avg_talk_mins ?? null)}
                    />
                    <MiniStat
                      label="Espera fila"
                      value={
                        queue?.available
                          ? fmtMonMins(queue.avg_asa_mins ?? null)
                          : "n/d"
                      }
                    />
                    <MiniStat
                      label="IA resolve"
                      value={
                        ai?.available ? fmtMonPct(ai.containment_rate) : "n/d"
                      }
                    />
                  </div>
                </>
              ) : ai?.available ? (
                <>
                  <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <Robot className="h-3 w-3" weight="fill" /> IA nesta campanha
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    <MiniStat label="Sessões" value={fmtMonNum(ai.sessions)} />
                    <MiniStat
                      label="Resolvidas"
                      value={fmtMonPct(ai.containment_rate)}
                      accent
                    />
                    <MiniStat
                      label="Passadas"
                      value={fmtMonPct(ai.handoff_rate)}
                    />
                    <MiniStat
                      label="Ativas"
                      value={fmtMonNum(ai.open_sessions)}
                    />
                  </div>
                </>
              ) : null}
            </div>

            {/* Status pie */}
            <div className="lg:col-span-3 flex flex-col rounded-xl border border-border/60 bg-background/50 px-2 py-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-1">
                Situação
              </p>
              {statusPie.length === 0 ? (
                <p className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                  Sem dados
                </p>
              ) : (
                <>
                  <div className="mx-auto h-[110px] w-full max-w-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={48}
                          paddingAngle={2}
                        >
                          {statusPie.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-auto space-y-0.5 px-1">
                    {statusPie.map((d) => (
                      <li
                        key={d.name}
                        className="flex items-center justify-between text-[10px]"
                      >
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: d.color }}
                          />
                          {d.name}
                        </span>
                        <span className="font-bold tabular-nums text-foreground">
                          {fmtMonNum(d.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Team on this campaign */}
            <div className="lg:col-span-4 flex flex-col rounded-xl border border-border/60 bg-background/50 px-3 py-2 min-w-0">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("whoResolves")}
              </p>
              {teamTop.length === 0 ? (
                <p className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                  {t("noAgentsYet")}
                </p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="pb-1 text-[9px] font-bold uppercase text-muted-foreground">
                          Nome
                        </th>
                        <th className="pb-1 text-right text-[9px] font-bold uppercase text-muted-foreground">
                          OK
                        </th>
                        <th className="pb-1 text-right text-[9px] font-bold uppercase text-muted-foreground">
                          %
                        </th>
                        <th className="pb-1 text-right text-[9px] font-bold uppercase text-muted-foreground">
                          Resp.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamTop.map((m) => (
                        <tr
                          key={m.actor_id}
                          className="border-b border-border/30 last:border-0"
                        >
                          <td className="max-w-[100px] truncate py-1 pr-1 text-xs font-medium text-foreground">
                            {m.display_name}
                            {m.actor_kind === "ai" ? " · IA" : ""}
                          </td>
                          <td className="py-1 text-right text-xs font-bold tabular-nums">
                            {fmtMonNum(m.resolved)}
                          </td>
                          <td className="py-1 text-right text-xs tabular-nums text-muted-foreground">
                            {fmtMonPct(m.resolution_pct)}
                          </td>
                          <td className="py-1 text-right text-xs tabular-nums text-muted-foreground">
                            {fmtMonMins(m.avg_response_mins)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-1.5",
        accent
          ? "border-primary/25 bg-primary/5"
          : "border-border/60 bg-background/70",
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-bold tabular-nums",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ConnectedUsersMonitorPanel({ campaignId }: { campaignId: string }) {
  const t = useTranslations("monitoring");
  const { connectedUsers } = useCrm();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const scopedUsers = useMemo(() => {
    const isGlobal = (user: ConnectedUser) => user.view_mode === "global";
    const isCampaignScoped = (user: ConnectedUser) => {
      if (!campaignId) return false;
      if (isGlobal(user)) return false;
      if (user.campaign_id) return user.campaign_id === campaignId;
      return true;
    };

    const users = connectedUsers.filter(
      (user) => isGlobal(user) || isCampaignScoped(user),
    );

    return users.sort((a, b) => {
      const aTs = new Date(a.connected_at).getTime();
      const bTs = new Date(b.connected_at).getTime();
      return bTs - aTs;
    });
  }, [connectedUsers, campaignId]);

  const globalCount = useMemo(
    () => scopedUsers.filter((user) => user.view_mode === "global").length,
    [scopedUsers],
  );
  const campaignCount = scopedUsers.length - globalCount;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/80 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <PanelIcon icon={Users} />
          <span className="text-sm font-bold uppercase tracking-wider text-foreground">
            Usuários Monitorando
          </span>
        </div>
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">
          {scopedUsers.length} {t("records")}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-border bg-muted/60 px-3 py-2.5 flex-shrink-0">
        <div className="rounded-lg border border-border bg-card px-2 py-1.5 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Total
          </p>
          <p className="text-sm font-bold text-foreground">
            {scopedUsers.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-2 py-1.5 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Campanha
          </p>
          <p className="text-sm font-bold text-primary">{campaignCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-2 py-1.5 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Global
          </p>
          <p className="text-sm font-bold text-foreground">{globalCount}</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 py-2.5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {scopedUsers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/70 px-4 text-center text-muted-foreground">
            <Users className="mb-2 h-8 w-8" />
            <p className="text-sm">Nenhum usuário monitorando neste escopo</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {scopedUsers.map((user) => (
              <motion.div
                key={`${user.user_id}-${user.connected_at}`}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="rounded-xl border border-border bg-card p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {user.email}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                      ID: {formatShortUserId(user.user_id)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                      user.view_mode === "global"
                        ? "bg-emerald-500 text-white"
                        : "bg-primary text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full animate-pulse",
                        user.view_mode === "global"
                          ? "bg-emerald-400"
                          : "bg-blue-400",
                      )}
                    />
                    {user.view_mode === "global" ? "Global" : "Campanha"}
                  </span>
                </div>

                <div className="mt-2 space-y-1.5 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Broadcast
                      weight="duotone"
                      className="h-3 w-3 flex-shrink-0 text-muted-foreground"
                    />
                    <span className="font-semibold text-muted-foreground">
                      Escopo:
                    </span>
                    <span className="truncate">
                      {user.view_mode === "global"
                        ? "Área de Trabalho (visão global)"
                        : user.campaign_name || "Campanha atual"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <ClockCounterClockwise
                      weight="duotone"
                      className="h-3 w-3 flex-shrink-0 text-muted-foreground"
                    />
                    <span className="font-semibold text-muted-foreground">
                      Conectado por:
                    </span>
                    <span className="font-bold text-foreground">
                      {formatConnectedDuration(user.connected_at, now)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <CalendarBlank
                      weight="duotone"
                      className="h-3 w-3 flex-shrink-0 text-muted-foreground"
                    />
                    <span className="font-semibold text-muted-foreground">
                      Desde:
                    </span>
                    <span>{formatConnectedAt(user.connected_at)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}


export default function MonitoringMode({
  campaignType,
  campaignId,
  entries,
  metrics,
  analysisStats,
  analysisLoading,
  campaignName,
  isRunning,
  onClose,
}: MonitoringModeProps) {
  const t = useTranslations("monitoring");
  const crm = useCrm();

  const [viewScoped, setViewScoped] = useState(false);

  useEffect(() => {
    if (crm.status !== "connected") return;
    if (campaignId || campaignType) {
      crm.switchView(campaignId || undefined, campaignType);
      crm.reloadStages(campaignId || undefined, campaignType);
      crm.reloadLabels();
      setViewScoped(true);
    }
    return () => {
      setViewScoped(false);
      if (campaignId || campaignType) {
        crm.switchView();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crm.status, campaignId, campaignType]);

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Slim header */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
              campaignType === "whatsapp" ? "bg-emerald-500" : "bg-primary",
            )}
          >
            {campaignType === "whatsapp" ? (
              <WhatsappLogo weight="fill" className="h-4.5 w-4.5" />
            ) : (
              <Phone weight="fill" className="h-4.5 w-4.5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              {campaignName}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("title")} · {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {t("live")}
            </span>
          ) : null}
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            {new Date().toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={t("close")}
          >
            <X weight="bold" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/*
        Redesign: kanban is the product; sides only show campaign-live context.
        Full analytics live under Métricas (not duplicated here).
      */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left rail, live feed only */}
        <aside className="flex max-h-[28vh] w-full flex-col border-b border-border bg-card lg:max-h-none lg:w-[240px] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <PanelIcon icon={ChatCircle} />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t("liveFeed")}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {viewScoped ? (
              <LatestInteractionsPanel />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                {t("waitingForData")}
              </div>
            )}
          </div>
        </aside>

        {/* Center, kanban hero + slim campaign health */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-2">
            <div className="flex items-center gap-2">
              <PanelIcon icon={ChartBar} />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("kanbanHero")}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {entries.length} {t("records")}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden bg-muted/30">
            {viewScoped ? (
              <FunnelMonitorPanel
                entries={entries}
                campaignType={campaignType}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t("waitingForData")}
              </div>
            )}
          </div>
          <div className="max-h-[34vh] flex-shrink-0 border-t border-border bg-card lg:max-h-[240px]">
            <AttendanceInsightsPanel
              campaignId={campaignId}
              campaignType={campaignType}
            />
          </div>
        </main>

        {/* Right rail, campaign delivery + viewers (not global analytics) */}
        <aside className="flex max-h-[36vh] w-full flex-col border-t border-border bg-card lg:max-h-none lg:w-[280px] lg:border-l lg:border-t-0">
          <div className="min-h-0 flex-[1.15] overflow-hidden border-b border-border">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <PanelIcon icon={ChartBar} />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("campaignStatus")}
              </span>
            </div>
            <div className="h-[calc(100%-40px)] overflow-hidden">
              <StatusGraphPanel
                metrics={metrics}
                campaignType={campaignType}
                isRunning={isRunning}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <PanelIcon icon={Users} />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("viewers")}
              </span>
            </div>
            <div className="h-[calc(100%-40px)] overflow-hidden">
              <ConnectedUsersMonitorPanel campaignId={campaignId} />
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}


export type { MonitoringEntry, MonitoringModeProps };
