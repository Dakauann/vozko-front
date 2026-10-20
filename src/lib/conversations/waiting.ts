export const WAITING_ALERT_MINUTES = 15;

const MINUTE_MS = 60_000;

export function waitingAlert(sinceIso: string, now: number): boolean {
  const since = Date.parse(sinceIso);
  return !Number.isNaN(since) && now - since >= WAITING_ALERT_MINUTES * MINUTE_MS;
}
