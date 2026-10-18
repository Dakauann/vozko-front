import { applyPatches, enablePatches, freeze, produceWithPatches, type Draft, type Patch } from "immer";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

enablePatches();

export const HISTORY_LIMIT = 200;

interface HistoryEntry {
  patches: Patch[];
  inverse: Patch[];
  selectionBefore: string[];
  selectionAfter: string[];
  group?: string;
}

export interface StudioEditorState<D extends object> {
  document: D;
  selection: string[];
  revision: number;
  canUndo: boolean;
  canRedo: boolean;
  inTransaction: boolean;
  apply: (operation: (document: D) => D, nextSelection?: string[]) => void;
  applyAs: (group: string, operation: (document: D) => D) => boolean;
  update: (recipe: (draft: Draft<D>) => void, nextSelection?: string[]) => void;
  select: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  beginTransaction: () => void;
  commitTransaction: () => void;
  cancelTransaction: () => void;
  reset: (document: D) => void;
}

export type StudioEditorStore<D extends object> = StoreApi<StudioEditorState<D>>;

interface StudioStoreOptions<D> {
  historyLimit?: number;
  settle?: (before: D, after: D) => D;
}

export function createStudioStore<D extends object>(initial: D, options: StudioStoreOptions<D> = {}): StudioEditorStore<D> {
  const limit = options.historyLimit ?? HISTORY_LIMIT;
  const settled = (before: D, after: D): D => (options.settle && after !== before ? options.settle(before, after) : after);
  let past: HistoryEntry[] = [];
  let future: HistoryEntry[] = [];
  let pending: HistoryEntry | null = null;

  return createStore<StudioEditorState<D>>()((set, get) => {
    const flags = () => ({ canUndo: past.length > 0, canRedo: future.length > 0, inTransaction: pending !== null });

    const record = (next: D, patches: Patch[], inverse: Patch[], nextSelection?: string[]) => {
      if (patches.length === 0) return;
      const { selection, revision } = get();
      const after = nextSelection ? [...nextSelection] : selection;
      if (pending) {
        pending.patches.push(...patches);
        pending.inverse.unshift(...inverse);
        pending.selectionAfter = after;
      } else {
        past.push({ patches, inverse, selectionBefore: selection, selectionAfter: after });
        if (past.length > limit) past = past.slice(past.length - limit);
        future = [];
      }
      set({ document: next, selection: after, revision: revision + 1, ...flags() });
    };

    const travel = (from: HistoryEntry[], to: HistoryEntry[], direction: "undo" | "redo") => {
      if (pending) get().commitTransaction();
      const entry = from.pop();
      if (!entry) return;
      to.push(entry);
      const { document, revision } = get();
      const patches = direction === "undo" ? entry.inverse : entry.patches;
      const selection = direction === "undo" ? entry.selectionBefore : entry.selectionAfter;
      set({ document: applyPatches(document, patches), selection, revision: revision + 1, ...flags() });
    };

    return {
      document: freeze(initial, true),
      selection: [],
      revision: 0,
      canUndo: false,
      canRedo: false,
      inTransaction: false,
      apply: (operation, nextSelection) => {
        const current = get().document;
        const next = settled(current, operation(current));
        if (next === current) return;
        const [result, patches, inverse] = produceWithPatches(current, (): D => next);
        record(result as D, patches, inverse, nextSelection);
      },
      applyAs: (group, operation) => {
        if (pending) return false;
        const current = get().document;
        const next = settled(current, operation(current));
        if (next === current) return true;
        const [result, patches, inverse] = produceWithPatches(current, (): D => next);
        if (patches.length === 0) return true;
        const { selection, revision } = get();
        const top = past.at(-1);
        if (top && top.group === group && future.length === 0) {
          top.patches.push(...patches);
          top.inverse.unshift(...inverse);
        } else {
          past.push({ patches, inverse, selectionBefore: selection, selectionAfter: selection, group });
          if (past.length > limit) past = past.slice(past.length - limit);
        }
        future = [];
        set({ document: result as D, revision: revision + 1, ...flags() });
        return true;
      },
      update: (recipe, nextSelection) => {
        const current = get().document;
        const [drafted] = produceWithPatches(current, recipe);
        const next = settled(current, drafted as D);
        if (next === current) return;
        const [result, patches, inverse] = produceWithPatches(current, (): D => next);
        record(result as D, patches, inverse, nextSelection);
      },
      select: (ids) => {
        const current = get().selection;
        if (current.length === ids.length && current.every((id, i) => id === ids[i])) return;
        set({ selection: [...ids] });
        if (pending) pending.selectionAfter = [...ids];
      },
      undo: () => travel(past, future, "undo"),
      redo: () => travel(future, past, "redo"),
      beginTransaction: () => {
        if (pending) return;
        const { selection } = get();
        pending = { patches: [], inverse: [], selectionBefore: selection, selectionAfter: selection };
        set(flags());
      },
      commitTransaction: () => {
        if (!pending) return;
        const entry = pending;
        pending = null;
        if (entry.patches.length > 0) {
          past.push(entry);
          if (past.length > limit) past = past.slice(past.length - limit);
          future = [];
        }
        set(flags());
      },
      cancelTransaction: () => {
        if (!pending) return;
        const entry = pending;
        pending = null;
        const { document, revision } = get();
        if (entry.patches.length === 0) {
          set(flags());
          return;
        }
        set({ document: applyPatches(document, entry.inverse), selection: entry.selectionBefore, revision: revision + 1, ...flags() });
      },
      reset: (document) => {
        past = [];
        future = [];
        pending = null;
        set({ document: freeze(document, true), selection: [], revision: 0, ...flags() });
      },
    };
  });
}

export function useStudioEditor<D extends object, T>(store: StudioEditorStore<D>, selector: (state: StudioEditorState<D>) => T): T {
  return useStore(store, selector);
}
