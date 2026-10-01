import { TIMELINE_KINDS, type CallContact, type CallListFilters, type CallOutcome, type TimelineKind } from "./types";

export const CALL_PERIODS = ["today", "7d", "30d", "all"] as const;
export type CallPeriod = (typeof CALL_PERIODS)[number];

export type OutcomeTone = "healthy" | "live" | "warning" | "destructive" | "muted";

const PERIOD_DAYS: Record<Exclude<CallPeriod, "all">, number> = { today: 0, "7d": 6, "30d": 29 };

const OUTCOME_TONES: Record<CallOutcome, OutcomeTone> = {
  answered: "healthy",
  in_progress: "live",
  missed: "warning",
  no_answer: "muted",
  busy: "muted",
  declined: "muted",
  cancelled: "muted",
  failed: "destructive",
};

export function callListQuery(filters: CallListFilters): string {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) });
  const optional: [string, string | undefined][] = [
    ["direction", filters.direction],
    ["channel", filters.channel],
    ["result", filters.result],
    ["memberId", filters.memberId],
    ["from", filters.from],
    ["to", filters.to],
    ["number", filters.number?.replace(/\D/g, "")],
  ];
  for (const [key, value] of optional) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function periodBounds(period: CallPeriod, now: Date = new Date()): { from?: string; to?: string } {
  if (period === "all") return {};
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - PERIOD_DAYS[period]);
  return { from: localDay(from), to: localDay(now) };
}

export function outcomeTone(outcome: CallOutcome): OutcomeTone {
  return OUTCOME_TONES[outcome];
}

export function contactLabel(contact: CallContact): { title: string; subtitle: string | null } {
  return contact.name ? { title: contact.name, subtitle: contact.number } : { title: contact.number, subtitle: null };
}

export function timelineKind(kind: string): TimelineKind | null {
  return (TIMELINE_KINDS as readonly string[]).includes(kind) ? (kind as TimelineKind) : null;
}
