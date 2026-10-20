export type WideSelectionMode = "all_matching" | "first_n" | "everyone";

export type SelectionMode = "ids" | WideSelectionMode;

export interface WideSelection {
  mode: WideSelectionMode;
  scope: string;
  matched: number;
  fingerprint?: string;
  limit?: number;
}

export interface BulkSelectionState {
  scope: string;
  picked: ReadonlySet<string>;
  wide: WideSelection | null;
  counting: WideSelectionMode | null;
}

export type PageHeaderState = "all" | "some" | "none";

const NOTHING: ReadonlySet<string> = new Set();

export function initialBulkSelection(scope: string): BulkSelectionState {
  return { scope, picked: NOTHING, wide: null, counting: null };
}

export function rescoped(state: BulkSelectionState, scope: string): BulkSelectionState {
  if (state.scope === scope) return state;
  return initialBulkSelection(scope);
}

export function withPicked(state: BulkSelectionState, picked: ReadonlySet<string>): BulkSelectionState {
  return { ...state, picked, wide: null };
}

export function cleared(state: BulkSelectionState): BulkSelectionState {
  return { ...state, picked: NOTHING, wide: null, counting: null };
}

export function countingStarted(state: BulkSelectionState, mode: WideSelectionMode): BulkSelectionState {
  return { ...state, counting: mode };
}

export function countFailed(state: BulkSelectionState): BulkSelectionState {
  return { ...state, counting: null };
}

export function widened(state: BulkSelectionState, wide: WideSelection): BulkSelectionState {
  if (wide.scope !== state.scope) return state;
  return { ...state, wide, counting: null };
}

export function wideSize(wide: WideSelection): number {
  if (wide.mode === "first_n" && wide.limit !== undefined) return Math.min(wide.limit, wide.matched);
  return wide.matched;
}

export function selectionSize(state: BulkSelectionState): number {
  return state.wide ? wideSize(state.wide) : state.picked.size;
}

export function selectionMode(state: BulkSelectionState): SelectionMode | null {
  if (state.wide) return state.wide.mode;
  return state.picked.size > 0 ? "ids" : null;
}

export function pageHeaderState(pageKeys: readonly string[], picked: ReadonlySet<string>): PageHeaderState {
  if (pageKeys.length === 0) return "none";
  const onPage = pageKeys.filter((key) => picked.has(key)).length;
  if (onPage === pageKeys.length) return "all";
  return onPage > 0 ? "some" : "none";
}

export function togglePage(picked: ReadonlySet<string>, pageKeys: readonly string[]): ReadonlySet<string> {
  const next = new Set(picked);
  if (pageHeaderState(pageKeys, picked) === "all") {
    for (const key of pageKeys) next.delete(key);
  } else {
    for (const key of pageKeys) next.add(key);
  }
  return next;
}

export function togglePicked(picked: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(picked);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function offersAllMatching(picked: ReadonlySet<string>, pageKeys: readonly string[], total: number): boolean {
  return pageHeaderState(pageKeys, picked) === "all" && total > picked.size;
}
