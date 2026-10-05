import type { MemberRow } from "./types";
import type { PeriodRange } from "./period";

export type MemberActivityFlag = "late_start" | "no_presence" | "possible_forgotten_tab";

export interface MemberActivitySession {
  start: string;
  end: string;
  on_call_ms: number;
  open: boolean;
}

export interface MemberActivityDay {
  date: string;
  weekday: number;
  connected_ms: number;
  on_call_ms: number;
  sessions: MemberActivitySession[] | null;
  flags: MemberActivityFlag[] | null;
}

export interface MemberActivityReport {
  timezone: string;
  usual_start?: string;
  connected_ms: number;
  on_call_ms: number;
  days: MemberActivityDay[];
  heatmap_minutes: number[][];
  received: Record<string, number>;
  received_while_offline: number;
  work?: MemberRow;
}

export type MemberActivitySubject = { mode: "self" } | { mode: "member"; memberId: string };

export function memberActivitySubject(memberId: string, viewerId: string): MemberActivitySubject {
  return viewerId !== "" && memberId === viewerId ? { mode: "self" } : { mode: "member", memberId };
}

export const MEMBER_ACTIVITY_OUT_OF_SCOPE = 404;

const MINUTES_PER_DAY = 24 * 60;
const MS_PER_MINUTE = 60_000;

export function memberActivityPath(subject: MemberActivitySubject): string {
  const who = subject.mode === "self" ? "me" : encodeURIComponent(subject.memberId);
  return `/attendance/members/${who}/activity`;
}

export function memberActivityQuery(period: PeriodRange, timezone: string): string {
  return new URLSearchParams({ date_from: period.dateFrom, date_to: period.dateTo, timezone }).toString();
}

export function memberActivityKey(workspaceId: string, subject: MemberActivitySubject, period: PeriodRange) {
  return ["member-activity", workspaceId, subject.mode === "self" ? "me" : subject.memberId, period.dateFrom, period.dateTo] as const;
}

export interface LocalClock {
  date: string;
  minutes: number;
}

export function localClock(iso: string, timezone: string): LocalClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

export interface SessionBar {
  offsetPct: number;
  widthPct: number;
  onCallShare: number;
  crossesMidnight: boolean;
}

export function sessionBar(session: MemberActivitySession, dayDate: string, timezone: string): SessionBar {
  const start = localClock(session.start, timezone);
  const end = localClock(session.end, timezone);
  const startMinute = start.date === dayDate ? start.minutes : 0;
  const crossesMidnight = end.date > dayDate;
  const endMinute = crossesMidnight ? MINUTES_PER_DAY : end.date < dayDate ? 0 : end.minutes;
  const spanMinutes = Math.max(0, endMinute - startMinute);
  const durationMs = Date.parse(session.end) - Date.parse(session.start);
  const onCallShare = durationMs > 0 ? Math.min(1, Math.max(0, session.on_call_ms / durationMs)) : 0;
  return {
    offsetPct: (startMinute / MINUTES_PER_DAY) * 100,
    widthPct: (spanMinutes / MINUTES_PER_DAY) * 100,
    onCallShare,
    crossesMidnight,
  };
}

export function formatHoursMinutes(ms: number, minUnit: string): string {
  const totalMinutes = Math.max(0, Math.round(ms / MS_PER_MINUTE));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}${minUnit}`;
  return `${hours}h ${String(minutes).padStart(2, "0")}${minUnit}`;
}

export function receivedTotal(received: Record<string, number>): number {
  return Object.values(received).reduce((sum, count) => sum + count, 0);
}

export interface HeatmapCell {
  weekday: number;
  hour: number;
  minutes: number;
  intensity: number;
}

export function heatmapCells(grid: number[][]): HeatmapCell[] {
  const peak = Math.max(0, ...grid.flat());
  return grid.flatMap((hours, weekday) =>
    hours.map((minutes, hour) => ({ weekday, hour, minutes, intensity: peak > 0 ? minutes / peak : 0 })),
  );
}

const HUMAN_ACTOR = "human";

export function hasMemberActivity(row: Pick<MemberRow, "actor_kind">): boolean {
  return row.actor_kind === HUMAN_ACTOR;
}
