"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, Headset } from "@/components/icons";
import { getLiveQueuesAction, getQueueStatsAction } from "@/app/actions/call-routing";
import {
  LIVE_REFRESH_MS,
  STATS_REFRESH_MS,
  formatWait,
  localDayWindow,
  percent,
  queueAttention,
  totals,
  withElapsed,
  type QueueAttention,
} from "@/lib/call-routing/monitoring";
import type { AgentState, QueueLive, QueueStats } from "@/lib/call-routing/types";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { cn } from "@/lib/utils";

const ATTENTION_TONE: Record<QueueAttention, string> = {
  calm: "bg-muted text-muted-foreground",
  busy: "bg-warning text-warning-foreground",
  critical: "bg-destructive text-destructive-foreground",
};

const STATE_DOT: Record<AgentState, string> = {
  free: "bg-healthy",
  ringing: "bg-warning",
  on_call: "bg-info",
  wrap_up: "bg-muted-foreground",
  offline: "bg-border-strong",
};

const COUNT_KEYS = [
  ["free", "free"],
  ["onCall", "on_call"],
  ["ringing", "ringing"],
  ["wrapUp", "wrap_up"],
  ["offline", "offline"],
] as const;

function useVisibleInterval(callback: () => void, delayMs: number) {
  useEffect(() => {
    callback();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") callback();
    }, delayMs);
    return () => clearInterval(timer);
  }, [callback, delayMs]);
}

export function useQueueMonitor() {
  const [live, setLive] = useState<QueueLive[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [stats, setStats] = useState<QueueStats[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadLive = useCallback(() => {
    void getLiveQueuesAction().then((result) => {
      setError(result.error ?? null);
      setLive(result.queues);
      const at = Date.now();
      setFetchedAt(at);
      setNow(at);
    });
  }, []);

  const loadStats = useCallback(() => {
    const { from, to } = localDayWindow(new Date());
    void getQueueStatsAction(from, to).then((result) => setStats(result.stats));
  }, []);

  useVisibleInterval(loadLive, LIVE_REFRESH_MS);
  useVisibleInterval(loadStats, STATS_REFRESH_MS);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = fetchedAt > 0 ? Math.max(0, Math.floor((now - fetchedAt) / 1000)) : 0;
  const ticking = useMemo(() => live?.map((queue) => withElapsed(queue, elapsed)) ?? null, [live, elapsed]);
  return { live: ticking, stats, error };
}

export function QueueMonitor() {
  const t = useTranslations("callQueues.monitor");
  const { live, stats, error } = useQueueMonitor();
  const [open, setOpen] = useState<string | null>(null);
  const statsByQueue = useMemo(() => new Map(stats.map((s) => [s.queueId, s])), [stats]);
  const day = useMemo(() => totals(stats), [stats]);

  if (live === null || live.length === 0) return null;
  const waitingNow = live.reduce((sum, queue) => sum + queue.waiting.length, 0);

  return (
    <section aria-labelledby="queue-monitor-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="queue-monitor-title" className="text-sm font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-healthy" />
          {error ? t("stale") : t("live")}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Figure label={t("waitingNow")} value={String(waitingNow)} emphasis={waitingNow > 0} />
        <Figure label={t("answeredToday")} value={String(day.answered)} />
        <Figure label={t("abandonedToday")} value={String(day.abandoned)} />
        <Figure label={t("serviceLevelToday")} value={day.offered === 0 ? "…" : percent(day.serviceLevel)} hint={t("serviceLevelHint")} />
      </dl>

      <ul className="grid gap-2 lg:grid-cols-2">
        {live.map((queue) => {
          const attention = queueAttention(queue);
          const today = statsByQueue.get(queue.id);
          const expanded = open === queue.id;
          return (
            <li key={queue.id} className="rounded-[--radius] border border-border bg-card">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : queue.id)}
                aria-expanded={expanded}
                className="flex w-full items-start gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
                  <Headset className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{queue.name}</span>
                    <span className={cn("rounded-[--radius] px-2 py-0.5 text-2xs font-semibold", ATTENTION_TONE[attention])}>
                      {t(`attention.${attention}`, { count: queue.waiting.length })}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {queue.waiting.length > 0 ? t("longestWait", { wait: formatWait(queue.longestWaitSeconds) }) : t("nobodyWaiting")}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {COUNT_KEYS.filter(([key]) => queue.counts[key] > 0).map(([key, state]) => (
                      <span key={key} className="flex items-center gap-1.5 text-2xs font-medium text-foreground">
                        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", STATE_DOT[state])} />
                        {t(`states.${state}`)} {queue.counts[key]}
                      </span>
                    ))}
                  </span>
                  {today ? (
                    <span className="readout mt-2 block text-2xs text-muted-foreground">
                      {t("today", {
                        answered: today.answered,
                        abandoned: today.abandoned,
                        wait: formatWait(today.averageAnswerSeconds),
                        level: today.offered === 0 ? "…" : percent(today.serviceLevel),
                      })}
                    </span>
                  ) : null}
                </span>
                <CaretDown aria-hidden className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
              </button>
              {expanded ? (
                <div className="grid gap-4 border-t border-border px-4 py-3 sm:grid-cols-2">
                  <div>
                    <p className="legend">{t("waitingList")}</p>
                    {queue.waiting.length === 0 ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">{t("nobodyWaiting")}</p>
                    ) : (
                      <ol className="mt-1.5 space-y-1">
                        {queue.waiting.map((caller, index) => (
                          <li key={caller.callId} className="flex items-center justify-between gap-2 text-xs">
                            <span className="readout truncate text-foreground">
                              {index + 1}. {caller.remoteNumber ? formatPhoneForDisplay(caller.remoteNumber) : t("hiddenNumber")}
                            </span>
                            <span className="readout tabular-nums text-muted-foreground">{formatWait(caller.waitingSeconds)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <div>
                    <p className="legend">{t("agents")}</p>
                    <ul className="mt-1.5 space-y-1">
                      {queue.agents.map((agent) => (
                        <li key={agent.userId} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-foreground">{agent.name || t("unnamed")}</span>
                          <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", STATE_DOT[agent.state])} />
                            {t(`states.${agent.state}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Figure({ label, value, hint, emphasis }: { label: string; value: string; hint?: string; emphasis?: boolean }) {
  return (
    <div className="rounded-[--radius] border border-border bg-card px-3 py-2.5" title={hint}>
      <dt className="text-2xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("readout mt-1 text-lg font-semibold tabular-nums", emphasis ? "text-warning-ink" : "text-foreground")}>{value}</dd>
    </div>
  );
}
