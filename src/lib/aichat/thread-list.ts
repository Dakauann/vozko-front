import { relativeDayOf, type RelativeDay } from "@/lib/format/calendar-day";

import type { ChatThread } from "./types";

export const THREAD_PAGE_SIZE = 30;
export const THREAD_SEARCH_DELAY_MS = 250;

export type ThreadPlace = "here" | "other_project" | "studio" | "general";

interface ThreadActivity {
  day: RelativeDay;
  text: string;
}

export function appendThreads(loaded: ChatThread[], next: ChatThread[]): ChatThread[] {
  const known = new Set(loaded.map((thread) => thread.id));
  return [...loaded, ...next.filter((thread) => !known.has(thread.id))];
}

export function freshFirst(fresh: ChatThread[], loaded: ChatThread[]): ChatThread[] {
  const known = new Set(fresh.map((thread) => thread.id));
  return [...fresh, ...loaded.filter((thread) => !known.has(thread.id))];
}

export function matchesTitle(thread: ChatThread, query: string, untitled: string): boolean {
  const wanted = query.trim().toLocaleLowerCase();
  if (!wanted) return true;
  return (thread.title || untitled).toLocaleLowerCase().includes(wanted);
}

export function threadPlace(threadProject: string | null | undefined, openProject: string | undefined): ThreadPlace {
  if (!threadProject) return "general";
  if (!openProject) return "studio";
  return threadProject === openProject ? "here" : "other_project";
}

const DAY_FORMATS: Record<RelativeDay, Intl.DateTimeFormatOptions> = {
  today: { hour: "2-digit", minute: "2-digit" },
  yesterday: { hour: "2-digit", minute: "2-digit" },
  thisYear: { month: "short", day: "numeric" },
  older: { year: "numeric", month: "numeric", day: "numeric" },
};

export function threadActivity(thread: ChatThread, now: Date, locale: string, timeZone?: string): ThreadActivity | null {
  const stamp = thread.lastMessageAt || thread.createdAt;
  if (!stamp) return null;
  const at = new Date(stamp);
  if (Number.isNaN(at.getTime())) return null;
  const day = relativeDayOf(at, now, timeZone);
  return { day, text: new Intl.DateTimeFormat(locale, { ...DAY_FORMATS[day], timeZone }).format(at) };
}
