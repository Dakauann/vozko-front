import { addDays, isValid, parseISO } from "date-fns";

import { presetRange, type PeriodRange } from "@/lib/attendance/period";

import type { RunStatus, WorkflowRunLog } from "./types";

export interface RunsExportFilters {
  status?: RunStatus;
  entryId?: string;
}

export interface RunsExportQuery extends RunsExportFilters {
  from: string;
  to: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function localMidnight(day: string): Date | null {
  if (!DAY.test(day)) return null;
  const date = parseISO(day);
  return isValid(date) ? date : null;
}

export function defaultRunsExportRange(now: Date = new Date()): PeriodRange {
  return presetRange("7d", now);
}

export function runsExportQuery(range: PeriodRange, filters: RunsExportFilters): RunsExportQuery | null {
  const from = localMidnight(range.dateFrom);
  const lastDay = localMidnight(range.dateTo);
  if (!from || !lastDay) return null;
  return {
    from: from.toISOString(),
    to: addDays(lastDay, 1).toISOString(),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.entryId ? { entryId: filters.entryId } : {}),
  };
}

export function stepJsonText(step: WorkflowRunLog): string {
  return JSON.stringify({ input: step.input ?? null, output: step.output ?? null }, null, 2);
}
