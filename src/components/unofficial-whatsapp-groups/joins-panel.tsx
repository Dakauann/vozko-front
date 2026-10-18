"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { cancelGroupJoinAction, listGroupJoinsAction } from "@/app/actions/unofficial-whatsapp-groups";
import { Meter, VOZ_SERIES } from "@/components/charts/vozko";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { ArrowClockwise, CircleNotch } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { groupErrorKey } from "@/lib/unofficial-whatsapp-groups/group-errors";
import {
  doneJoins,
  groupJoinPlans,
  hasMovingJoins,
  inviteCode,
  nextDueAt,
  planAttempts,
  planOutcome,
  planProgress,
  plansToWatch,
  type JoinPlanOutcome,
} from "@/lib/unofficial-whatsapp-groups/join-plan";
import type { JoinStatus, JoinTask } from "@/lib/unofficial-whatsapp-groups/types";
import type { UnofficialWhatsAppInstance } from "@/lib/unofficial-whatsapp/types";
import { cn } from "@/lib/utils";

import { GroupsPanel } from "./kit/panel";
import { useGroupsFormat } from "./kit/use-groups-format";
import { numberLabel, useWorkspaceNumbers } from "./use-workspace-numbers";

const JOINS_POLL_MS = 20_000;

const STATUS_DOT: Record<JoinStatus, string> = {
  pending: "bg-muted-foreground",
  running: "bg-info",
  done: "bg-healthy",
  failed: "bg-destructive",
  cancelled: "bg-muted-foreground",
};

const OUTCOME_TONE: Record<JoinPlanOutcome, StatusChipTone> = {
  inProgress: "neutral",
  failed: "fault",
  cancelled: "muted",
  done: "healthy",
};

type JoinsResult = Awaited<ReturnType<typeof listGroupJoinsAction>>;

interface JoinsPanelProps {
  refreshSignal?: number;
  numbers?: UnofficialWhatsAppInstance[];
  onJoinDone?: () => void;
  className?: string;
}

