import type { TeamChatSocketEvent } from "./types";

type EventListener = (event: TeamChatSocketEvent) => void;

type ConnectionListener = (connected: boolean) => void;

type TypingSender = (threadId: string) => boolean;

const eventListeners = new Set<EventListener>();

const connectionListeners = new Set<ConnectionListener>();

let typingSender: TypingSender | null = null;

export function subscribeTeamChat(listener: EventListener): () => void {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

export function emitTeamChat(event: TeamChatSocketEvent): void {
  for (const listener of [...eventListeners]) listener(event);
}

export function subscribeTeamChatConnection(listener: ConnectionListener): () => void {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

export function emitTeamChatConnection(connected: boolean): void {
  for (const listener of [...connectionListeners]) listener(connected);
}

export function registerTeamChatTypingSender(sender: TypingSender): () => void {
  typingSender = sender;
  return () => {
    if (typingSender === sender) typingSender = null;
  };
}

export function sendTeamChatTyping(threadId: string): boolean {
  return typingSender ? typingSender(threadId) : false;
}
