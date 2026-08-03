"use client";

/**
 * The single browser -> API client.
 *
 * Auth travels in the httpOnly `accessToken` cookie, which the browser attaches
 * automatically on every same-site request (the app and the API share a parent
 * domain). The browser therefore NEVER reads, forwards, or stores the access
 * token: there is no `Authorization` header built here and no `?token=` in URLs.
 * A token JavaScript cannot read is a token XSS cannot steal.
 *
 * Refresh is centralized and reactive: it happens only on a 401, is single-flight
 * within a tab, and is serialized across tabs by a Web Lock so two tabs cannot
 * both spend the single-use refresh token. On unrecoverable expiry the client
 * broadcasts one `session-expired` signal that every tab can react to.
 *
 * `fetchWithRefresh`, `getApiBaseUrl`, and `scopeHeaders` are exported so other
 * transports (e.g. the SSE chat stream) reuse the exact same auth behavior
 * instead of duplicating it.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "http://localhost:3001";

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export interface ApiResult<T> {
  data?: T;
  error?: { message: string; status?: number; code?: string };
}

/**
 * Every auth request MUST be time-bounded. `fetch` has no default timeout, so a
 * stalled/half-open connection (CDN edge recycling, mobile radio sleep, laptop
 * resume) hangs forever. Unbounded, that pins AuthProvider.isLoading=true (the
 * navbar pill + the dashboard full-screen loader never resolve) and, because
 * `performRefresh` runs inside a cross-tab Web Lock, wedges every other tab too.
 * Bounding the fetch converts an infinite hang into a fast failure that drops to
 * guest/retry, and releases the Web Lock within the timeout. See
 * `browser-client-timeout.test.ts`.
 */
const AUTH_TIMEOUT_MS = 10_000;

function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const id = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    ms,
  );
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

/**
 * This module holds per-browser single-flight state (`refreshInFlight`). That is
 * safe ONLY in the browser, where each user has an isolated runtime. Running it on
 * the server (one shared process for all users) is exactly what caused the historic
 * cross-user session leak ("the name in the corner changes to someone else"), so
 * calling these functions during SSR/render is forbidden: fail loud in dev, and log
 * in prod rather than silently share state.
 */
function assertBrowser(fn: string): void {
  if (typeof window !== "undefined") return;
  const message = `[browser-client] ${fn}() was called on the server. Auth is browser-only; call it from an effect/handler, never during render/SSR.`;
  if (process.env.NODE_ENV !== "production") {
    throw new Error(message);
  }
  console.error(message);
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Workspace/department scope headers, read from the browser-readable cookies. */
export function scopeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const workspaceId = readCookie("workspaceId");
  if (workspaceId) headers["X-Workspace-ID"] = workspaceId;
  const departmentId = readCookie("departmentId");
  if (departmentId) headers["X-Department-ID"] = departmentId;
  return headers;
}

/* --------------------------- session-expired signal --------------------------- */

const AUTH_CHANNEL = "vozko-auth";
const SESSION_EXPIRED = "vozko:session-expired";

let channel: BroadcastChannel | null = null;
function authChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!channel) channel = new BroadcastChannel(AUTH_CHANNEL);
  return channel;
}

let expiredEmitted = false;

/** Fire the session-expired signal once, to this tab and every other tab. */
export function notifySessionExpired(): void {
  if (expiredEmitted) return;
  expiredEmitted = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }
  authChannel()?.postMessage(SESSION_EXPIRED);
}

/** Subscribe to session-expired (this tab or any other). Returns an unsubscribe. */
export function onSessionExpired(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const local = () => handler();
  window.addEventListener(SESSION_EXPIRED, local);
  const ch = authChannel();
  const onMessage = (event: MessageEvent) => {
    if (event.data === SESSION_EXPIRED) handler();
  };
  ch?.addEventListener("message", onMessage);
  return () => {
    window.removeEventListener(SESSION_EXPIRED, local);
    ch?.removeEventListener("message", onMessage);
  };
}

