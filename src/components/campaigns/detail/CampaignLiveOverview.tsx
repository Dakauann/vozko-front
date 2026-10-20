"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { ChatCircle, CheckCircle, Clock, Eye, PaperPlaneTilt, Prohibit, ShieldWarning, Users, Warning } from "@/components/icons";
import { SegmentBar } from "@/components/charts/vozko";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import type { CampaignPace } from "@/lib/campaigns/live";
import type { CampaignMetrics, CampaignStatus } from "@/lib/campaigns/metrics";
import { cn } from "@/lib/utils";

export type CampaignStageKey =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "notEligiblePossibleSpam"
  | "skippedNotOnWhatsApp";

export const CAMPAIGN_STAGE_COLOR: Record<CampaignStageKey, string> = {
  pending: "hsl(var(--plate-neutral))",
  sent: "hsl(var(--chart-2))",
  delivered: "hsl(var(--chart-1))",
  read: "hsl(var(--info))",
  failed: "hsl(var(--destructive))",
  notEligiblePossibleSpam: "hsl(var(--mark-skipped))",
  skippedNotOnWhatsApp: "hsl(var(--muted-foreground))",
};

export const CAMPAIGN_STAGE_STATUS: Record<CampaignStageKey, string> = {
  pending: "PENDING",
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
  notEligiblePossibleSpam: "NOT_ELIGIBLE_POSSIBLE_SPAM",
  skippedNotOnWhatsApp: "SKIPPED_NOT_ON_WHATSAPP",
};

const STAGE_ICON: Record<CampaignStageKey, ReactNode> = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" weight="fill" />,
  sent: <PaperPlaneTilt className="ink-2 h-4 w-4" weight="fill" />,
  delivered: <CheckCircle className="ink-1 h-4 w-4" weight="fill" />,
  read: <Eye className="h-4 w-4 text-info-ink" weight="fill" />,
  failed: <Warning className="h-4 w-4 text-destructive-ink" weight="fill" />,
  notEligiblePossibleSpam: <ShieldWarning className="h-4 w-4 text-warning-ink" weight="fill" />,
  skippedNotOnWhatsApp: <Prohibit className="h-4 w-4 text-muted-foreground" weight="fill" />,
};

const STRIP_ORDER: CampaignStageKey[] = ["pending", "sent", "delivered", "read", "failed", "notEligiblePossibleSpam", "skippedNotOnWhatsApp"];

const BAR_ORDER: CampaignStageKey[] = ["read", "delivered", "sent", "pending", "failed", "notEligiblePossibleSpam", "skippedNotOnWhatsApp"];

const OPTIONAL_STAGES: ReadonlySet<CampaignStageKey> = new Set(["skippedNotOnWhatsApp"]);

const FLOW: CampaignStageKey[] = ["pending", "sent", "delivered", "read"];

const MAX_FLOATS_PER_STEP = 5;

const STATUS_TONE: Record<CampaignStatus, StatusChipTone> = {
  RUNNING: "healthy",
  PAUSED: "warning",
  STOPPED: "muted",
  COMPLETED: "neutral",
};

export function stageCount(metrics: CampaignMetrics, key: CampaignStageKey): number {
  return metrics[key] ?? 0;
}

function visibleStages(metrics: CampaignMetrics, order: CampaignStageKey[]): CampaignStageKey[] {
  return order.filter((key) => !OPTIONAL_STAGES.has(key) || stageCount(metrics, key) > 0);
}

interface FloatingMessage {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  delay: number;
}

function useFlowAnimation(metrics: CampaignMetrics) {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRefs = useRef<Partial<Record<CampaignStageKey, HTMLElement | null>>>({});
  const previousRef = useRef<Record<string, number> | null>(null);
  const sequenceRef = useRef(0);
  const [floating, setFloating] = useState<FloatingMessage[]>([]);
  const { pending, sent, delivered, read } = metrics;

  useLayoutEffect(() => {
    const current: Record<string, number> = { pending, sent, delivered, read };
    const previous = previousRef.current;
    previousRef.current = current;
    const container = containerRef.current;
    if (!previous || !container) return;

    const origin = container.getBoundingClientRect();
    const centre = (key: CampaignStageKey) => {
      const rect = anchorRefs.current[key]?.getBoundingClientRect();
      return rect ? { x: rect.left - origin.left + rect.width / 2, y: rect.top - origin.top + rect.height / 2 } : null;
    };

    const born: FloatingMessage[] = [];
    FLOW.slice(0, -1).forEach((key, index) => {
      const next = FLOW[index + 1];
      const moved = Math.min(previous[key] - current[key], current[next] - previous[next], MAX_FLOATS_PER_STEP);
      const from = centre(key);
      const to = centre(next);
      if (moved <= 0 || !from || !to) return;
      for (let i = 0; i < moved; i++) {
        sequenceRef.current += 1;
        born.push({ id: `flow-${sequenceRef.current}`, from, to, color: CAMPAIGN_STAGE_COLOR[next], delay: born.length * 0.1 });
      }
    });
    if (born.length === 0) return;

    const frame = window.requestAnimationFrame(() => setFloating((list) => [...list, ...born]));
    const timer = window.setTimeout(() => {
      setFloating((list) => list.filter((message) => !born.some((b) => b.id === message.id)));
    }, 1200 + born.length * 100);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pending, sent, delivered, read]);

  return { containerRef, anchorRefs, floating };
}

