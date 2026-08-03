"use client";

/**
 * CRM contact-panel charts (lateral infos rail only).
 * Path uses the same status palette as Metrics (blue / amber / emerald).
 */

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Analysis } from "@/lib/analysis/types";
import type { ConversationMessage } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";

/* Metrics-aligned status colors (attendance department chart language) */
const STAGE_HUE = {
  new: "#2463eb", // Signal Blue
  ongoing: "#f59e0b", // Amber, in progress
  finished: "#22c55e", // Emerald, done
} as const;

const STAGE_MUTED = {
  new: "#bfdbfe",
  ongoing: "#fde68a",
  finished: "#bbf7d0",
} as const;

const MIX = {
  customer: "#25d366", // WhatsApp green for customer channel
  team: "#2463eb",
  ai: "#f59e0b",
  media: "#8b5cf6",
  tools: "#64748b",
} as const;

type CrmStatus = "new" | "ongoing" | "finished";

function normalizeStatus(status?: string | null): CrmStatus {
  const s = (status || "new").toLowerCase().trim();
  if (s === "ongoing" || s === "finished") return s;
  return "new";
}

function stageState(
  stage: CrmStatus,
  current: CrmStatus,
): "done" | "current" | "upcoming" {
  const order: CrmStatus[] = ["new", "ongoing", "finished"];
  const si = order.indexOf(stage);
  const ci = order.indexOf(current);
  if (si < ci) return "done";
  if (si === ci) return current === "finished" ? "done" : "current";
  return "upcoming";
}

function fillForStage(id: CrmStatus, state: "done" | "current" | "upcoming") {
  if (state === "upcoming") return STAGE_MUTED[id];
  return STAGE_HUE[id];
}

function formatDuration(
  ms: number,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (ms < 60_000) return t("duration.seconds", { n: Math.max(1, Math.round(ms / 1000)) });
  if (ms < 3_600_000) return t("duration.minutes", { n: Math.round(ms / 60_000) });
  if (ms < 86_400_000) return t("duration.hours", { n: Math.round(ms / 3_600_000) });
  return t("duration.days", { n: Math.round(ms / 86_400_000) });
}

