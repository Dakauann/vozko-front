const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const HOUR_MS = 60 * 60_000;

function wallParts(at: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function zoneOffsetMs(at: Date, timeZone: string): number {
  const wall = wallParts(at, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function zonedInputValue(date: Date, timeZone: string): string {
  const wall = wallParts(date, timeZone);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

export function isoFromZonedInput(value: string, timeZone: string): string | null {
  const match = INPUT_PATTERN.exec(value);
  if (!match) return null;
  const wall = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  if (Number.isNaN(wall)) return null;
  const first = wall - zoneOffsetMs(new Date(wall), timeZone);
  return new Date(wall - zoneOffsetMs(new Date(first), timeZone)).toISOString();
}

export function zonedInputFromIso(iso: string | undefined | null, timeZone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : zonedInputValue(date, timeZone);
}

export function defaultScheduleValue(now: Date, timeZone: string): string {
  const next = zonedInputValue(new Date(now.getTime() + HOUR_MS), timeZone);
  return `${next.slice(0, 14)}00`;
}