function FloatingMessages({ messages }: { messages: FloatingMessage[] }) {
  return (
    <AnimatePresence>
      {messages.map((message) => (
        <motion.div
          key={message.id}
          className="pointer-events-none absolute left-0 top-0 z-20"
          initial={{ x: message.from.x - 14, y: message.from.y - 14, opacity: 1, scale: 1 }}
          animate={{
            x: [message.from.x - 14, (message.from.x + message.to.x) / 2 - 14, message.to.x - 14],
            y: [message.from.y - 14, Math.min(message.from.y, message.to.y) - 34, message.to.y - 14],
            opacity: [1, 1, 0],
            scale: [1, 1.15, 0.8],
          }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{ duration: 1, delay: message.delay, ease: "easeInOut", times: [0, 0.5, 1] }}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-card shadow-[var(--elev-4)]" aria-hidden>
            <ChatCircle weight="fill" className="h-3.5 w-3.5" style={{ color: message.color }} />
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

function useDuration() {
  const t = useTranslations("campaignDetail.live");
  return (seconds: number) => {
    if (seconds < 60) return t("duration.underMinute");
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return t("duration.minutes", { count: minutes });
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? t("duration.hours", { count: hours }) : t("duration.hoursMinutes", { hours, minutes: rest });
  };
}

function Fact({ value, label, emphasis = false }: { value: ReactNode; label: string; emphasis?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <b className={cn("readout truncate font-display font-semibold leading-tight text-foreground", emphasis ? "text-[28px]" : "text-lg")}>
        {value}
      </b>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function CampaignLiveOverview({
  status,
  metrics,
  pace,
  sampledAt,
  progressUnavailable,
  activeStatus,
  onFilterStatus,
}: {
  status: CampaignStatus;
  metrics: CampaignMetrics;
  pace?: CampaignPace;
  sampledAt?: string;
  progressUnavailable: boolean;
  activeStatus: string;
  onFilterStatus: (status: string) => void;
}) {
  const t = useTranslations("campaignDetail");
  const format = useFormatter();
  const duration = useDuration();
  const { containerRef, anchorRefs, floating } = useFlowAnimation(metrics);
  const running = status === "RUNNING";
  const completion = Math.max(0, Math.min(100, metrics.completionRate));
  const sampleTime = sampledAt ? format.dateTime(new Date(sampledAt), { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;
  const noPace = <span className="text-muted-foreground">{t("live.noPace")}</span>;

  const segments = visibleStages(metrics, BAR_ORDER).map((key) => ({
    key,
    label: t(`stage.${key}`),
    value: stageCount(metrics, key),
    color: CAMPAIGN_STAGE_COLOR[key],
  }));

  return (
    <section className="well relative overflow-hidden" data-tour="wd-info" aria-label={t("live.title")}>
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 border-b border-border px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-end gap-x-8 gap-y-3">
          <Fact
            emphasis
            value={`${format.number(Math.round(completion))}%`}
            label={t("live.processedOf", { processed: format.number(metrics.processed), total: format.number(metrics.totalNumbers) })}
          />
          <Fact value={running && pace ? format.number(pace.processedPerMinute) : noPace} label={t("live.perMinute")} />
          <Fact
            value={
              running && pace?.remainingSeconds !== undefined
                ? t("live.about", { duration: duration(pace.remainingSeconds) })
                : metrics.pending === 0
                  ? t("live.nothingLeft")
                  : noPace
            }
            label={t("live.remaining")}
          />
          <Fact value={`${format.number(Math.round(metrics.successRate))}%`} label={t("live.successRate")} />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusChip tone={STATUS_TONE[status]} label={t(`status.${status}`)} />
          <p className="flex items-center gap-1.5 text-2xs text-muted-foreground" aria-live="polite">
            {running && !progressUnavailable ? (
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-healthy opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-healthy" />
              </span>
            ) : null}
            {progressUnavailable
              ? t("live.unavailable")
              : sampleTime
                ? running
                  ? t("live.liveAt", { time: sampleTime })
                  : t("live.updatedAt", { time: sampleTime })
                : t("live.loading")}
          </p>
        </div>
      </div>

      <div className="px-4 py-3 sm:px-5">
        <p className="legend mb-2 flex justify-between">
          <span>{t("live.distribution")}</span>
          <span>{t("live.contacts", { count: metrics.totalNumbers })}</span>
        </p>
        <SegmentBar segments={segments} size="md" formatValue={(value) => format.number(value)} />
      </div>

      <div ref={containerRef} className="relative border-t border-border bg-card px-2 py-1.5 sm:px-3" data-tour="wd-metrics">
        <FloatingMessages messages={floating} />
        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-2 px-2 py-1">
            <Users className="h-4 w-4 text-info-ink" weight="fill" />
            <span className="whitespace-nowrap text-xs text-muted-foreground">{t("live.total")}</span>
            <span className="readout whitespace-nowrap text-sm font-semibold text-foreground">{format.number(metrics.totalNumbers)}</span>
          </span>
          {visibleStages(metrics, STRIP_ORDER).map((key) => {
            const filterStatus = CAMPAIGN_STAGE_STATUS[key];
            const applied = activeStatus === filterStatus;
            return (
              <button
                key={key}
                type="button"
                ref={(node) => {
                  anchorRefs.current[key] = node;
                }}
                aria-pressed={applied}
                title={applied ? t("live.clearFilter") : t("live.filterBy")}
                onClick={() => onFilterStatus(applied ? "" : filterStatus)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[--radius] px-2 py-1 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  applied ? "bg-muted text-foreground shadow-[inset_0_-2px_0_0_hsl(var(--primary))]" : "hover:bg-muted",
                )}
              >
                {STAGE_ICON[key]}
                <span className="whitespace-nowrap text-xs text-muted-foreground">{t(`stage.${key}`)}</span>
                <span
                  className={cn(
                    "readout whitespace-nowrap text-sm font-semibold text-foreground",
                    !applied && "underline decoration-border-strong underline-offset-[3px]",
                  )}
                >
                  {format.number(stageCount(metrics, key))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
