import { addDays, isDay, zonedDayStart } from "@/lib/advertising/date-range";
import type { AdTestCell } from "@/lib/advertising/types";

export const TEST_CONFIDENCES = [65, 80, 90, 95] as const;
export const DEFAULT_TEST_CONFIDENCE = 90;
export const MIN_TEST_CELLS = 2;
export const MAX_TEST_CELLS = 5;
export const MAX_TEST_DAYS = 30;

const START_LEAD_MS = 10 * 60_000;

export function canTest(selectedCount: number): boolean {
  return selectedCount >= MIN_TEST_CELLS && selectedCount <= MAX_TEST_CELLS;
}

export function evenShares(count: number): number[] {
  if (count <= 0) return [];
  const even = Math.floor(100 / count);
  return Array.from({ length: count }, (_, index) => (index === 0 ? even + (100 - even * count) : even));
}

export function cellsFor(objects: { metaId: string; name: string }[]): AdTestCell[] {
  const shares = evenShares(objects.length);
  return objects.map((object, index) => ({ name: object.name, objectIds: [object.metaId], share: shares[index] }));
}

export function sharesTotal(cells: AdTestCell[]): number {
  return cells.reduce((sum, cell) => sum + (Number.isFinite(cell.share) ? cell.share : 0), 0);
}

export type TestWindowProblem = "dates" | "endBeforeStart" | "tooLong";

export function testWindow(
  startDay: string,
  endDay: string,
  today: string,
  timezone: string,
  now: Date,
): { startAt: string; endAt: string } | { problem: TestWindowProblem } {
  if (!isDay(startDay) || !isDay(endDay) || startDay < today) return { problem: "dates" };
  if (endDay < startDay) return { problem: "endBeforeStart" };
  const days = Math.round((Date.parse(`${endDay}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86_400_000) + 1;
  if (days > MAX_TEST_DAYS) return { problem: "tooLong" };
  const startAt = startDay === today ? new Date(now.getTime() + START_LEAD_MS).toISOString() : zonedDayStart(startDay, timezone);
  const endAt = zonedDayStart(addDays(endDay, 1), timezone);
  if (!startAt || !endAt) return { problem: "dates" };
  return { startAt, endAt };
}