export function JoinsPanel({ refreshSignal = 0, numbers, onJoinDone, className }: JoinsPanelProps) {
  const t = useTranslations("unofficialGroups.list.joins");
  const tErrors = useTranslations("unofficialGroups.list.errors");
  const fmt = useGroupsFormat();
  const { can } = useWorkspace();
  const canCancel = can("unofficial_whatsapp_groups", "create");
  const own = useWorkspaceNumbers(!numbers);
  const known = numbers ?? own.numbers;

  const [tasks, setTasks] = useState<JoinTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const lastDone = useRef<number | null>(null);
  const hasLoaded = useRef(false);
  const onJoinDoneRef = useRef(onJoinDone);

  useEffect(() => {
    onJoinDoneRef.current = onJoinDone;
  }, [onJoinDone]);

  const applyJoins = useCallback(
    (result: JoinsResult, manual: boolean) => {
      setLoaded(true);
      if (result.error) {
        if (hasLoaded.current) {
          if (manual) toast.error(t("reloadFailed"), { description: result.error });
          return;
        }
        setError(result.error);
        return;
      }
      hasLoaded.current = true;
      setError(null);
      setTasks(result.tasks);
      const done = doneJoins(result.tasks);
      if (lastDone.current !== null && done > lastDone.current) onJoinDoneRef.current?.();
      lastDone.current = done;
    },
    [t],
  );

  const fetchJoins = useCallback(
    (manual: boolean) => {
      if (manual) setRefreshing(true);
      return listGroupJoinsAction().then((result) => {
        if (manual) setRefreshing(false);
        applyJoins(result, manual);
      });
    },
    [applyJoins],
  );

  useEffect(() => {
    let cancelled = false;
    void listGroupJoinsAction().then((result) => {
      if (!cancelled) applyJoins(result, false);
    });
    return () => {
      cancelled = true;
    };
  }, [applyJoins, refreshSignal]);

  const moving = useMemo(() => hasMovingJoins(tasks), [tasks]);

  useEffect(() => {
    if (!moving) return;
    const timer = setInterval(() => void fetchJoins(false), JOINS_POLL_MS);
    return () => clearInterval(timer);
  }, [moving, fetchJoins]);

  const plans = useMemo(() => plansToWatch(groupJoinPlans(tasks)), [tasks]);
  const labels = useMemo(() => new Map(known.map((number) => [number.id, numberLabel(number)])), [known]);

  const cancel = useCallback(
    async (planId: string) => {
      setCancelling(planId);
      const result = await cancelGroupJoinAction(planId);
      setCancelling(null);
      if (result.error) {
        const key = groupErrorKey(result.error);
        toast.error(t("cancelFailed"), { description: key ? tErrors(key) : result.error });
        return;
      }
      toast(t("cancelled", { count: result.data?.cancelled ?? 0 }));
      void fetchJoins(false);
    },
    [t, tErrors, fetchJoins],
  );

  const describeError = (message: string) => {
    const key = groupErrorKey(message);
    return key ? tErrors(key) : message;
  };

  if (!loaded || (plans.length === 0 && !error)) return null;

  const refreshButton = (
    <Button
      variant="ghost"
      size="sm"
      title=""
      aria-label={t("refresh")}
      icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", refreshing && "animate-spin")} />}
      iconVisible
      disabled={refreshing}
      onClick={() => void fetchJoins(true)}
    />
  );

  return (
    <GroupsPanel
      title={t("title")}
      subtitle={moving ? t("subtitleMoving") : t("subtitle")}
      meta={plans.length > 0 ? <span className="readout">{t("plans", { count: plans.length })}</span> : undefined}
      actions={refreshButton}
      className={className}
    >
      {error ? (
        <Notice tone="fault" title={t("loadFailed")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 break-words">{error}</p>
            <Button variant="secondary" size="sm" title={t("retry")} onClick={() => void fetchJoins(true)} disabled={refreshing} />
          </div>
        </Notice>
      ) : null}

      {plans.length > 0 ? (
        <ul className="-mt-1 divide-y divide-border">
          {plans.map((plan) => {
            const outcome = planOutcome(plan);
            const progress = planProgress(plan);
            const due = nextDueAt(plan);
            const { attempts, error: lastError } = planAttempts(plan);
            return (
              <li
                key={plan.planId}
                className="grid grid-cols-1 gap-x-4 gap-y-1.5 py-2.5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusChip tone={OUTCOME_TONE[outcome]} label={t(`outcome.${outcome}`)} />
                  <span className="truncate font-mono text-xs font-semibold text-foreground" title={plan.inviteLink}>
                    {inviteCode(plan.inviteLink)}
                  </span>
                  <span className="text-2xs text-muted-foreground">{plan.follow ? t("follows") : t("doesNotFollow")}</span>
                </div>

                <div className="flex min-w-0 items-center gap-2">
                  <Meter
                    value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
                    size="sm"
                    color={VOZ_SERIES[0]}
                    className="w-16"
                    label={t("progress", { done: progress.done, total: progress.total })}
                  />
                  <span className="readout whitespace-nowrap text-xs text-foreground">{t("progress", { done: progress.done, total: progress.total })}</span>
                </div>

                <div className="flex min-w-0 flex-col text-2xs text-muted-foreground">
                  {due ? <span className="readout truncate text-foreground">{t("dueAt", { time: fmt.dateTime(due) })}</span> : <EmptyValue className="text-2xs" />}
                  <span className="readout">{t("attempts", { count: attempts })}</span>
                </div>

                <div className="flex justify-start md:justify-end">
                  {canCancel && plan.cancellable ? (
                    <Button
                      variant="outline"
                      size="sm"
                      title={t("cancel")}
                      icon={cancelling === plan.planId ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> : undefined}
                      iconVisible={cancelling === plan.planId}
                      disabled={cancelling === plan.planId}
                      onClick={() => void cancel(plan.planId)}
                    />
                  ) : null}
                </div>

                <ol className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 md:col-span-4">
                  {plan.tasks.map((task) => (
                    <li key={task.id} className="inline-flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
                      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[task.status])} />
                      <span className="max-w-[10rem] truncate text-foreground">{labels.get(task.instanceId) ?? task.instanceId}</span>
                      <span>{t(`status.${task.status}`)}</span>
                    </li>
                  ))}
                </ol>

                {lastError && outcome !== "done" ? (
                  <p className="line-clamp-2 break-words text-2xs text-muted-foreground md:col-span-4" title={lastError}>
                    {t("lastError", { reason: describeError(lastError) })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </GroupsPanel>
  );
}
