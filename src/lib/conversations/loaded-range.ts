export interface LoadedRange {
  from: string | null;
  until: string | null;
}

function timeOf(iso: string): number {
  return new Date(iso).getTime();
}

export function inLoadedRange<T>(items: T[], range: LoadedRange, isoOf: (item: T) => string): T[] {
  if (range.from === null && range.until === null) return items;
  const from = range.from === null ? Number.NEGATIVE_INFINITY : timeOf(range.from);
  const until = range.until === null ? Number.POSITIVE_INFINITY : timeOf(range.until);
  return items.filter((item) => {
    const at = timeOf(isoOf(item));
    return at >= from && at <= until;
  });
}

export function olderPageNeeded(oldestLoadedAt: string | null, oldestMessageAt: string | null): boolean {
  if (!oldestLoadedAt || !oldestMessageAt) return true;
  return timeOf(oldestLoadedAt) > timeOf(oldestMessageAt);
}
