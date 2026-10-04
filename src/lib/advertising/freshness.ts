export const STALE_AFTER_MS = 5 * 60_000;

export function syncIsStale(lastSyncedAt: string | undefined, now: Date): boolean {
  if (!lastSyncedAt) return true;
  const synced = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(synced)) return true;
  return now.getTime() - synced > STALE_AFTER_MS;
}
