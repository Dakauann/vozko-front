export const EMBEDDED_SIGNUP_SOURCE = "wa-embedded";

export function embeddedSignupUrl(apiBaseUrl: string, workspaceId: string, returnUrl: string): string {
  const url = new URL("/oauth/meta/embedded", apiBaseUrl);
  url.searchParams.set("workspace_id", workspaceId);
  url.searchParams.set("redirect_url", returnUrl);
  return url.toString();
}

export function apiOriginOf(apiBaseUrl: string): string {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return "";
  }
}

export function embeddedSignupResult(event: { origin: string; data: unknown }, apiOrigin: string): string | null {
  if (apiOrigin && event.origin !== apiOrigin) return null;
  const data = event.data as { source?: string; status?: string } | null;
  if (!data || data.source !== EMBEDDED_SIGNUP_SOURCE) return null;
  return data.status ?? null;
}