/* ------------------------------ refresh (once) ------------------------------ */

let refreshInFlight: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  // Direct to the API: the httpOnly refresh cookie rides along, the API rotates
  // the pair and sets the new cookies (cookie mode). No server action involved.
  //
  // Time-bounded: this call holds the cross-tab Web Lock, so a stalled refresh
  // must not hang forever, that would freeze every tab. On timeout we abort and
  // return false (session treated as unrefreshable), releasing the lock.
  const t = timeoutSignal(AUTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Auth-Mode": "cookie" },
      body: "{}",
      signal: t.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    t.clear();
  }
}

/**
 * Refresh the session at most once concurrently per tab, and never in parallel
 * across tabs (Web Lock). Resolves true on success, false if the session is gone.
 */
export function refreshSession(): Promise<boolean> {
  assertBrowser("refreshSession");
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
      if (locks?.request) {
        // Bound the lock ACQUISITION, not just performRefresh. A sibling tab that
        // holds "vozko-auth-refresh" while frozen (its performRefresh abort timer
        // suspended on background/bfcache/sleep) would otherwise wedge this
        // acquisition forever, and fetchWithRefresh awaits us with no timeout, so
        // every 401-retry in this tab hangs until that tab resumes or closes.
        // `signal` only cancels the wait-to-acquire; once the lock is granted it is
        // a no-op, so performRefresh keeps its own AUTH_TIMEOUT_MS bound.
        const acq = timeoutSignal(AUTH_TIMEOUT_MS);
        try {
          return await locks.request(
            "vozko-auth-refresh",
            { signal: acq.signal },
            performRefresh,
          );
        } catch (err) {
          // Acquisition timed out: the holder is stuck. Don't hang, and don't
          // assume the session is dead, refresh directly. The origin tolerates
          // this honest concurrent rotation inside its 30s reuse-grace window.
          if (
            err instanceof DOMException &&
            (err.name === "TimeoutError" || err.name === "AbortError")
          ) {
            return await performRefresh();
          }
          throw err;
        } finally {
          acq.clear();
        }
      }
      return await performRefresh();
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Run a request; on a 401, refresh once and retry. A 401 is the only status that
 * triggers a refresh (403 = authorization, not authentication, surfaced as-is).
 * If the refresh fails, the session is gone: broadcast session-expired and return
 * the 401 response so the caller can handle it. This is the single source of the
 * refresh-on-401 behavior for every browser transport.
 */
export async function fetchWithRefresh(
  makeRequest: () => Promise<Response>,
): Promise<Response> {
  let response = await makeRequest();
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await makeRequest();
    } else {
      notifySessionExpired();
    }
  }
  return response;
}

/* --------------------------------- client ---------------------------------- */

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  assertBrowser("apiClient");
  const isAbsolute = /^https?:\/\//i.test(endpoint);
  const url = isAbsolute ? endpoint : `${API_BASE_URL}${endpoint}`;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const run = () => {
    // Bound the request so a stalled connection can't pin isLoading forever.
    // A caller-supplied signal (e.g. an SSE stream that owns its own lifetime)
    // takes precedence over the default timeout.
    const t = timeoutSignal(AUTH_TIMEOUT_MS);
    return fetch(url, {
      ...options,
      credentials: "include",
      signal: options.signal ?? t.signal,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...scopeHeaders(),
        ...options.headers,
      },
    }).finally(() => t.clear());
  };

  try {
    const response = await fetchWithRefresh(run);

    if (!response.ok) {
      if (response.status === 401) {
        return {
          error: { message: "Session expired. Please login again.", status: 401 },
        };
      }
      const body = (await response
        .json()
        .catch(() => ({}))) as { message?: string; error?: string; code?: string };
      return {
        error: {
          message: body.message || body.error || `API error: ${response.statusText}`,
          status: response.status,
          code: body.code,
        },
      };
    }

    if (response.status === 204) return {};
    const data = (await response.json().catch(() => undefined)) as T | undefined;
    return { data };
  } catch (error) {
    return {
      error: {
        message: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}
