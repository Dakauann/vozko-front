export type RelativeDay = "today" | "yesterday" | "thisYear" | "older";

const DAY_MS = 86_400_000;

interface CalendarDay {
  year: number;
  dayNumber: number;
}

function calendarDayOf(date: Date, timeZone: string | undefined): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value);
  const year = part("year");
  return { year, dayNumber: Math.round(Date.UTC(year, part("month") - 1, part("day")) / DAY_MS) };
}

export function relativeDayOf(at: Date, now: Date, timeZone?: string): RelativeDay {
  if (Number.isNaN(at.getTime()) || Number.isNaN(now.getTime())) return "older";
  const day = calendarDayOf(at, timeZone);
  const today = calendarDayOf(now, timeZone);
  const daysAgo = today.dayNumber - day.dayNumber;
  if (daysAgo === 0) return "today";
  if (daysAgo === 1) return "yesterday";
  return day.year === today.year ? "thisYear" : "older";
}
