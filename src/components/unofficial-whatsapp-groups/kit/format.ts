import { formatPhoneForDisplay } from "@/lib/phone/display";

export type KpiMark = "fault" | "warning" | "healthy";

export const RESPONSE_GOAL_MINUTES = 5;

const HIGH_ALERT_FAULT_PCT = 40;

export interface PersonNameSource {
  displayName?: string;
  contactName?: string;
  leadName?: string;
  name?: string;
  phone?: string;
  jid?: string;
}

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

export function calendarDay(day: string): string {
  const match = CALENDAR_DAY.exec(day);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : day;
}

export function calendarDate(day: string): Date | null {
  const match = CALENDAR_DAY.exec(day);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function parseInstant(at: string | undefined): Date | null {
  if (!at) return null;
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function jidLocal(jid: string): string {
  const user = jid.split("@")[0] ?? "";
  return (user.split(":")[0] ?? "").trim();
}

function jidServer(jid: string): string {
  const at = jid.indexOf("@");
  return at < 0 ? "" : jid.slice(at + 1).trim().toLowerCase();
}

export function isHiddenJid(jid: string | undefined): boolean {
  return Boolean(jid) && jidServer(jid as string) === "lid";
}

export function displayPhone(phone?: string, jid?: string): string | null {
  const fromPhone = phone ? jidLocal(phone) : "";
  if (fromPhone) return formatPhoneForDisplay(fromPhone);
  if (!jid || isHiddenJid(jid)) return null;
  const local = jidLocal(jid);
  return /^\+?\d+$/.test(local) ? formatPhoneForDisplay(local) : null;
}

export function personName(person: PersonNameSource): { label: string; isFallback: boolean } {
  for (const candidate of [person.displayName, person.contactName, person.leadName, person.name]) {
    const text = candidate?.trim();
    if (text) return { label: text, isFallback: false };
  }
  const phone = displayPhone(person.phone, person.jid);
  if (phone) return { label: phone, isFallback: true };
  const local = person.jid ? jidLocal(person.jid) : "";
  return { label: local, isFallback: true };
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

type RunDuration = { unit: "ms" | "s" | "min"; value: number; seconds?: number };

export function runDuration(startedAt: string, completedAt?: string): RunDuration | null {
  const start = parseInstant(startedAt);
  const end = parseInstant(completedAt);
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  if (ms < 1000) return { unit: "ms", value: Math.round(ms) };
  const tenths = Math.round(ms / 100) / 10;
  if (tenths < 60) return { unit: "s", value: tenths };
  const totalSeconds = Math.round(ms / 1000);
  return { unit: "min", value: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
}

type LastEventBucket = { kind: "today" | "yesterday" | "days" | "months" | "date" | "none"; count?: number };

function dayNumber(date: Date, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Math.floor(Date.UTC(pick("year"), pick("month") - 1, pick("day")) / 86_400_000);
}

export function lastEventBucket(at: string | undefined, now: Date, timeZone?: string): LastEventBucket {
  const date = parseInstant(at);
  if (!date) return { kind: "none" };
  const days = Math.max(0, dayNumber(now, timeZone) - dayNumber(date, timeZone));
  if (days === 0) return { kind: "today" };
  if (days === 1) return { kind: "yesterday" };
  if (days < 30) return { kind: "days", count: days };
  const months = Math.floor(days / 30);
  if (months < 12) return { kind: "months", count: Math.max(1, months) };
  return { kind: "date" };
}

export function highAlertMark(pct: number, completed: number): KpiMark | undefined {
  if (completed <= 0) return undefined;
  if (pct >= HIGH_ALERT_FAULT_PCT) return "fault";
  if (pct > 0) return "warning";
  return "healthy";
}

export function shareOf(part: number, total: number): number | null {
  return total > 0 ? (part / total) * 100 : null;
}
