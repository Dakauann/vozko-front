import type { AdDayPart } from "@/lib/advertising/draft-types";

export const DAYS = [0, 1, 2, 3, 4, 5, 6];
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export type ScheduleGrid = boolean[][];

export function emptyGrid(): ScheduleGrid {
  return DAYS.map(() => HOURS.map(() => false));
}

export function scheduleToGrid(parts: AdDayPart[] | undefined): ScheduleGrid {
  const grid = emptyGrid();
  for (const part of parts ?? []) {
    const from = Math.max(0, Math.floor(part.startMinute / 60));
    const to = Math.min(24, Math.ceil(part.endMinute / 60));
    for (const day of part.days) {
      if (day < 0 || day > 6) continue;
      for (let hour = from; hour < to; hour++) grid[day][hour] = true;
    }
  }
  return grid;
}

function dayRanges(hours: boolean[]): [number, number][] {
  const ranges: [number, number][] = [];
  let start = -1;
  hours.forEach((on, hour) => {
    if (on && start < 0) start = hour;
    if (!on && start >= 0) {
      ranges.push([start, hour]);
      start = -1;
    }
  });
  if (start >= 0) ranges.push([start, 24]);
  return ranges;
}

export function gridToSchedule(grid: ScheduleGrid): AdDayPart[] {
  const byRange = new Map<string, AdDayPart>();
  DAYS.forEach((day) => {
    for (const [from, to] of dayRanges(grid[day] ?? [])) {
      const key = `${from}-${to}`;
      const existing = byRange.get(key);
      if (existing) existing.days.push(day);
      else byRange.set(key, { days: [day], startMinute: from * 60, endMinute: to * 60 });
    }
  });
  return [...byRange.values()].sort((a, b) => a.startMinute - b.startMinute || a.days[0] - b.days[0]);
}

export function setCell(grid: ScheduleGrid, day: number, hour: number, on: boolean): ScheduleGrid {
  return grid.map((hours, d) => (d === day ? hours.map((value, h) => (h === hour ? on : value)) : hours));
}

export function setDay(grid: ScheduleGrid, day: number, on: boolean): ScheduleGrid {
  return grid.map((hours, d) => (d === day ? hours.map(() => on) : hours));
}

export function setHour(grid: ScheduleGrid, hour: number, on: boolean): ScheduleGrid {
  return grid.map((hours) => hours.map((value, h) => (h === hour ? on : value)));
}

export function gridIsEmpty(grid: ScheduleGrid): boolean {
  return grid.every((hours) => hours.every((on) => !on));
}

export function selectedHours(grid: ScheduleGrid): number {
  return grid.reduce((total, hours) => total + hours.filter(Boolean).length, 0);
}
