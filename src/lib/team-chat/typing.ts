export const REMOTE_TYPING_MS = 5_000;

export const TYPING_SIGNAL_MS = 3_000;

export type Typers = Readonly<Record<string, number>>;

export function typersAfterSignal(typers: Typers, userId: string, now: number): Typers {
  return { ...typers, [userId]: now + REMOTE_TYPING_MS };
}

export function typersAfterMessage(typers: Typers, userId: string): Typers {
  if (!(userId in typers)) return typers;
  const rest = { ...typers };
  delete rest[userId];
  return rest;
}

export function typersAt(typers: Typers, now: number): string[] {
  return Object.entries(typers)
    .filter(([, until]) => until > now)
    .map(([userId]) => userId);
}
