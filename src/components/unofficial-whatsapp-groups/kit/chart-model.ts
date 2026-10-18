import type { DailyPoint } from "@/lib/unofficial-whatsapp-groups/types";

import { calendarDay } from "./format";

export interface FlowDatum {
  day: string;
  joins: number;
  leaves: number;
  leavesDown: number;
  net: number;
  balance: number;
}

export function flowSeries(points: DailyPoint[]): FlowDatum[] {
  let balance = 0;
  return points.map((point) => {
    const net = point.joins - point.leaves;
    balance += net;
    return {
      day: calendarDay(point.day),
      joins: point.joins,
      leaves: point.leaves,
      leavesDown: point.leaves === 0 ? 0 : -point.leaves,
      net,
      balance,
    };
  });
}

export function flowTotals(points: DailyPoint[]): { joins: number; leaves: number; net: number } {
  const joins = points.reduce((sum, point) => sum + point.joins, 0);
  const leaves = points.reduce((sum, point) => sum + point.leaves, 0);
  return { joins, leaves, net: joins - leaves };
}

export function hasFlow(points: DailyPoint[]): boolean {
  return points.some((point) => point.joins > 0 || point.leaves > 0);
}

export interface VolumeDatum {
  day: string;
  messages: number;
  activeGroups: number;
}

export function volumeSeries(points: DailyPoint[]): VolumeDatum[] {
  return points.map((point) => ({ day: calendarDay(point.day), messages: point.messages, activeGroups: point.activeGroups }));
}

export function hasVolume(points: DailyPoint[]): boolean {
  return points.some((point) => point.messages > 0);
}

export function isIsolatedValue(values: readonly (number | null)[], index: number): boolean {
  if (index < 0 || index >= values.length || values[index] === null) return false;
  const before = index > 0 ? values[index - 1] : null;
  const after = index < values.length - 1 ? values[index + 1] : null;
  return before === null && after === null;
}

export function clipLabel(label: string, max: number): string {
  const characters = Array.from(label.trim());
  if (characters.length <= max) return characters.join("");
  return `${characters.slice(0, Math.max(1, max)).join("").trimEnd()}…`;
}

const STACKED_MIN_HEIGHT = 200;

export function stackedHeight(rows: number, rowHeight: number): number {
  return Math.max(STACKED_MIN_HEIGHT, rows * rowHeight);
}

export function rowTotal(values: Record<string, number>, keys: readonly string[]): number {
  return keys.reduce((sum, key) => sum + Math.max(0, values[key] ?? 0), 0);
}

export function outerSegmentKey(values: Record<string, number>, keys: readonly string[]): string | undefined {
  for (let index = keys.length - 1; index >= 0; index -= 1) {
    const key = keys[index];
    if ((values[key] ?? 0) > 0) return key;
  }
  return undefined;
}
