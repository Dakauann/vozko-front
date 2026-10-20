import { useSyncExternalStore } from "react";

import { setViewing } from "@/lib/attention/signal";

export type TeamChatView = "list" | "thread" | "new";

export interface TeamChatPanelState {
  open: boolean;
  view: TeamChatView;
  threadId: string | null;
}

const CLOSED: TeamChatPanelState = { open: false, view: "list", threadId: null };

let state: TeamChatPanelState = CLOSED;

const listeners = new Set<() => void>();

function set(next: TeamChatPanelState): void {
  state = next;
  setViewing("team_message", next.open && next.view === "thread" ? next.threadId : null);
  listeners.forEach((listener) => listener());
}

export function teamChatPanel(): TeamChatPanelState {
  return state;
}

export function openTeamChat(threadId?: string): void {
  set(threadId ? { open: true, view: "thread", threadId } : { open: true, view: "list", threadId: null });
}

export function startNewTeamChat(): void {
  set({ open: true, view: "new", threadId: null });
}

export function showTeamChatList(): void {
  set({ open: true, view: "list", threadId: null });
}

export function closeTeamChat(): void {
  set(CLOSED);
}

export function toggleTeamChat(): void {
  if (state.open) closeTeamChat();
  else openTeamChat(state.threadId ?? undefined);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTeamChatPanel(): TeamChatPanelState {
  return useSyncExternalStore(subscribe, teamChatPanel, () => CLOSED);
}
