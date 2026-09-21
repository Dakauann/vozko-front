export function resolveAutomationEnabled(
  fromFrame: boolean | null | undefined,
  fromInboxCache: boolean | null | undefined,
  previous: boolean | null | undefined = null,
): boolean | null {
  return fromFrame ?? fromInboxCache ?? previous ?? null;
}

export function isAutomationActive(value: boolean | null | undefined): boolean {
  return value !== false;
}
