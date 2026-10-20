import type { RunStatus, WorkflowRun, WorkflowRunLog } from "./types";

export type StartedByKind = "agent" | "webhook" | "exit" | "manual" | "trigger";

export interface StartedBy {
  kind: StartedByKind;
  ref: string;
}

const STARTED_BY_KINDS: readonly StartedByKind[] = ["agent", "webhook", "exit", "manual", "trigger"];

export function parseStartedBy(raw: string | undefined): StartedBy | null {
  if (!raw) return null;
  const separator = raw.indexOf(":");
  if (separator <= 0) return null;
  const kind = raw.slice(0, separator) as StartedByKind;
  if (!STARTED_BY_KINDS.includes(kind)) return null;
  return { kind, ref: raw.slice(separator + 1) };
}

const RUN_STATUSES: ReadonlySet<string> = new Set<RunStatus>(["running", "waiting", "completed", "error", "cancelled"]);
const TERMINAL_RUN_STATUSES: ReadonlySet<RunStatus> = new Set(["completed", "error", "cancelled"]);

export function isRunStatus(status: string | null | undefined): status is RunStatus {
  return typeof status === "string" && RUN_STATUSES.has(status);
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return TERMINAL_RUN_STATUSES.has(status);
}

export function hasLiveRuns(runs: readonly Pick<WorkflowRun, "status">[]): boolean {
  return runs.some((run) => !isTerminalRunStatus(run.status));
}

function timeOf(value: string | undefined): number | null {
  if (!value) return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}

export function runDurationMs(run: WorkflowRun): number | null {
  if (!isTerminalRunStatus(run.status)) return null;
  const started = timeOf(run.startedAt);
  const completed = timeOf(run.completedAt);
  if (started === null || completed === null) return null;
  return Math.max(completed - started, 0);
}

export type DurationUnit = "millisecond" | "second" | "minute" | "hour";

export interface DurationValue {
  value: number;
  unit: DurationUnit;
  maximumFractionDigits: number;
}

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

export function durationUnit(ms: number): DurationValue {
  if (ms < SECOND_MS) return { value: ms, unit: "millisecond", maximumFractionDigits: 0 };
  if (ms < MINUTE_MS) return { value: ms / SECOND_MS, unit: "second", maximumFractionDigits: 1 };
  if (ms < HOUR_MS) return { value: ms / MINUTE_MS, unit: "minute", maximumFractionDigits: 1 };
  return { value: ms / HOUR_MS, unit: "hour", maximumFractionDigits: 1 };
}

export interface WaterfallBar {
  offsetPct: number;
  widthPct: number;
}

const MIN_BAR_PCT = 0.75;

function stepSpan(step: WorkflowRunLog): { start: number; end: number } | null {
  const duration = Math.max(step.durationMs || 0, 0);
  const started = timeOf(step.startedAt);
  const finished = timeOf(step.finishedAt);
  if (started !== null) return { start: started, end: finished ?? started + duration };
  const executed = timeOf(step.executedAt);
  if (executed === null) return null;
  return { start: executed - duration, end: executed };
}

function runBounds(run: Pick<WorkflowRun, "startedAt" | "completedAt"> | undefined): number[] {
  if (!run) return [];
  return [timeOf(run.startedAt), timeOf(run.completedAt)].filter((at): at is number => at !== null);
}

export function stepWaterfall(steps: readonly WorkflowRunLog[], run?: Pick<WorkflowRun, "startedAt" | "completedAt">): WaterfallBar[] {
  const spans = steps.map(stepSpan);
  const known = spans.filter((span): span is { start: number; end: number } => span !== null);
  if (known.length === 0) return steps.map(() => ({ offsetPct: 0, widthPct: MIN_BAR_PCT }));
  const bounds = runBounds(run);
  const origin = Math.min(...known.map((span) => span.start), ...bounds);
  const total = Math.max(Math.max(...known.map((span) => span.end), ...bounds) - origin, 1);
  return spans.map((span) => {
    if (!span) return { offsetPct: 0, widthPct: MIN_BAR_PCT };
    const widthPct = Math.max(((span.end - span.start) / total) * 100, MIN_BAR_PCT);
    const offsetPct = Math.min(((span.start - origin) / total) * 100, 100 - widthPct);
    return { offsetPct, widthPct };
  });
}

const RUN_PARAM = "run";

export function workflowHref(workflowId: string): string {
  return `/dashboard/workflows/${encodeURIComponent(workflowId)}`;
}

export function workflowRunHref(workflowId: string, runId: string): string {
  return `${workflowHref(workflowId)}?${new URLSearchParams({ [RUN_PARAM]: runId }).toString()}`;
}

export function runIdFromSearch(search: string): string | null {
  return new URLSearchParams(search).get(RUN_PARAM) || null;
}

const ALERT_PARAM = "alert";

export function alertIdFromSearch(search: string): string | null {
  return new URLSearchParams(search).get(ALERT_PARAM) || null;
}

const NODE_PARAM = "node";

export function workflowNodeHref(workflowId: string, nodeId: string): string {
  return `${workflowHref(workflowId)}?${new URLSearchParams({ [NODE_PARAM]: nodeId }).toString()}`;
}

export function nodeIdFromSearch(search: string): string | null {
  return new URLSearchParams(search).get(NODE_PARAM) || null;
}

export type StepTab = "input" | "output" | "error" | "http" | "logs";

function hasEntries(value: Record<string, unknown> | undefined): boolean {
  return Boolean(value && Object.keys(value).length > 0);
}

export function stepTabs(step: WorkflowRunLog): StepTab[] {
  const tabs: StepTab[] = [];
  if (hasEntries(step.input)) tabs.push("input");
  if (hasEntries(step.output)) tabs.push("output");
  if (step.error || step.errorKind || step.errorChain?.length || step.stack) tabs.push("error");
  if (step.http?.length) tabs.push("http");
  if (step.scriptLogs?.length) tabs.push("logs");
  return tabs;
}
