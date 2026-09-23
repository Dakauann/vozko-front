"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash } from "@/components/icons";

import type {
  AttendanceTarget,
  TargetScope,
} from "@/lib/attendance/targets/types";
import type { MetricProjection, MetricSpec } from "@/lib/attendance/types";

import {
  deleteAttendanceTargetAction,
  listAttendanceTargetsAction,
  listTargetableMetricsAction,
  upsertAttendanceTargetAction,
} from "@/app/actions/attendance-targets";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Meter } from "@/components/charts/vozko";
import { useMetricsFmt } from "@/components/dashboard/attendance/primitives";
import { cn } from "@/lib/utils";

const SUGGESTED_METRICS = [
  "finished",
  "resolution_pct",
  "avg_frt_mins",
  "reopen_rate",
];

export interface TargetsDialogScope {
  scope: TargetScope;
  scopeId?: string;
  scopeLabel: string;
}

interface Snapshot {
  metrics: MetricSpec[];
  targets: AttendanceTarget[];
  error: string | null;
}

async function fetchSnapshot(period: string): Promise<Snapshot> {
  const [metricsResult, targetsResult] = await Promise.all([
    listTargetableMetricsAction(),
    listAttendanceTargetsAction(period),
  ]);
  return {
    metrics: metricsResult.metrics,
    targets: targetsResult.targets,
    error: metricsResult.error ?? targetsResult.error,
  };
}

function storedToInput(spec: MetricSpec, target: AttendanceTarget): string {
  return String(spec.kind === "money" ? target.value / 100 : target.value);
}

function inputToStored(spec: MetricSpec, raw: string): number | null {
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return spec.kind === "money" ? Math.round(parsed * 100) : parsed;
}

