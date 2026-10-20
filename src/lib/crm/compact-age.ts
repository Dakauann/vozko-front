export type CompactAge =
  | { unit: "now" }
  | { unit: "minutes" | "hours" | "days"; value: number }
  | { unit: "date"; date: Date };

const MINUTE_MS = 60_000;
const DAYS_BEFORE_A_DATE = 7;

export function compactAge(iso: string, now: number = Date.now()): CompactAge | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const minutes = Math.floor((now - then) / MINUTE_MS);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return { unit: "now" };
  if (minutes < 60) return { unit: "minutes", value: minutes };
  if (hours < 24) return { unit: "hours", value: hours };
  if (days < DAYS_BEFORE_A_DATE) return { unit: "days", value: days };
  return { unit: "date", date: new Date(then) };
}