export default function ConversationPathChart({
  status,
  messages,
  analysis,
  className,
}: {
  status?: string | null;
  messages?: ConversationMessage[];
  analysis?: Analysis | null;
  className?: string;
}) {
  const t = useTranslations("crmContactPanel.pathChart");
  const locale = useLocale();
  const tag =
    locale === "pt"
      ? "pt-BR"
      : locale === "es"
        ? "es-ES"
        : locale === "de"
          ? "de-DE"
          : "en-US";
  const current = normalizeStatus(status);

  const stages = useMemo(() => {
    const ids: CrmStatus[] = ["new", "ongoing", "finished"];
    return ids.map((id) => {
      const state = stageState(id, current);
      return {
        id,
        label: t(`stages.${id}`),
        state,
        color: fillForStage(id, state),
        solid: STAGE_HUE[id],
      };
    });
  }, [current, t]);

  const pathData = useMemo(
    () => [
      {
        name: t("pathRow"),
        new: 1,
        ongoing: 1,
        finished: 1,
      },
    ],
    [t],
  );

  const threadStats = useMemo(() => {
    const list = messages ?? [];
    let customer = 0;
    let team = 0;
    let ai = 0;
    let media = 0;
    let tools = 0;
    let voice = 0;
    let whatsapp = 0;
    let failedDelivery = 0;

    for (const m of list) {
      if (m.channel === "voice") voice += 1;
      if (m.channel === "whatsapp") whatsapp += 1;
      if (m.delivery_status === "failed") failedDelivery += 1;
      if (m.media_type || m.media_id) media += 1;

      switch (m.message_type) {
        case "user_message":
          customer += 1;
          break;
        case "ai_response":
          ai += 1;
          break;
        case "operator":
        case "template":
          team += 1;
          break;
        case "tool_call":
        case "tool_result":
          tools += 1;
          break;
        case "audio":
          if (
            m.from &&
            m.from !== "system" &&
            !String(m.from).startsWith("agent")
          )
            customer += 1;
          else team += 1;
          media += 1;
          break;
        default:
          break;
      }
    }

    const times = list
      .map((m) => new Date(m.created_at).getTime())
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
    const firstAt = times[0] ?? null;
    const lastAt = times.length ? times[times.length - 1] : null;
    const spanMs =
      firstAt != null && lastAt != null ? Math.max(0, lastAt - firstAt) : null;

    return {
      customer,
      team,
      ai,
      media,
      tools,
      voice,
      whatsapp,
      failedDelivery,
      total: list.length,
      firstAt,
      lastAt,
      spanMs,
    };
  }, [messages]);

  const mixData = useMemo(() => {
    return [
      {
        name: t("mix.customer"),
        count: threadStats.customer,
        color: MIX.customer,
      },
      {
        name: t("mix.team"),
        count: threadStats.team,
        color: MIX.team,
      },
      {
        name: t("mix.ai"),
        count: threadStats.ai,
        color: MIX.ai,
      },
      {
        name: t("mix.media"),
        count: threadStats.media,
        color: MIX.media,
      },
      {
        name: t("mix.tools"),
        count: threadStats.tools,
        color: MIX.tools,
      },
    ].filter((r) => r.count > 0);
  }, [threadStats, t]);

  const channelData = useMemo(() => {
    return [
      {
        name: t("channel.whatsapp"),
        count: threadStats.whatsapp,
        color: "#25d366",
      },
      {
        name: t("channel.voice"),
        count: threadStats.voice,
        color: "#8b5cf6",
      },
    ].filter((r) => r.count > 0);
  }, [threadStats, t]);

  const stageByKey = Object.fromEntries(stages.map((s) => [s.id, s]));

  const formatWhen = (isoMs: number) => {
    try {
      return new Intl.DateTimeFormat(tag, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(isoMs));
    } catch {
      return "";
    }
  };

  return (
    <div className={cn("space-y-5", className)}>
      {/* Snapshot chips from data we already hold */}
      <div>
        <p className="mb-2 text-[11px] font-semibold text-foreground">
          {t("snapshotTitle")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <StatChip
            label={t("snapshot.messages")}
            value={String(threadStats.total)}
          />
          <StatChip
            label={t("snapshot.duration")}
            value={
              threadStats.spanMs != null
                ? formatDuration(threadStats.spanMs, t)
                : "—"
            }
          />
          {threadStats.lastAt != null ? (
            <StatChip
              label={t("snapshot.lastActivity")}
              value={formatWhen(threadStats.lastAt)}
              className="col-span-2"
            />
          ) : null}
          {threadStats.failedDelivery > 0 ? (
            <StatChip
              label={t("snapshot.failedDelivery")}
              value={String(threadStats.failedDelivery)}
              danger
            />
          ) : null}
          {analysis ? (
            <>
              <StatChip
                label={t("snapshot.quality")}
                value={`${Math.round(analysis.attendanceQuality)}%`}
              />
              <StatChip
                label={t("snapshot.sentiment")}
                value={t(`analysis.sentiment.${analysis.sentiment}`)}
              />
            </>
          ) : null}
        </div>
      </div>

      {/* Path, horizontal stacked chart */}
      <div>
        <div className="mb-2">
          <p className="text-[11px] font-semibold text-foreground">
            {t("title")}
          </p>
          <p className="text-[10px] text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="h-[72px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={pathData}
              layout="vertical"
              margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
              barCategoryGap={8}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#e1e7ef"
              />
              <XAxis
                type="number"
                domain={[0, 3]}
                ticks={[0, 1, 2, 3]}
                tickLine={false}
                axisLine={false}
                fontSize={10}
                tick={{ fill: "#65758b" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={52}
                tickLine={false}
                axisLine={false}
                fontSize={10}
                tick={{ fill: "#344256" }}
              />
              <Tooltip
                cursor={{ fill: "rgba(36,99,235,0.04)" }}
                content={({ active }) => {
                  if (!active) return null;
                  return (
                    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                      <p className="mb-1.5 font-semibold text-foreground">
                        {t("title")}
                      </p>
                      {stages.map((s) => (
                        <p key={s.id} className="text-muted-foreground">
                          <span
                            className="mr-1.5 inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: s.solid }}
                          />
                          {s.label}
                          <span className="ml-1 font-medium text-foreground">
                            ·{" "}
                            {s.state === "done"
                              ? t("state.done")
                              : s.state === "current"
                                ? t("state.current")
                                : t("state.upcoming")}
                          </span>
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="new"
                name={stageByKey.new?.label}
                stackId="path"
                fill={stageByKey.new?.color}
                radius={[4, 0, 0, 4]}
                barSize={18}
              />
              <Bar
                dataKey="ongoing"
                name={stageByKey.ongoing?.label}
                stackId="path"
                fill={stageByKey.ongoing?.color}
                barSize={18}
              />
              <Bar
                dataKey="finished"
                name={stageByKey.finished?.label}
                stackId="path"
                fill={stageByKey.finished?.color}
                radius={[0, 4, 4, 0]}
                barSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {stages.map((s) => (
            <li
              key={s.id}
              className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  s.state === "current" && "outline outline-2 outline-offset-1",
                )}
                style={{
                  backgroundColor: s.solid,
                  outlineColor:
                    s.state === "current" ? s.solid : undefined,
                }}
              />
              <span
                className={cn(
                  s.state !== "upcoming" && "font-medium text-foreground",
                )}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Message mix */}
      {mixData.length > 0 ? (
        <HorizontalBars
          title={t("mixTitle")}
          subtitle={t("mixSubtitle")}
          rows={mixData}
        />
      ) : null}

      {/* Channel mix (when both present) */}
      {channelData.length > 1 ? (
        <HorizontalBars
          title={t("channelTitle")}
          subtitle={t("channelSubtitle")}
          rows={channelData}
        />
      ) : null}

      {/* Compact analysis (if attached to inbox entry) */}
      {analysis?.summary ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-foreground">
            {t("analysisTitle")}
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-4">
            {analysis.summary}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <TagChip
              label={t(`analysis.qualification.${analysis.qualification}`)}
            />
            <TagChip label={t(`analysis.disposition.${analysis.disposition}`)} />
            {analysis.nextAction ? (
              <TagChip label={t(`analysis.nextAction.${analysis.nextAction}`)} />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatChip({
  label,
  value,
  className,
  danger,
}: {
  label: string;
  value: string;
  className?: string;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-background/80 px-2.5 py-2",
        danger && "border-rose-200 bg-rose-50/80",
        className,
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums tracking-tight text-foreground",
          danger && "text-rose-700",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TagChip({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground">
      {label}
    </span>
  );
}

function HorizontalBars({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: { name: string; count: number; color: string }[];
}) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-[11px] font-semibold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
      <div
        className="w-full"
        style={{ height: Math.max(88, rows.length * 34 + 20) }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 2, right: 12, left: 4, bottom: 0 }}
            barCategoryGap={8}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#e1e7ef"
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              fontSize={10}
              tick={{ fill: "#65758b" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={68}
              tickLine={false}
              axisLine={false}
              fontSize={10}
              tick={{ fill: "#344256" }}
            />
            <Tooltip
              cursor={{ fill: "rgba(36,99,235,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as (typeof rows)[0];
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                    <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      {row.name}: {row.count}
                    </span>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12} maxBarSize={16}>
              {rows.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