export function TargetsDialog({
  open,
  onOpenChange,
  period,
  scope,
  defaultCurrency,
  projections,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: string;
  scope: TargetsDialogScope;
  defaultCurrency: string;
  projections?: MetricProjection[];
  onSaved?: () => void;
}) {
  const te = useTranslations("metricsOps.attendance.executive");
  const tc = useTranslations("metricsOps.common");
  const fmt = useMetricsFmt();

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loading = open && loadedPeriod !== period;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchSnapshot(period).then((result) => {
      if (cancelled) return;
      setSnapshot(result);
      setLoadedPeriod(period);
      setDrafts({});
      setAdded([]);
      setPicking(false);
      setSearch("");
      setSaveError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, period]);

  const specByKey = useMemo(() => {
    const map = new Map<string, MetricSpec>();
    for (const spec of snapshot?.metrics ?? []) map.set(spec.key, spec);
    return map;
  }, [snapshot]);

  const storedByKey = useMemo(() => {
    const map = new Map<string, AttendanceTarget>();
    for (const target of snapshot?.targets ?? []) {
      if (target.scope !== scope.scope) continue;
      if ((target.scopeId ?? "") !== (scope.scopeId ?? "")) continue;
      map.set(target.metricKey, target);
    }
    return map;
  }, [snapshot, scope.scope, scope.scopeId]);

  const actualByKey = useMemo(() => {
    const map = new Map<string, MetricProjection>();
    for (const projection of projections ?? []) map.set(projection.metric_key, projection);
    return map;
  }, [projections]);

  const goalKeys = useMemo(() => {
    const keys = new Set<string>(storedByKey.keys());
    for (const key of added) keys.add(key);
    return Array.from(keys).filter((key) => specByKey.has(key));
  }, [storedByKey, added, specByKey]);

  const availableMetrics = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (snapshot?.metrics ?? [])
      .filter((spec) => !goalKeys.includes(spec.key))
      .filter((spec) => {
        if (!term) return true;
        return te(`metric.${spec.key}`).toLowerCase().includes(term);
      });
  }, [snapshot, goalKeys, search, te]);

  const valueFor = useCallback(
    (key: string) => {
      if (key in drafts) return drafts[key];
      const spec = specByKey.get(key);
      const stored = storedByKey.get(key);
      if (!spec || !stored) return "";
      return storedToInput(spec, stored);
    },
    [drafts, specByKey, storedByKey],
  );

  const dirtyCount = useMemo(() => {
    let count = 0;
    for (const key of goalKeys) {
      const spec = specByKey.get(key);
      if (!spec) continue;
      const stored = storedByKey.get(key);
      const current = valueFor(key).trim();
      const saved = stored ? storedToInput(spec, stored) : "";
      if (current !== saved) count++;
    }
    return count;
  }, [goalKeys, specByKey, storedByKey, valueFor]);

  const saveAll = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    let failure: string | null = null;

    for (const key of goalKeys) {
      const spec = specByKey.get(key);
      if (!spec) continue;
      const stored = storedByKey.get(key);
      const raw = valueFor(key).trim();
      const saved = stored ? storedToInput(spec, stored) : "";
      if (raw === saved) continue;

      if (raw === "") {
        if (stored) {
          failure = (await deleteAttendanceTargetAction(stored.id)).error ?? failure;
        }
        continue;
      }
      const value = inputToStored(spec, raw);
      if (value === null) {
        failure = te("invalidValue");
        continue;
      }
      failure =
        (
          await upsertAttendanceTargetAction({
            scope: scope.scope,
            scopeId: scope.scopeId,
            metricKey: spec.key,
            period,
            value,
            currency: spec.kind === "money" ? defaultCurrency : undefined,
          })
        ).error ?? failure;
    }

    const refreshed = await fetchSnapshot(period);
    setSnapshot(refreshed);
    setLoadedPeriod(period);
    setDrafts({});
    setAdded([]);
    setSaveError(failure);
    setSaving(false);
    if (!failure) onSaved?.();
  }, [
    goalKeys,
    specByKey,
    storedByKey,
    valueFor,
    scope.scope,
    scope.scopeId,
    period,
    defaultCurrency,
    te,
    onSaved,
  ]);

  const removeGoal = useCallback((key: string) => {
    setAdded((prev) => prev.filter((k) => k !== key));
    setDrafts((prev) => ({ ...prev, [key]: "" }));
  }, []);

  const addGoal = useCallback((key: string) => {
    setAdded((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setPicking(false);
    setSearch("");
  }, []);

  const error = saveError ?? snapshot?.error ?? null;

  const unitFor = (spec: MetricSpec) => {
    if (spec.kind === "money") return defaultCurrency;
    if (spec.kind === "percent") return "%";
    if (spec.kind === "minutes") return tc("minUnit");
    return "";
  };

  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="w-[95vw] max-w-[680px] max-h-[88vh] overflow-y-auto">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{te("savedAt", { period })}</ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {te("targetsDescription", { period, scope: scope.scopeLabel })}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <ElevatedDialogBody>
          {error ? (
            <div className="mb-3 rounded-[--radius] border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive-ink">
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {tc("loading")}
            </p>
          ) : (
            <div className="space-y-3">
              {goalKeys.length === 0 && !picking ? (
                <div className="rounded-[--radius] border border-dashed border-border px-4 py-5 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {te("noGoalsTitle", { period })}
                  </p>
                  <p className="mx-auto mt-1 max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
                    {te("noGoalsBody")}
                  </p>
                  <p className="mt-3 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {te("suggested")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
                    {SUGGESTED_METRICS.filter((key) => specByKey.has(key)).map(
                      (key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => addGoal(key)}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/10"
                        >
                          {te(`metric.${key}`)}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              <ul className="space-y-2">
                {goalKeys.map((key) => {
                  const spec = specByKey.get(key);
                  if (!spec) return null;
                  const projection = actualByKey.get(key);
                  const value = valueFor(key);
                  const numericTarget = value === "" ? null : inputToStored(spec, value);
                  const progress =
                    projection && numericTarget && numericTarget > 0
                      ? Math.min(
                          100,
                          Math.max(0, (projection.actual / numericTarget) * 100),
                        )
                      : null;

                  return (
                    <li
                      key={key}
                      className="rounded-[--radius] border border-border bg-card px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {te(`metric.${key}`)}
                          </p>
                          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground">
                            {te(`metricHelp.${key}`)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ElevatedInput
                            type="number"
                            min={0}
                            step="any"
                            value={value}
                            placeholder={te("noTargetPlaceholder")}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [key]: event.target.value,
                              }))
                            }
                            className="w-28 text-right"
                            aria-label={te(`metric.${key}`)}
                          />
                          <span className="w-8 text-2xs text-muted-foreground">
                            {unitFor(spec)}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            icon={<Trash weight="bold" className="h-3.5 w-3.5" />}
                            iconVisible
                            onClick={() => removeGoal(key)}
                            aria-label={te("remove")}
                            className="h-8 w-8 text-destructive-ink"
                          />
                        </div>
                      </div>

                      {projection ? (
                        <div className="mt-2">
                          <div className="flex items-baseline justify-between gap-2 text-2xs text-muted-foreground">
                            <span>
                              {te("currentValue")}
                              {": "}
                              <span className="readout font-semibold tabular-nums text-foreground">
                                {spec.kind === "money"
                                  ? fmt.money(projection.actual, defaultCurrency)
                                  : spec.kind === "percent"
                                    ? fmt.pct(projection.actual)
                                    : spec.kind === "minutes"
                                      ? fmt.mins(projection.actual)
                                      : fmt.num(Math.round(projection.actual))}
                              </span>
                            </span>
                            <span>
                              {spec.direction === "lower"
                                ? te("lowerIsBetter")
                                : te("higherIsBetter")}
                            </span>
                          </div>
                          {progress !== null ? (
                            <Meter value={progress} size="sm" className="mt-1" />
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              {picking ? (
                <div className="rounded-[--radius] border border-border px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">
                    {te("pickMetric")}
                  </p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    {te("addTargetHelp")}
                  </p>
                  <ElevatedInput
                    value={search}
                    placeholder={te("searchMetric")}
                    onChange={(event) => setSearch(event.target.value)}
                    className="mt-2 w-full"
                  />
                  {availableMetrics.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {te("allMetricsUsed")}
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                      {availableMetrics.map((spec) => (
                        <li key={spec.key}>
                          <button
                            type="button"
                            onClick={() => addGoal(spec.key)}
                            className="w-full rounded-[--radius] px-2 py-1.5 text-left transition-colors hover:bg-muted"
                          >
                            <span className="block text-sm text-foreground">
                              {te(`metric.${spec.key}`)}
                            </span>
                            <span className="block text-2xs text-muted-foreground">
                              {te(`metricHelp.${spec.key}`)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      title={te("cancel")}
                      onClick={() => setPicking(false)}
                    />
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus weight="bold" className="h-3.5 w-3.5" />}
                  iconVisible
                  title={te("addTarget")}
                  onClick={() => setPicking(true)}
                  disabled={saving}
                />
              )}
            </div>
          )}
        </ElevatedDialogBody>

        <ElevatedDialogFooter>
          <span className="mr-auto text-2xs text-muted-foreground">
            {dirtyCount > 0
              ? te("unsavedChanges", { count: String(dirtyCount) })
              : ""}
          </span>
          <Button
            variant="secondary"
            title={te("close")}
            onClick={() => onOpenChange(false)}
          />
          <Button
            variant="primary"
            title={saving ? tc("loading") : te("saveAll")}
            onClick={() => void saveAll()}
            disabled={saving || dirtyCount === 0}
            className={cn(dirtyCount === 0 && "opacity-60")}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
