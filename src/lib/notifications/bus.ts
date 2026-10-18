import type { NotificationCreatedEvent } from "./types";

type NotificationCreatedListener = (event: NotificationCreatedEvent) => void;

const listeners = new Set<NotificationCreatedListener>();

export function subscribeNotificationCreated(listener: NotificationCreatedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitNotificationCreated(event: NotificationCreatedEvent): void {
  for (const listener of [...listeners]) listener(event);
}
