export const HISTORY_LIMIT = 100;
export const COALESCE_WINDOW_MS = 600;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  group: string | null;
  at: number;
}

export type HistoryAction<T> =
  | { type: "commit"; value: T; group?: string; at: number; join?: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "adopt"; value: T };

export function initHistory<T>(value: T): History<T> {
  return { past: [], present: value, future: [], group: null, at: 0 };
}

function bounded<T>(items: T[]): T[] {
  return items.length > HISTORY_LIMIT ? items.slice(items.length - HISTORY_LIMIT) : items;
}

export function historyReducer<T>(state: History<T>, action: HistoryAction<T>): History<T> {
  switch (action.type) {
    case "commit": {
      if (action.value === state.present) return state;
      const group = action.group ?? null;
      const coalesce = group !== null && group === state.group && (action.join === true || action.at - state.at <= COALESCE_WINDOW_MS);
      if (coalesce) return { ...state, present: action.value, future: [], at: action.at };
      return { past: bounded([...state.past, state.present]), present: action.value, future: [], group, at: action.at };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], group: null, at: 0 };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { past: bounded([...state.past, state.present]), present: next, future: rest, group: null, at: 0 };
    }
    case "adopt": {
      if (action.value === state.present) return state;
      return { ...state, present: action.value, future: [], group: null, at: 0 };
    }
  }
}

export function canUndo<T>(state: History<T>): boolean {
  return state.past.length > 0;
}

export function canRedo<T>(state: History<T>): boolean {
  return state.future.length > 0;
}
