import { windowKey } from "./window-deck";

export interface EntryViewer {
  user_id: string;
  name: string;
}

export interface ViewersPayload {
  entry_id: string;
  entry_type: string;
  viewers: EntryViewer[];
}

export type ViewersState = ReadonlyMap<string, readonly EntryViewer[]>;

export const emptyViewers: ViewersState = new Map();

const NO_VIEWERS: readonly EntryViewer[] = [];

function readViewer(raw: unknown): EntryViewer | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { user_id, name } = raw as Record<string, unknown>;
  if (typeof user_id !== "string" || user_id.trim() === "") return null;
  return { user_id, name: typeof name === "string" ? name.trim() : "" };
}

export function applyViewers(state: ViewersState, payload: ViewersPayload): ViewersState {
  const viewers = (Array.isArray(payload.viewers) ? payload.viewers : [])
    .map(readViewer)
    .filter((viewer): viewer is EntryViewer => viewer !== null);
  const next = new Map(state);
  next.set(windowKey(payload.entry_id, payload.entry_type), viewers);
  return next;
}

export function forgetViewers(state: ViewersState, entryId: string, entryType: string): ViewersState {
  const key = windowKey(entryId, entryType);
  if (!state.has(key)) return state;
  const next = new Map(state);
  next.delete(key);
  return next;
}

export function viewersOf(state: ViewersState, entryId: string, entryType: string): readonly EntryViewer[] {
  return state.get(windowKey(entryId, entryType)) ?? NO_VIEWERS;
}

export function otherViewers(state: ViewersState, entryId: string, entryType: string, selfId: string | null): EntryViewer[] {
  return viewersOf(state, entryId, entryType).filter((viewer) => viewer.user_id !== selfId);
}

export function typingOperatorNames(
  typistIds: Iterable<string>,
  viewers: readonly EntryViewer[],
  selfId: string | null,
): string[] {
  const names = new Map(viewers.map((viewer) => [viewer.user_id, viewer.name]));
  return [...typistIds].filter((id) => id !== selfId).map((id) => names.get(id) ?? "").filter((name) => name !== "");
}
