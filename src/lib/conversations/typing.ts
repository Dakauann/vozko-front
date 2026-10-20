import type { EntryType } from "./types";
import { windowKey } from "./window-deck";

export type TypingState = ReadonlyMap<string, ReadonlySet<string>>;

export type TypingEvent =
  | {
      type: "typing";
      entryId: string;
      entryType: EntryType | string;
      userId: string;
      isTyping: boolean;
    }
  | { type: "entry_left"; entryId: string; entryType: EntryType | string };

export const emptyTyping: TypingState = new Map();

const nobody: ReadonlySet<string> = new Set();

export function typistsIn(
  state: TypingState,
  entryId: string,
  entryType: EntryType | string,
): ReadonlySet<string> {
  return state.get(windowKey(entryId, entryType)) ?? nobody;
}

function withTypists(state: TypingState, key: string, typists: ReadonlySet<string>): TypingState {
  const next = new Map(state);
  if (typists.size === 0) next.delete(key);
  else next.set(key, typists);
  return next;
}

export function reduceTyping(state: TypingState, event: TypingEvent): TypingState {
  const key = windowKey(event.entryId, event.entryType);
  const current = state.get(key) ?? nobody;

  if (event.type === "entry_left") {
    return state.has(key) ? withTypists(state, key, nobody) : state;
  }

  if (current.has(event.userId) === event.isTyping) return state;

  const typists = new Set(current);
  if (event.isTyping) typists.add(event.userId);
  else typists.delete(event.userId);
  return withTypists(state, key, typists);
}
