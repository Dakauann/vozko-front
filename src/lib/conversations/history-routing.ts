import type { HistoryDirection } from "./types";

export type HistoryHolder = "pane" | "window" | "prefetch";

export type HistoryRequests = ReadonlyMap<string, ReadonlySet<HistoryHolder>>;

export const noHistoryRequests: HistoryRequests = new Map();

const EVERY_VIEW: ReadonlySet<HistoryHolder> = new Set<HistoryHolder>(["pane", "window"]);
const NOBODY: ReadonlySet<HistoryHolder> = new Set();

function requestKey(entryKey: string, direction: HistoryDirection): string {
  return `${direction}|${entryKey}`;
}

export function requestHistory(
  requests: HistoryRequests,
  entryKey: string,
  direction: HistoryDirection,
  holder: HistoryHolder,
): HistoryRequests {
  const key = requestKey(entryKey, direction);
  const holders = new Set(requests.get(key) ?? []);
  holders.add(holder);
  return new Map(requests).set(key, holders);
}

export function forgetHistoryRequests(
  requests: HistoryRequests,
  entryKey: string,
  direction: HistoryDirection,
): HistoryRequests {
  const key = requestKey(entryKey, direction);
  if (!requests.has(key)) return requests;
  const next = new Map(requests);
  next.delete(key);
  return next;
}

export function routeHistoryPage(
  requests: HistoryRequests,
  entryKey: string,
  direction: HistoryDirection,
): { requests: HistoryRequests; holders: ReadonlySet<HistoryHolder> } {
  if (direction === "latest") return { requests, holders: EVERY_VIEW };
  const holders = requests.get(requestKey(entryKey, direction)) ?? NOBODY;
  return { requests: forgetHistoryRequests(requests, entryKey, direction), holders };
}

export function hasHistoryRequest(
  requests: HistoryRequests,
  entryKey: string,
  direction: HistoryDirection,
  holder: HistoryHolder,
): boolean {
  return Boolean(requests.get(requestKey(entryKey, direction))?.has(holder));
}
